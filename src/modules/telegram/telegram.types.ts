export interface NormalizedIncomingMessage {
  telegramChatId: string;
  chatTitle: string;
  tgMessageId: string;
  fromTelegramUserId: string;
  fromUsername?: string;
  fromDisplayName: string;
  text?: string;
  replyToTgMessageId?: string;
  attachments: Array<{ type: string; fileId: string }>;
  editedAt?: string;
  isEdit: boolean;
}
