import { parsePhoneNumberFromString } from 'libphonenumber-js';

export type PhoneMetadata = {
  e164: string;
  countryCode: string;
  nationalNumber: string;
  regionCode: string | null;
  numberType: string | null;
};

export function normalizePhoneNumber(input: string): PhoneMetadata {
  const parsed = parsePhoneNumberFromString(input);
  if (!parsed || !parsed.isValid()) throw new Error('Invalid phone number');

  return {
    e164: parsed.number,
    countryCode: parsed.countryCallingCode,
    nationalNumber: parsed.nationalNumber,
    regionCode: parsed.country ?? null,
    numberType: parsed.getType() ?? null
  };
}
