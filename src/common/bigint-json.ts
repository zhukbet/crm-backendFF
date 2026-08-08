// Prisma maps Postgres BIGINT columns (telegram_user_id, telegram_chat_id, tg_message_id,
// anchor_message_tg_id, ...) to native JS `bigint`. `JSON.stringify` throws on those
// ("Do not know how to serialize a BigInt") — which Nest's Express adapter calls on every
// response — so without this, any endpoint returning a ticket/chat/customer/message crashes.
// Side-effect import: `import '../common/bigint-json'` before anything else touches JSON.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function (this: bigint) {
  return this.toString();
};
