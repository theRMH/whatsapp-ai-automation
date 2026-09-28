import { after } from "next/server";
import { getSetting, getSecret } from "@/lib/db/repositories/settings";
import { SettingsKeys, SettingsDefaults } from "@/lib/db/repositories/settings-keys";
import { getUserByPhone } from "@/lib/db/repositories/users";
import { normalizeJidToE164 } from "@/lib/phone/normalize";
import { hashProviderMessageId } from "@/lib/crypto/message-hash";
import { wasMessageProcessed, recordProcessedMessage } from "@/lib/db/repositories/processed-messages";
import { shouldReplyToUnknownSender } from "@/lib/db/repositories/unknown-senders";
import { isUserAllowedByStatusAndTrial } from "@/lib/security/access-control";
import { checkAndIncrementInboundRateLimit } from "@/lib/db/repositories/usage";
import { getUserKeyRecord } from "@/lib/db/repositories/users";
import { enqueueInboundJob } from "@/lib/db/repositories/inbound-jobs";
import { getEvolutionAdapter } from "@/lib/whatsapp/evolution-adapter";
import { processInboundJobs } from "@/lib/pipeline/process-inbound-jobs";
import { logger } from "@/lib/logger";

/**
 * Evolution webhook (PRD 36, 49). Fast path only: steps 1-11 of the
 * inbound processing order, then enqueue + after() (PRD 36.2.1). Always
 * returns 200 once the token is valid and the body parses, so Evolution
 * does not endlessly redeliver undeliverable events.
 */

export const maxDuration = 60;

async function sendPlainReply(phoneE164: string, text: string): Promise<void> {
  try {
    const adapter = await getEvolutionAdapter();
    await adapter.sendText(phoneE164, text);
  } catch (err) {
    logger.error("webhook_fixed_reply_send_failed", {
      errorCode: err instanceof Error ? err.name : "unknown",
    });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ webhookToken: string }> }
): Promise<Response> {
  const startedAt = Date.now();
  const { webhookToken } = await params;

  // Step 1: validate webhook route token.
  const configuredToken = await getSecret(SettingsKeys.EVOLUTION_WEBHOOK_TOKEN);
  if (!configuredToken || webhookToken !== configuredToken) {
    logger.warn("webhook_invalid_token");
    return new Response("Not found", { status: 404 });
  }

  // Step 2: parse JSON safely.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    logger.warn("webhook_invalid_json");
    return new Response("OK", { status: 200 });
  }

  // Step 3: normalize event through the Evolution adapter.
  let event;
  try {
    const adapter = await getEvolutionAdapter();
    event = adapter.normalizeInbound(body);
  } catch (err) {
    logger.error("webhook_normalize_failed", {
      errorCode: err instanceof Error ? err.name : "unknown",
    });
    return new Response("OK", { status: 200 });
  }

  // Step 4: ignore unsupported event types (also covers CONNECTION_UPDATE/MESSAGES_UPDATE).
  if (event.type !== "MESSAGES_UPSERT") {
    return new Response("OK", { status: 200 });
  }

  const { message } = event;

  // Step 5: ignore fromMe messages. Step 6: ignore group chats in V1.
  if (message.fromMe || message.isGroup) {
    return new Response("OK", { status: 200 });
  }

  // Step 7: normalize sender number.
  const senderPhone = normalizeJidToE164(message.senderJid ?? message.senderPhone);
  if (!senderPhone) {
    logger.warn("webhook_unparseable_sender");
    return new Response("OK", { status: 200 });
  }

  // Step 8: hash message id.
  const messageIdHash = hashProviderMessageId(message.providerMessageId);

  // Step 9: idempotency check.
  if (await wasMessageProcessed(messageIdHash)) {
    return new Response("OK", { status: 200 });
  }

  // Step 10: find manually authorized user.
  const user = await getUserByPhone(senderPhone);

  if (!user) {
    await recordProcessedMessage({
      messageIdHash,
      userId: null,
      eventType: "MESSAGES_UPSERT",
      status: "UNAUTHORIZED",
    });

    if (await shouldReplyToUnknownSender(senderPhone)) {
      const message = await getSetting<string>(
        SettingsKeys.MESSAGE_UNAUTHORIZED_SENDER,
        SettingsDefaults.MESSAGE_UNAUTHORIZED_SENDER
      );
      await sendPlainReply(senderPhone, message);
    }

    return new Response("OK", { status: 200 });
  }

  // Step 11: validate status/trial, then rate limit, then enqueue job.
  const denialReason = isUserAllowedByStatusAndTrial(user);
  if (denialReason) {
    await recordProcessedMessage({
      messageIdHash,
      userId: user.id,
      eventType: "MESSAGES_UPSERT",
      status: "DENIED",
    });

    const messageKey =
      denialReason === "USER_SUSPENDED"
        ? SettingsKeys.MESSAGE_SUSPENDED_ACCOUNT
        : SettingsKeys.MESSAGE_EXPIRED_TRIAL;
    const fallback =
      denialReason === "USER_SUSPENDED"
        ? SettingsDefaults.MESSAGE_SUSPENDED_ACCOUNT
        : SettingsDefaults.MESSAGE_EXPIRED_TRIAL;
    const replyText = await getSetting<string>(messageKey, fallback);
    await sendPlainReply(user.phoneE164, replyText);

    return new Response("OK", { status: 200 });
  }

  const rateLimit = await checkAndIncrementInboundRateLimit(user.id);
  if (!rateLimit.allowed) {
    await recordProcessedMessage({
      messageIdHash,
      userId: user.id,
      eventType: "MESSAGES_UPSERT",
      status: "DENIED",
    });

    if (rateLimit.shouldNotifyLimitReached) {
      const replyText = await getSetting<string>(
        SettingsKeys.MESSAGE_RATE_LIMITED,
        SettingsDefaults.MESSAGE_RATE_LIMITED
      );
      await sendPlainReply(user.phoneE164, replyText);
    }

    return new Response("OK", { status: 200 });
  }

  const userKeyRecord = await getUserKeyRecord(user.id);
  if (!userKeyRecord) {
    logger.error("webhook_missing_user_key", { userId: user.id });
    return new Response("OK", { status: 200 });
  }

  await enqueueInboundJob({ userId: user.id, messageIdHash, message, userKeyRecord });
  await recordProcessedMessage({
    messageIdHash,
    userId: user.id,
    eventType: "MESSAGES_UPSERT",
    status: "QUEUED",
  });

  // Schedule the worker to run after this response is sent (PRD 36.2.1 step 5).
  after(() => processInboundJobs(user.id));

  logger.info("webhook_received", {
    event: "MESSAGES_UPSERT",
    userId: user.id,
    msgType: message.type,
    status: "queued",
    latencyMs: Date.now() - startedAt,
  });

  return new Response("OK", { status: 200 });
}
