import { describe, expect, it, vi } from 'vitest';
import { FalClient } from './FalClient';
import type { FalDiagnostic } from './FalDiagnostics';
import { ProviderError } from './ProviderError';
import { VolatileCredential } from './VolatileCredential';

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function setup(responses: Response[]) {
  const credential = new VolatileCredential();
  credential.set('  sample-secret  ');
  const fetcher = vi.fn<typeof fetch>(async () => {
    const next = responses.shift();
    if (!next) throw new Error('unexpected request');
    return next;
  });
  return { credential, fetcher, client: new FalClient(credential, fetcher, 0) };
}

describe('FalClient', () => {
  it('checks an authenticated read-only pricing endpoint only after invocation', async () => {
    const { client, fetcher } = setup([
      json({
        prices: [
          { endpoint_id: 'fal-ai/flux/dev', unit: 'image', currency: 'USD' },
        ],
      }),
    ]);
    expect(fetcher).not.toHaveBeenCalled();
    expect(await client.checkConnection()).toEqual({
      endpointId: 'fal-ai/flux/dev',
      unit: 'image',
      currency: 'USD',
    });
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe(
      'https://api.fal.ai/v1/models/pricing?endpoint_id=fal-ai%2Fflux%2Fdev',
    );
    expect(init).toMatchObject({
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    });
    expect((init?.headers as Record<string, string>)['Authorization']).toBe(
      'Key sample-secret',
    );
    expect(String(url)).not.toContain('sample-secret');
  });

  it('calls fetch with the browser global as its receiver', async () => {
    const credential = new VolatileCredential();
    credential.set('sample-secret');
    const fetcher = vi.fn<typeof fetch>(async function (this: unknown) {
      expect(this).toBe(globalThis);
      return json({
        prices: [
          { endpoint_id: 'fal-ai/flux/dev', unit: 'image', currency: 'USD' },
        ],
      });
    });
    await new FalClient(credential, fetcher).checkConnection();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('runs a generic queued job and validates through its model adapter', async () => {
    const { client, fetcher } = setup([
      json({ request_id: 'req_123' }),
      json({ status: 'IN_QUEUE' }),
      json({ status: 'IN_PROGRESS' }),
      json({ status: 'COMPLETED' }),
      json({ value: 7 }),
    ]);
    const phases: string[] = [];
    const result = await client.run(
      {
        modelId: 'fal-ai/example/model',
        input: { prompt: 'fixture' },
        parse(value) {
          if (
            typeof value !== 'object' ||
            value === null ||
            !('value' in value) ||
            typeof value.value !== 'number'
          )
            throw new Error('bad result');
          return value.value;
        },
      },
      { onPhase: (phase) => phases.push(phase) },
    );
    expect(result).toBe(7);
    expect(phases).toEqual(['submitting', 'queued', 'running', 'retrieving']);
    expect(
      fetcher.mock.calls.map(([url, init]) => [String(url), init?.method]),
    ).toEqual([
      ['https://queue.fal.run/fal-ai/example/model', 'POST'],
      [
        'https://queue.fal.run/fal-ai/example/model/requests/req_123/status',
        'GET',
      ],
      [
        'https://queue.fal.run/fal-ai/example/model/requests/req_123/status',
        'GET',
      ],
      [
        'https://queue.fal.run/fal-ai/example/model/requests/req_123/status',
        'GET',
      ],
      ['https://queue.fal.run/fal-ai/example/model/requests/req_123', 'GET'],
    ]);
    expect(fetcher.mock.calls[0]?.[1]?.body).toBe('{"prompt":"fixture"}');
  });

  it('normalizes authentication, quota, rate limit and malformed responses without leaking provider text', async () => {
    for (const [response, code] of [
      [json({ detail: 'sample-secret' }, 401), 'authentication'],
      [
        json(
          { error: { type: 'quota_exceeded', message: 'sample-secret' } },
          403,
        ),
        'quota',
      ],
      [json({ detail: 'sample-secret' }, 429), 'rate_limit'],
      [json({ prices: [] }), 'invalid_response'],
    ] as const) {
      const { client } = setup([response]);
      const failure = await client
        .checkConnection()
        .catch((error: unknown) => error);
      expect(failure).toMatchObject({ code });
      expect(failure).toBeInstanceOf(ProviderError);
      expect((failure as ProviderError).message).not.toContain('sample-secret');
    }
  });

  it('never retries a POST after an ambiguous network failure', async () => {
    const { credential } = setup([]);
    const fetcher = vi.fn<typeof fetch>(async () => {
      throw new TypeError('Failed to fetch');
    });
    const client = new FalClient(credential, fetcher, 0);
    await expect(
      client.run({ modelId: 'fal-ai/example', input: {}, parse: (v) => v }),
    ).rejects.toMatchObject({ code: 'network_or_cors' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('traces a fetch rejection before any HTTP response without exposing the key or raw error', async () => {
    const credential = new VolatileCredential();
    credential.set('sample-secret');
    const events: FalDiagnostic[] = [];
    const fetcher = vi.fn<typeof fetch>(async () => {
      throw new TypeError('Failed to fetch: sample-secret');
    });
    const client = new FalClient(credential, fetcher, 0, (event) =>
      events.push(event),
    );
    await expect(client.checkConnection()).rejects.toMatchObject({
      code: 'network_or_cors',
    });
    expect(events.map((event) => event.step)).toEqual([
      'fetch_start',
      'request_failed',
    ]);
    expect(events[1]).toMatchObject({
      operation: 'pricing_check',
      method: 'GET',
      errorCode: 'network_or_cors',
      browserFailure: 'failed_to_fetch',
    });
    expect(events[1]?.status).toBeUndefined();
    expect(JSON.stringify(events)).not.toContain('sample-secret');
  });

  it('traces an HTTP rejection with status and normalized code', async () => {
    const credential = new VolatileCredential();
    credential.set('sample-secret');
    const events: FalDiagnostic[] = [];
    const client = new FalClient(
      credential,
      vi.fn<typeof fetch>(async () => json({ detail: 'sample-secret' }, 401)),
      0,
      (event) => events.push(event),
    );
    await expect(client.checkConnection()).rejects.toMatchObject({
      code: 'authentication',
    });
    expect(events.map((event) => event.step)).toEqual([
      'fetch_start',
      'response_received',
      'request_failed',
    ]);
    expect(events[2]).toMatchObject({
      status: 401,
      errorCode: 'authentication',
    });
    expect(JSON.stringify(events)).not.toContain('sample-secret');
  });

  it('makes a best-effort cancel call after a queued request is locally aborted', async () => {
    const { credential } = setup([]);
    const controller = new AbortController();
    const fetcher = vi.fn<typeof fetch>(async (url) => {
      if (String(url).endsWith('/cancel'))
        return new Response(null, { status: 204 });
      if (String(url).endsWith('/status')) {
        controller.abort();
        return json({ status: 'IN_QUEUE' });
      }
      return json({ request_id: 'req_1' });
    });
    const client = new FalClient(credential, fetcher, 0);
    await expect(
      client.run(
        { modelId: 'fal-ai/example', input: {}, parse: (v) => v },
        { signal: controller.signal },
      ),
    ).rejects.toMatchObject({ code: 'cancelled' });
    expect(
      fetcher.mock.calls.some(
        ([url, init]) =>
          String(url).endsWith('/requests/req_1/cancel') &&
          init?.method === 'PUT',
      ),
    ).toBe(true);
  });

  it('clears the credential and rejects unsafe key input', async () => {
    const credential = new VolatileCredential();
    expect(() => credential.set('bad\nkey')).toThrow();
    expect(() => credential.set('bad\u200bkey')).toThrow();
    credential.set('sample-secret');
    credential.clear();
    expect(credential.ready).toBe(false);
    const client = new FalClient(credential, vi.fn<typeof fetch>());
    await expect(client.checkConnection()).rejects.toMatchObject({
      code: 'missing_key',
    });
  });
});
