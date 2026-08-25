export type ReputationEvidence = {
  weight: number;
  confidence: number;
};

export type ReputationLevel = 'unknown' | 'low' | 'medium' | 'high';

export type ReputationResult = {
  score: number;
  level: ReputationLevel;
  reports: number;
};

export function scoreReputation(evidence: ReputationEvidence[]): ReputationResult {
  if (evidence.length === 0) return { score: 0, level: 'unknown', reports: 0 };

  const score = Math.min(
    1,
    evidence.reduce((sum, item) => sum + item.weight * item.confidence, 0) / evidence.length
  );

  const level: ReputationLevel = score >= 0.75 ? 'high' : score >= 0.4 ? 'medium' : 'low';
  return { score, level, reports: evidence.length };
}
