import { describe, expect, it } from 'vitest';

import {
  createReviewRecordsForScenario,
  initialPlanRevision,
  initialReviewRecords,
  initialScenario,
} from './demo-data';
import { createMaterialRevision, inspectPlanReviews, routeScenario } from './routing-policy';

describe('routeScenario', () => {
  it('keeps Codex-native work inside Codex with a fresh independent reviewer session', () => {
    const decision = routeScenario(initialScenario);

    expect(decision).not.toBeNull();
    expect(decision?.writer).toMatchObject({ provider: 'codex', model: 'Terra', role: 'writer' });
    expect(decision?.reviewer).toMatchObject({ provider: 'codex', model: 'Sol', role: 'reviewer' });
    expect(decision?.reviewerIndependence).toBe('fresh-session');
    expect(decision?.fallback).toContain('Codex-native is active');
  });

  it('uses Claude and Codex only when the task explicitly starts in Claude-adaptive mode', () => {
    const decision = routeScenario({
      ...initialScenario,
      orchestrationMode: 'claude-adaptive',
      workClass: 'architecture',
      risk: 'critical',
    });

    expect(decision?.writer).toMatchObject({ provider: 'claude', model: 'Opus', role: 'writer' });
    expect(decision?.reviewer).toMatchObject({ provider: 'codex', model: 'Sol', role: 'reviewer' });
    expect(decision?.safetyLane).toBe('critical');
  });

  it('makes the Claude-adaptive fallback explicit when Codex is unavailable', () => {
    const decision = routeScenario({
      ...initialScenario,
      orchestrationMode: 'claude-adaptive',
      availability: { claude: true, codex: false },
    });

    expect(decision?.writer.provider).toBe('claude');
    expect(decision?.reviewer.provider).toBe('claude');
    expect(decision?.reviewerIndependence).toBe('fresh-session');
    expect(decision?.fallback).toContain('Codex is unavailable');
  });

  it('never promotes Codex-native work into a Claude session when Codex is unavailable', () => {
    expect(
      routeScenario({
        ...initialScenario,
        availability: { claude: true, codex: false },
      }),
    ).toBeNull();
  });

  it('makes a model-tier fallback explicit when the preferred model is unavailable', () => {
    const decision = routeScenario({
      ...initialScenario,
      orchestrationMode: 'claude-adaptive',
      workClass: 'architecture',
      risk: 'critical',
      unavailableModel: 'Opus',
    });

    expect(decision?.writer).toMatchObject({ provider: 'claude', model: 'Sonnet' });
    expect(decision?.fallback).toContain('Opus is unavailable');
  });

  it('does not manufacture a route when the task lacks context', () => {
    expect(routeScenario({ ...initialScenario, brief: 'fix' })).toBeNull();
  });
});

describe('inspectPlanReviews', () => {
  it('requires reviews that match the same frozen revision', () => {
    expect(inspectPlanReviews(initialPlanRevision, initialReviewRecords).status).toBe('ready');

    const revisedPlan = createMaterialRevision(initialPlanRevision);
    const audit = inspectPlanReviews(revisedPlan, initialReviewRecords);

    expect(audit.status).toBe('stale');
    expect(audit.currentReviews).toHaveLength(0);
    expect(audit.staleReviews).toHaveLength(2);
  });

  it('does not mark a plan ready when only one provider review is available', () => {
    const fallbackScenario = {
      ...initialScenario,
      availability: { claude: false, codex: true },
    };

    const reviews = createReviewRecordsForScenario(fallbackScenario);
    const audit = inspectPlanReviews(initialPlanRevision, reviews);

    expect(audit.status).toBe('needs-review');
    expect(audit.currentReviews.map((review) => review.provider)).toEqual(['codex']);
  });
});
