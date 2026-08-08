import './bigint-json';

describe('BigInt.prototype.toJSON', () => {
  it('lets JSON.stringify serialize bigint fields as strings instead of throwing', () => {
    const payload = { id: 'abc', telegramUserId: 123456789012345n, nested: { tgMessageId: 42n } };

    expect(JSON.stringify(payload)).toBe(
      '{"id":"abc","telegramUserId":"123456789012345","nested":{"tgMessageId":"42"}}',
    );
  });
});
