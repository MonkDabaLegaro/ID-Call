import { describe, expect, it } from 'vitest';
import { scoreReputation } from './index.js';

describe('scoreReputation', () => {
  it('returns unknown when no reports exist', () => {
    expect(scoreReputation([])).toEqual({ score: 0, level: 'unknown', reports: 0 });
  });

  it('weights trusted recent reports more strongly', () => {
    const result = scoreReputation([
      { weight: 1, confidence: 0.9 },
      { weight: 1, confidence: 0.8 }
    ]);

    expect(result.level).toBe('high');
    expect(result.reports).toBe(2);
  });
});
