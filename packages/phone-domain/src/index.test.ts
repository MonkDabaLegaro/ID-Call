import { describe, expect, it } from 'vitest';
import { normalizePhoneNumber } from './index.js';

describe('normalizePhoneNumber', () => {
  it('normalizes a Chilean mobile number to E.164', () => {
    const result = normalizePhoneNumber('+56 9 1234 5678');

    expect(result).toMatchObject({
      e164: '+56912345678',
      valid: true,
      countryCode: '56',
      regionCode: 'CL'
    });
  });

  it('rejects invalid phone input', () => {
    expect(() => normalizePhoneNumber('not-a-phone')).toThrow('Invalid phone number');
  });
});
