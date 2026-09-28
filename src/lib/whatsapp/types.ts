/**
 * Provider-agnostic WhatsApp types (PRD 27.4, 37). Nothing outside
 * lib/whatsapp/ should import Evolution-specific payload shapes directly -
 * always go through these normalized types and the WhatsAppProvider
 * interface.
 */

export type NormalizedMessageType =
  | "text"
  | "document"
  | "image"
  | "video"
  | "audio"
  | "unknown";

export interface NormalizedInboundMessage {
  providerMessageId: string;
  senderPhone: string;
  senderJid?: string;
  fromMe: boolean;
  isGroup: boolean;
  timestamp: Date;
  type: NormalizedMessageType;
  text?: string;
  caption?: string;
  filename?: string;
  mimeType?: string;
  mediaUrl?: string;
  mediaReference?: string;
  providerMessageKey?: unknown;
}

export type NormalizedEventType =
  | "MESSAGES_UPSERT"
  | "CONNECTION_UPDATE"
  | "MESSAGES_UPDATE"
  | "UNSUPPORTED";

export type NormalizedInboundEvent =
  | { type: "MESSAGES_UPSERT"; message: NormalizedInboundMessage }
  | { type: "CONNECTION_UPDATE"; state: string }
  | { type: "MESSAGES_UPDATE" }
  | { type: "UNSUPPORTED" };

export interface ConnectionStatus {
  connected: boolean;
  state: string;
}

export interface SendResult {
  success: boolean;
  providerMessageId?: string;
  errorCode?: string;
}

export interface MediaSendInput {
  mediaUrl: string;
  mimeType: string;
  filename?: string;
  caption?: string;
}

export interface StoredMediaReference {
  providerMessageKey?: unknown;
  mediaUrl?: string;
  mimeType?: string;
  filename?: string;
}

export class WhatsAppProviderError extends Error {
  constructor(
    public readonly code:
      | "EVOLUTION_UNAVAILABLE"
      | "EVOLUTION_SEND_FAILED"
      | "MEDIA_REFERENCE_UNAVAILABLE"
      | "EVOLUTION_NOT_CONFIGURED",
    message: string
  ) {
    super(message);
    this.name = "WhatsAppProviderError";
  }
}

export interface WhatsAppProvider {
  getConnectionStatus(): Promise<ConnectionStatus>;
  configureWebhook(url: string): Promise<void>;
  getWebhookConfig(): Promise<unknown>;
  sendText(to: string, text: string): Promise<SendResult>;
  sendMedia(to: string, media: MediaSendInput): Promise<SendResult>;
  resendStoredMedia(to: string, ref: StoredMediaReference): Promise<SendResult>;
  normalizeInbound(payload: unknown): NormalizedInboundEvent;
}
