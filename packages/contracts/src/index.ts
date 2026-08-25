export type SourceEvidence = {
  provider: string;
  field: string;
  confidence: number;
  observedAt: string;
};

export type CallerIdentity = {
  displayName: string;
  identityType: 'verified-business' | 'public-directory';
  verification: 'verified' | 'source-verified';
  confidence: number;
  publicWebsite: string | null;
  publicAddress: string | null;
  expiresAt: string | null;
};

export type LookupResponse = {
  number: string;
  valid: true;
  countryCode: string;
  nationalNumber: string;
  regionCode: string | null;
  numberType: string | null;
  identity: CallerIdentity | null;
  location: {
    label: string | null;
    precision: 'country' | 'numbering-region' | 'unknown';
    disclaimer: string;
  };
  reputation: {
    score: number;
    level: 'unknown' | 'low' | 'medium' | 'high';
    reports: number;
  };
  sources: SourceEvidence[];
  cachedAt: string;
};
