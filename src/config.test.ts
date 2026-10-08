import { describe, expect, it } from 'vitest';
import { readConfig } from './config';

describe('public configuration', () => {
  it('uses fal as the initial provider without requiring a credential', () => {
    expect(readConfig({ mode: 'production', provider: undefined })).toEqual({
      mode: 'production',
      debug: false,
      provider: 'fal',
    });
  });

  it('keeps debug builds distinct from production builds', () => {
    expect(readConfig({ mode: 'debug', provider: 'fal' }).debug).toBe(true);
    expect(readConfig({ mode: 'development', provider: 'fal' }).debug).toBe(
      true,
    );
  });

  it('rejects unsupported public configuration', () => {
    expect(() => readConfig({ mode: 'staging', provider: 'fal' })).toThrow(
      'Unsupported application mode',
    );
    expect(() =>
      readConfig({ mode: 'production', provider: 'unknown' }),
    ).toThrow('Unsupported provider');
  });
});
