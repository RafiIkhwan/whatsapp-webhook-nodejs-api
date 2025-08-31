import { z } from 'zod';

export const WahaBasePayloadSchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  event: z.string(),
  session: z.string(),
  metadata: z.record(z.unknown()).optional(),
  me: z.object({
    id: z.string(),
    pushName: z.string().optional(),
  }),
  engine: z.string().optional(),
  environment: z.object({
    version: z.string().optional(),
    engine: z.string().optional(),
    tier: z.string().optional(),
    browser: z.string().optional(),
  }).optional(),
});

export const WahaMessagePayloadSchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  from: z.string(),
  fromMe: z.boolean().optional().default(false),
  source: z.string().optional(),
  to: z.string().optional(),
  body: z.string().optional(),
  hasMedia: z.boolean().optional(),
  media: z.object({
    _data: z.object({
      id: z.object({
        fromMe: z.boolean(),
        remote: z.string(),
        id: z.string(),
        _serialized: z.string(),
      }),
      viewed: z.boolean().optional(),
      body: z.string().optional(),
      type: z.string().optional(),
      t: z.number().optional(),
      notifyName: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      ack: z.number().optional(),
      invis: z.boolean().optional(),
      isNewMsg: z.boolean().optional(),
      star: z.boolean().optional(),
      kicNotified: z.boolean().optional(),
      recvFresh: z.boolean().optional(),
      isFromTemplate: z.boolean().optional(),
      pollInvalidated: z.boolean().optional(),
      isSentCagPollCreation: z.boolean().optional(),
      latestEditMsgKey: z.unknown().nullable().optional(),
      latestEditSenderTimestampMs: z.unknown().nullable().optional(),
      mentionedJidList: z.array(z.string()).optional(),
      groupMentions: z.array(z.unknown()).optional(),
      isEventCanceled: z.boolean().optional(),
      eventInvalidated: z.boolean().optional(),
      isVcardOverMmsDocument: z.boolean().optional(),
      isForwarded: z.boolean().optional(),
      isQuestion: z.boolean().optional(),
      questionReplyQuotedMessage: z.unknown().nullable().optional(),
      hasReaction: z.boolean().optional(),
      viewMode: z.string().optional(),
      messageSecret: z.record(z.number()).optional(),
      productHeaderImageRejected: z.boolean().optional(),
      lastPlaybackProgress: z.number().optional(),
      isDynamicReplyButtonsMsg: z.boolean().optional(),
      isCarouselCard: z.boolean().optional(),
      parentMsgId: z.unknown().nullable().optional(),
      reportingTokenInfo: z.object({
        reportingToken: z.record(z.number()),
        version: z.number(),
        reportingTag: z.record(z.number()),
      }).optional(),
      links: z.array(z.unknown()).optional(),
    }).passthrough().optional(),
    id: z.object({
      fromMe: z.boolean(),
      remote: z.string(),
      id: z.string(),
      _serialized: z.string(),
    }),
    ack: z.number().optional(),
    hasMedia: z.boolean().optional(),
    body: z.string().optional(),
    type: z.string().optional(),
    timestamp: z.number().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    deviceType: z.string().optional(),
    isForwarded: z.boolean().optional(),
    forwardingScore: z.number().optional(),
    isStatus: z.boolean().optional(),
    isStarred: z.boolean().optional(),
    fromMe: z.boolean().optional(),
    hasQuotedMsg: z.boolean().optional(),
    hasReaction: z.boolean().optional(),
    vCards: z.array(z.unknown()).optional(),
    mentionedIds: z.array(z.string()).optional(),
    groupMentions: z.array(z.unknown()).optional(),
    isGif: z.boolean().optional(),
    links: z.array(z.unknown()).optional(),
  }).optional(),
  ack: z.number().optional(),
  ackName: z.string().optional(),
  vCards: z.array(z.unknown()).optional(),
  _data: z.object({
    id: z.object({
      fromMe: z.boolean(),
      remote: z.string(),
      id: z.string(),
      _serialized: z.string(),
    }),
    viewed: z.boolean().optional(),
    body: z.string().optional(),
    type: z.string().optional(),
    t: z.number().optional(),
    notifyName: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    ack: z.number().optional(),
    invis: z.boolean().optional(),
    isNewMsg: z.boolean().optional(),
    star: z.boolean().optional(),
    kicNotified: z.boolean().optional(),
    recvFresh: z.boolean().optional(),
    isFromTemplate: z.boolean().optional(),
    pollInvalidated: z.boolean().optional(),
    isSentCagPollCreation: z.boolean().optional(),
    latestEditMsgKey: z.unknown().nullable().optional(),
    latestEditSenderTimestampMs: z.unknown().nullable().optional(),
    mentionedJidList: z.array(z.string()).optional(),
    groupMentions: z.array(z.unknown()).optional(),
    isEventCanceled: z.boolean().optional(),
    eventInvalidated: z.boolean().optional(),
    isVcardOverMmsDocument: z.boolean().optional(),
    isForwarded: z.boolean().optional(),
    isQuestion: z.boolean().optional(),
    questionReplyQuotedMessage: z.unknown().nullable().optional(),
    hasReaction: z.boolean().optional(),
    viewMode: z.string().optional(),
    messageSecret: z.record(z.number()).optional(),
    productHeaderImageRejected: z.boolean().optional(),
    lastPlaybackProgress: z.number().optional(),
    isDynamicReplyButtonsMsg: z.boolean().optional(),
    isCarouselCard: z.boolean().optional(),
    parentMsgId: z.unknown().nullable().optional(),
    reportingTokenInfo: z.object({
      reportingToken: z.record(z.number()),
      version: z.number(),
      reportingTag: z.record(z.number()),
    }).optional(),
    links: z.array(z.unknown()).optional(),
  }).passthrough().optional(),
}).passthrough();

export const WahaMessageWebhookSchema = WahaBasePayloadSchema.extend({
  event: z.literal('message'),
  payload: WahaMessagePayloadSchema,
});

export const WahaMessageStatusPayloadSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string().optional(),
  chatId: z.string(),
  status: z.string(),
  timestamp: z.number(),
}).passthrough();

export const WahaMessageStatusWebhookSchema = WahaBasePayloadSchema.extend({
  event: z.literal('session.status'),
  payload: WahaMessageStatusPayloadSchema,
});

export const WahaWebhookSchema = z.discriminatedUnion('event', [
  WahaMessageWebhookSchema,
  WahaMessageStatusWebhookSchema,
]);

export type WahaBasePayload = z.infer<typeof WahaBasePayloadSchema>;
export type WahaMessagePayload = z.infer<typeof WahaMessagePayloadSchema>;
export type WahaMessageStatusPayload = z.infer<typeof WahaMessageStatusPayloadSchema>;
export type WahaMessageWebhook = z.infer<typeof WahaMessageWebhookSchema>;
export type WahaMessageStatusWebhook = z.infer<typeof WahaMessageStatusWebhookSchema>;
export type WahaWebhook = z.infer<typeof WahaWebhookSchema>;

export interface Customer {
  id: number;
  phone_number: string;
  name?: string;
  first_message_at: Date;
  last_message_at: Date;
  total_messages: number;
  segment?: string;
  segment_updated_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface ChatSession {
  id: number;
  customer_id: number;
  session_start: Date;
  session_end?: Date;
  message_count: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Message {
  id: number;
  customer_id: number;
  session_id: number;
  waha_message_id: string;
  chat_id: string;
  from_number: string;
  to_number?: string;
  message_body?: string;
  timestamp: Date;
  is_from_me: boolean;
  status?: string;
  reply_to?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CustomerSegmentationData {
  customerId: number;
  phoneNumber: string;
  totalMessages: number;
  firstMessageAt: Date;
  lastMessageAt: Date;
  totalSessions: number;
  avgMessagesPerSession: number;
  daysAsCustomer: number;
  recentMessages: Array<{
    messageBody: string;
    timestamp: Date;
    isFromMe: boolean;
  }>;
  conversationPatterns: {
    mostActiveHours: number[];
    averageResponseTime: number;
    commonTopics: string[];
  };
}

export interface SegmentationResult {
  segment: string;
  confidence: number;
  reasoning: string;
  characteristics: string[];
}

export class WhatsAppServiceError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'WhatsAppServiceError';
  }
}

export class LLMServiceError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'LLMServiceError';
  }
}

export class DatabaseServiceError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'DatabaseServiceError';
  }
}