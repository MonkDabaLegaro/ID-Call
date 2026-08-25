export interface EnrichmentJob {
  e164: string;
  requestedAt: string;
}

export interface EnrichmentProvider {
  readonly name: string;
  enrich(job: EnrichmentJob): Promise<void>;
}

export function assertSafeEnrichmentJob(job: EnrichmentJob): void {
  if (!job.e164.startsWith('+')) throw new Error('Enrichment jobs require normalized E.164 numbers');
}
