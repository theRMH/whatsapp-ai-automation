import { logger } from "@/lib/logger";
import { loadEvolutionConfig, type EvolutionConfig } from "./evolution-config";
import {
  WhatsAppProviderError,
  type WhatsAppProvider,
  type ConnectionStatus,
  type SendResult,
  type MediaSendInput,
  type StoredMediaReference,
  type NormalizedInboundEvent,
  type NormalizedInboundMessage,
  type NormalizedMessageType,
} from "./types";

/**
 * Evolution API adapter (PRD 27.4). All Evolution-specific endpoint
 * construction and payload shapes live only in this file - nothing
 * outside lib/whatsapp/ should know Evolution's REST contract or webhook
 * payload shape (PRD 37: "Provider-specific nested payloads must not leak
 * beyond the adapter.").
 *
 * Endpoints follow the Evolution API v2 REST contract. If a self-hosted
 * deployment differs, only this file needs to change.
 */

function jidToPhone(jid: string): string {
  return jid.split("@")[0].split(":")[0];
}

async function evolutionFetch(
  config: EvolutionConfig,
  path: string,
  init?: RequestInit
): Promise<unknown> {
  const url = `${config.baseUrl}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        apikey: config.apiKey,
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
    });
  } catch (err) {
    logger.error("evolution_request_failed", {
      path,
      errorCode: err instanceof Error ? err.name : "unknown",
    });
    throw new WhatsAppProviderError("EVOLUTION_UNAVAILABLE", "Evolution API request failed");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    logger.error("evolution_request_non_ok", { path, httpStatus: response.status });
    throw new WhatsAppProviderError(
      "EVOLUTION_UNAVAILABLE",
      `Evolution API returned HTTP ${response.status}`
    );
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

function extractMessageType(messageNode: Record<string, unknown>): {
  type: NormalizedMessageType;
  text?: string;
  caption?: string;
  filename?: string;
  mimeType?: string;
} {
  if (typeof messageNode.conversation === "string") {
    return { type: "text", text: messageNode.conversation };
  }
  const extText = messageNode.extendedTextMessage as { text?: string } | undefined;
  if (extText?.text) {
    return { type: "text", text: extText.text };
  }
  const image = messageNode.imageMessage as { caption?: string; mimetype?: string } | undefined;
  if (image) {
    return { type: "image", caption: image.caption, mimeType: image.mimetype };
  }
  const video = messageNode.videoMessage as { caption?: string; mimetype?: string } | undefined;
  if (video) {
    return { type: "video", caption: video.caption, mimeType: video.mimetype };
  }
  const audio = messageNode.audioMessage as { mimetype?: string } | undefined;
  if (audio) {
    return { type: "audio", mimeType: audio.mimetype };
  }
  const document = messageNode.documentMessage as
    | { caption?: string; mimetype?: string; fileName?: string }
    | undefined;
  if (document) {
    return {
      type: "document",
      caption: document.caption,
      mimeType: document.mimetype,
      filename: document.fileName,
    };
  }
  return { type: "unknown" };
}

export class EvolutionAdapter implements WhatsAppProvider {
  constructor(private readonly config: EvolutionConfig) {}

  async getConnectionStatus(): Promise<ConnectionStatus> {
    const data = (await evolutionFetch(
      this.config,
      `/instance/connectionState/${this.config.instanceName}`
    )) as { instance?: { state?: string } } | null;

    const state = data?.instance?.state ?? "unknown";
    return { connected: state === "open", state };
  }

  async configureWebhook(url: string): Promise<void> {
    await evolutionFetch(this.config, `/webhook/set/${this.config.instanceName}`, {
      method: "POST",
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url,
          webhookByEvents: false,
          events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "MESSAGES_UPDATE"],
        },
      }),
    });
  }

  async getWebhookConfig(): Promise<unknown> {
    return evolutionFetch(this.config, `/webhook/find/${this.config.instanceName}`);
  }

  async sendText(to: string, text: string): Promise<SendResult> {
    try {
      const data = (await evolutionFetch(this.config, `/message/sendText/${this.config.instanceName}`, {
        method: "POST",
        body: JSON.stringify({ number: to, text }),
      })) as { key?: { id?: string } } | null;

      return { success: true, providerMessageId: data?.key?.id };
    } catch (err) {
      if (err instanceof WhatsAppProviderError) {
        return { success: false, errorCode: err.code };
      }
      return { success: false, errorCode: "EVOLUTION_SEND_FAILED" };
    }
  }

  async sendMedia(to: string, media: MediaSendInput): Promise<SendResult> {
    try {
      const mediatype = media.mimeType.startsWith("image/")
        ? "image"
        : media.mimeType.startsWith("video/")
          ? "video"
          : media.mimeType.startsWith("audio/")
            ? "audio"
            : "document";

      const data = (await evolutionFetch(this.config, `/message/sendMedia/${this.config.instanceName}`, {
        method: "POST",
        body: JSON.stringify({
          number: to,
          mediatype,
          media: media.mediaUrl,
          mimetype: media.mimeType,
          fileName: media.filename,
          caption: media.caption,
        }),
      })) as { key?: { id?: string } } | null;

      return { success: true, providerMessageId: data?.key?.id };
    } catch (err) {
      if (err instanceof WhatsAppProviderError) {
        return { success: false, errorCode: err.code };
      }
      return { success: false, errorCode: "EVOLUTION_SEND_FAILED" };
    }
  }

  /**
   * Tries capabilities in version-safe order (PRD 18.7): forward by
   * message key, then re-send by stored URL, then a typed unavailable
   * error. Evolution's forward-by-key endpoint availability varies by
   * deployed version, so failures there fall through rather than throw.
   */
  async resendStoredMedia(to: string, ref: StoredMediaReference): Promise<SendResult> {
    if (ref.providerMessageKey) {
      try {
        const data = (await evolutionFetch(this.config, `/chat/forwardMessage/${this.config.instanceName}`, {
          method: "POST",
          body: JSON.stringify({ number: to, key: ref.providerMessageKey }),
        })) as { key?: { id?: string } } | null;
        return { success: true, providerMessageId: data?.key?.id };
      } catch {
        // fall through to URL-based resend
      }
    }

    if (ref.mediaUrl && ref.mimeType) {
      return this.sendMedia(to, { mediaUrl: ref.mediaUrl, mimeType: ref.mimeType, filename: ref.filename });
    }

    return { success: false, errorCode: "MEDIA_REFERENCE_UNAVAILABLE" };
  }

  normalizeInbound(payload: unknown): NormalizedInboundEvent {
    if (typeof payload !== "object" || payload === null) {
      return { type: "UNSUPPORTED" };
    }

    const body = payload as Record<string, unknown>;
    const eventName = String(body.event ?? "").toUpperCase().replace(/\./g, "_");

    if (eventName === "CONNECTION_UPDATE") {
      const data = body.data as { state?: string } | undefined;
      return { type: "CONNECTION_UPDATE", state: data?.state ?? "unknown" };
    }

    if (eventName === "MESSAGES_UPDATE") {
      return { type: "MESSAGES_UPDATE" };
    }

    if (eventName !== "MESSAGES_UPSERT") {
      return { type: "UNSUPPORTED" };
    }

    const data = body.data as Record<string, unknown> | undefined;
    if (!data) {
      return { type: "UNSUPPORTED" };
    }

    const key = data.key as { id?: string; remoteJid?: string; fromMe?: boolean } | undefined;
    const messageNode = (data.message as Record<string, unknown>) ?? {};
    const remoteJid = key?.remoteJid ?? "";
    const isGroup = remoteJid.endsWith("@g.us");
    const providerMessageId = key?.id;

    if (!providerMessageId || !remoteJid) {
      return { type: "UNSUPPORTED" };
    }

    const { type, text, caption, filename, mimeType } = extractMessageType(messageNode);
    const timestampSeconds = typeof data.messageTimestamp === "number" ? data.messageTimestamp : undefined;

    const message: NormalizedInboundMessage = {
      providerMessageId,
      senderPhone: jidToPhone(remoteJid),
      senderJid: remoteJid,
      fromMe: key?.fromMe ?? false,
      isGroup,
      timestamp: timestampSeconds ? new Date(timestampSeconds * 1000) : new Date(),
      type,
      text,
      caption,
      filename,
      mimeType,
      providerMessageKey: key,
    };

    return { type: "MESSAGES_UPSERT", message };
  }
}

export async function getEvolutionAdapter(): Promise<WhatsAppProvider> {
  const config = await loadEvolutionConfig();
  return new EvolutionAdapter(config);
}

export { WhatsAppProviderError };
