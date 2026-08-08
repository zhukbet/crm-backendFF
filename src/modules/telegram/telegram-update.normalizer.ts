import { Injectable } from '@nestjs/common';
import { Update } from 'grammy/types';
import { NormalizedIncomingMessage } from './telegram.types';

@Injectable()
export class TelegramUpdateNormalizer {
  normalize(update: Update): NormalizedIncomingMessage | null {
    const message = update.message ?? update.edited_message;
    if (!message || !message.chat || message.chat.type === 'private') {
      // Only group/supergroup chats feed the ticketing pipeline.
      return null;
    }
    if (!message.from) return null;

    const attachments: Array<{ type: string; fileId: string }> = [];
    if (message.photo?.length) {
      attachments.push({ type: 'photo', fileId: message.photo[message.photo.length - 1].file_id });
    }
    if (message.document) attachments.push({ type: 'document', fileId: message.document.file_id });
    if (message.video) attachments.push({ type: 'video', fileId: message.video.file_id });
    if (message.voice) attachments.push({ type: 'voice', fileId: message.voice.file_id });
    if (message.sticker) attachments.push({ type: 'sticker', fileId: message.sticker.file_id });

    return {
      telegramChatId: String(message.chat.id),
      chatTitle: 'title' in message.chat ? message.chat.title : '',
      tgMessageId: String(message.message_id),
      fromTelegramUserId: String(message.from.id),
      fromUsername: message.from.username,
      fromDisplayName: [message.from.first_name, message.from.last_name].filter(Boolean).join(' '),
      text: message.text ?? message.caption,
      replyToTgMessageId: message.reply_to_message
        ? String(message.reply_to_message.message_id)
        : undefined,
      attachments,
      isEdit: Boolean(update.edited_message),
      editedAt: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : undefined,
    };
  }
}
