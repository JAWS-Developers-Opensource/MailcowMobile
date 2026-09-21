import { parseVCard, parseVCards, generateVCard } from '../utils/vcard';

describe('vcard utils', () => {
  const sampleVCard = `BEGIN:VCARD
VERSION:3.0
UID:alice-uid-001@example.com
FN:Alice Example
N:Example;Alice;;;
EMAIL;TYPE=WORK:alice@example.com
EMAIL;TYPE=HOME:alice.home@gmail.com
TEL;TYPE=WORK:+1 555 0100
TEL;TYPE=MOBILE:+1 555 0101
ORG:ACME Corp
TITLE:Senior Engineer
END:VCARD`;

  it('parses a vCard', () => {
    const card = parseVCard(sampleVCard);
    expect(card.fn).toBe('Alice Example');
    expect(card.uid).toBe('alice-uid-001@example.com');
    expect(card.n?.given).toBe('Alice');
    expect(card.n?.family).toBe('Example');
    expect(card.emails).toHaveLength(2);
    expect(card.emails[0].value).toBe('alice@example.com');
    expect(card.emails[0].type).toBe('work');
    expect(card.phones).toHaveLength(2);
    expect(card.org).toBe('ACME Corp');
    expect(card.title).toBe('Senior Engineer');
  });

  it('parses multiple vCards', () => {
    const multi = sampleVCard + '\r\n' + sampleVCard.replace('alice-uid-001', 'alice-uid-002');
    const cards = parseVCards(multi);
    expect(cards).toHaveLength(2);
    expect(cards[0].uid).toBe('alice-uid-001@example.com');
    expect(cards[1].uid).toBe('alice-uid-002@example.com');
  });

  it('generates a vCard 3.0 string', () => {
    const vcard = generateVCard({
      uid: 'bob-uid-001@example.com',
      fn: 'Bob Builder',
      n: { family: 'Builder', given: 'Bob' },
      emails: [{ type: 'work', value: 'bob@builder.com' }],
      phones: [{ type: 'mobile', value: '+1 555 0200' }],
      org: 'Build Co',
    });
    expect(vcard).toContain('BEGIN:VCARD');
    expect(vcard).toContain('VERSION:3.0');
    expect(vcard).toContain('FN:Bob Builder');
    expect(vcard).toContain('UID:bob-uid-001@example.com');
    expect(vcard).toContain('EMAIL;TYPE=WORK:bob@builder.com');
    expect(vcard).toContain('ORG:Build Co');
    expect(vcard).toContain('END:VCARD');
  });

  it('round-trips a vCard', () => {
    const uid = 'rt-vcard-001@test';
    const generated = generateVCard({
      uid,
      fn: 'Round Trip',
      n: { family: 'Trip', given: 'Round' },
      emails: [{ type: 'work', value: 'rt@example.com' }],
      phones: [],
    });
    const parsed = parseVCard(generated);
    expect(parsed.uid).toBe(uid);
    expect(parsed.fn).toBe('Round Trip');
    expect(parsed.emails[0].value).toBe('rt@example.com');
  });
});
