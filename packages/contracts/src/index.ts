export type SourceEvidence = {
  provider: string;
  field: string;
  confidence: number;
  observedAt: string;
};

export type LookupResponse = {
  number: string;
  valid: true;
  countryCode: string;
  nationalNumber: string;
  regionCode: string | null;
  numberType: string | null;
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
