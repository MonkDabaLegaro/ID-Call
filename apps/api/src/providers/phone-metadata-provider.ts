import { normalizePhoneNumber } from '@id-call/phone-domain';

export type PhoneMetadata = {
  e164: string;
  countryCode: string;
  nationalNumber: string;
  regionCode: string | null;
  numberType: string | null;
};

export interface PhoneMetadataProvider {
  readonly name: string;
  lookup(input: string): PhoneMetadata;
}

export class LibPhoneNumberMetadataProvider implements PhoneMetadataProvider {
  readonly name = 'libphonenumber-js';

  lookup(input: string): PhoneMetadata {
    return normalizePhoneNumber(input);
  }
}
