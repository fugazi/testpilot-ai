import { describe, it, expect, beforeEach } from 'vitest';
import { incrementMetric, getMetrics, _resetMetrics } from './metrics';

describe('metrics', () => {
  beforeEach(() => {
    _resetMetrics();
  });

  it('increments isDynamic counter', () => {
    expect(getMetrics().isDynamicScans).toBeUndefined();
    incrementMetric('isDynamicScans');
    expect(getMetrics().isDynamicScans).toBe(1);
    incrementMetric('isDynamicScans', 2);
    expect(getMetrics().isDynamicScans).toBe(3);
  });
});
