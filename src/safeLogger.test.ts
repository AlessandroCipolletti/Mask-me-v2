import { describe, expect, it, vi } from 'vitest';
import { createSafeLogger } from './safeLogger';

describe('safe logger', () => {
  it('never emits in production', () => {
    const sink = vi.fn();
    createSafeLogger(false, sink)('app_boot');
    expect(sink).not.toHaveBeenCalled();
  });

  it('emits only fixed event names and finite numeric metrics, even for untyped input', () => {
    const sink = vi.fn();
    const log = createSafeLogger(true, sink);
    const untrustedMetrics = {
      durationMs: 12,
      count: Number.POSITIVE_INFINITY,
      apiKey: 'secret-credential',
    };
    log('app_boot', untrustedMetrics);
    log('secret-credential' as 'app_boot', { count: 1 });
    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink).toHaveBeenCalledWith({ event: 'app_boot', durationMs: 12 });
    expect(JSON.stringify(sink.mock.calls)).not.toContain('secret-credential');
  });
});
