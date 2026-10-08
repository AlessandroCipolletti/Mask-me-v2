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
    expect(result).toEqual({ data: 7, requestId: 'req_123' });
    expect(phases).toEqual(['submitting', 'queued', 'running', 'retrieving']);
    expect(
      fetcher.mock.calls.map(([url, init]) => [String(url), init?.method]),
    ).toEqual([
      ['https://queue.fal.run/fal-ai/example/model', 'POST'],
      ['https://queue.fal.run/fal-ai/example/requests/req_123/status', 'GET'],
      ['https://queue.fal.run/fal-ai/example/requests/req_123/status', 'GET'],
      ['https://queue.fal.run/fal-ai/example/requests/req_123/status', 'GET'],
      ['https://queue.fal.run/fal-ai/example/requests/req_123', 'GET'],
    ]);
    expect(fetcher.mock.calls[0]?.[1]?.body).toBe('{"prompt":"fixture"}');
  });

  it('treats HTTP 202 status as a pending job and logs only safe queue state', async () => {
    const credential = new VolatileCredential();
    credential.set('sample-secret');
    const events: FalDiagnostic[] = [];
    const responses = [
      json(
        {
          status: 'IN_QUEUE',
          queue_position: 3,
          logs: [{ message: 'https://private.example/source.png' }],
        },
        202,
      ),
      json({ status: 'IN_PROGRESS' }, 202),
      json({ status: 'COMPLETED' }),
      json({ model_mesh: { url: 'https://fal.media/head.glb' } }),
    ];
    const fetcher = vi.fn<typeof fetch>(async () => responses.shift()!);
    const client = new FalClient(credential, fetcher, 0, (event) =>
      events.push(event),
    );
    const result = await client.resume(
      { modelId: 'hitem3d/hi3d/multi-view-to-3d', parse: (value) => value },
      'portrait_1',
    );
    expect(result.data).toMatchObject({
      model_mesh: { url: expect.any(String) },
    });
    expect(
      events.filter((event) => event.step === 'queue_state'),
    ).toMatchObject([
      { queueState: 'IN_QUEUE', queuePosition: 3 },
      { queueState: 'IN_PROGRESS' },
      { queueState: 'COMPLETED' },
    ]);
    expect(JSON.stringify(events)).not.toContain('private.example');
    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
      'https://queue.fal.run/hitem3d/hi3d/requests/portrait_1/status',
      'https://queue.fal.run/hitem3d/hi3d/requests/portrait_1/status',
      'https://queue.fal.run/hitem3d/hi3d/requests/portrait_1/status',
      'https://queue.fal.run/hitem3d/hi3d/requests/portrait_1',
    ]);
  });

  it('polls Nano Banana edit jobs through the app alias, never the /edit endpoint', async () => {
    const { client, fetcher } = setup([
      json({ request_id: 'req_edit' }),
      json({ status: 'COMPLETED' }),
      json({ images: [{ url: 'https://fal.media/result.png' }] }),
    ]);
    await client.run({
      modelId: 'fal-ai/nano-banana-2/edit',
      input: { prompt: 'fixture' },
      parse: (value) => value,
    });
    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
      'https://queue.fal.run/fal-ai/nano-banana-2/edit',
      'https://queue.fal.run/fal-ai/nano-banana-2/requests/req_edit/status',
      'https://queue.fal.run/fal-ai/nano-banana-2/requests/req_edit',
    ]);
  });

  it('routes Nano Banana 2.1 edit status and result through its app alias', async () => {
    const { client, fetcher } = setup([
      json({ request_id: 'req_21' }),
      json({ status: 'COMPLETED' }),
      json({ images: [{ url: 'https://fal.media/result.png' }] }),
    ]);
    await client.run({
      modelId: 'google/nano-banana-2.1/edit',
      input: { prompt: 'fixture' },
      parse: (value) => value,
    });
    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
      'https://queue.fal.run/google/nano-banana-2.1/edit',
      'https://queue.fal.run/google/nano-banana-2.1/requests/req_21/status',
      'https://queue.fal.run/google/nano-banana-2.1/requests/req_21',
    ]);
  });

  it('resumes an existing edit job with only read requests', async () => {
    const { client, fetcher } = setup([
      json({ status: 'COMPLETED' }),
      json({ images: [{ url: 'https://fal.media/recovered.png' }] }),
    ]);
    const result = await client.resume(
      { modelId: 'fal-ai/nano-banana-2/edit', parse: (value) => value },
      'existing_123',
    );
    expect(result.requestId).toBe('existing_123');
    expect(
      fetcher.mock.calls.map(([url, init]) => [String(url), init?.method]),
    ).toEqual([
      [
        'https://queue.fal.run/fal-ai/nano-banana-2/requests/existing_123/status',
        'GET',
      ],
      [
        'https://queue.fal.run/fal-ai/nano-banana-2/requests/existing_123',
        'GET',
      ],
    ]);
  });

  it('recovers a queued 3D result after an HTML gateway timeout without another submit', async () => {
    const { client, fetcher } = setup([
      json({ request_id: 'existing_3d' }),
      json({ status: 'COMPLETED' }),
      new Response('<html>Gateway Timeout</html>', { status: 504 }),
      json({ model_glb: { url: 'https://fal.media/head.glb' } }),
    ]);
    const result = await client.run({
      modelId: 'fal-ai/hunyuan-3d/v3.1/pro/image-to-3d',
      input: { input_image_url: 'https://fal.media/front.png' },
      parse: (value) => value,
    });
    expect(result.requestId).toBe('existing_3d');
    expect(
      fetcher.mock.calls.map(([url, init]) => [String(url), init?.method]),
    ).toEqual([
      ['https://queue.fal.run/fal-ai/hunyuan-3d/v3.1/pro/image-to-3d', 'POST'],
      [
        'https://queue.fal.run/fal-ai/hunyuan-3d/requests/existing_3d/status',
        'GET',
      ],
      ['https://queue.fal.run/fal-ai/hunyuan-3d/requests/existing_3d', 'GET'],
      ['https://queue.fal.run/fal-ai/hunyuan-3d/requests/existing_3d', 'GET'],
    ]);
  });

  it('keeps a timed-out result recoverable after bounded GET retries', async () => {
    const credential = new VolatileCredential();
    credential.set('sample-secret');
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response('<html>Gateway Timeout</html>', { status: 504 }),
    );
    const client = new FalClient(credential, fetcher, 0);
    await expect(
      client.resume(
        { modelId: 'fal-ai/hunyuan-3d/v3.1/pro/image-to-3d', parse: (v) => v },
        'existing_3d',
      ),
    ).rejects.toMatchObject({ code: 'provider_unavailable', status: 504 });
    expect(fetcher).toHaveBeenCalledTimes(13);
    expect(fetcher.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(
      true,
    );
  });

  it('stops retrying a terminal downstream failure without exposing submitted images', async () => {
    const credential = new VolatileCredential();
    credential.set('sample-secret');
    const events: FalDiagnostic[] = [];
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ request_id: 'existing_3d' }))
      .mockResolvedValueOnce(json({ status: 'COMPLETED' }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            detail: [
              {
                type: 'downstream_service_unavailable',
                msg: 'Downstream service unavailable',
                input: { input_image_url: 'https://private.example/face.png' },
              },
            ],
          }),
          {
            status: 504,
            headers: { 'X-Fal-Needs-Retry': 'false' },
          },
        ),
      );
    const client = new FalClient(credential, fetcher, 0, (event) =>
      events.push(event),
    );
    const failure = await client
      .run({
        modelId: 'fal-ai/hunyuan-3d/v3.1/pro/image-to-3d',
        input: { input_image_url: 'https://private.example/face.png' },
        parse: (value) => value,
      })
      .catch((error: unknown) => error);
    expect(failure).toMatchObject({
      code: 'downstream_unavailable',
      status: 504,
      retryable: false,
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(events)).not.toContain('private.example');
    expect((failure as ProviderError).message).not.toContain('private.example');
  });

  it('waits five seconds between status checks by default', async () => {
    vi.useFakeTimers();
    try {
      const credential = new VolatileCredential();
      credential.set('sample-secret');
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(json({ status: 'IN_QUEUE' }))
        .mockResolvedValueOnce(json({ status: 'COMPLETED' }))
        .mockResolvedValueOnce(json({ value: 7 }));
      const client = new FalClient(credential, fetcher);
      const pending = client.resume(
        { modelId: 'fal-ai/example', parse: (value) => value },
        'req_123',
      );
      await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
      await vi.advanceTimersByTimeAsync(4_999);
      expect(fetcher).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      await pending;
      expect(fetcher).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops a recovery locally without cancelling the original job', async () => {
    const credential = new VolatileCredential();
    credential.set('sample-secret');
    const controller = new AbortController();
    const fetcher = vi.fn<typeof fetch>(async () => {
      controller.abort();
      return json({ status: 'IN_QUEUE' });
    });
    const client = new FalClient(credential, fetcher, 0);
    await expect(
      client.resume(
        { modelId: 'fal-ai/nano-banana-2/edit', parse: (value) => value },
        'existing_123',
        { signal: controller.signal },
      ),
    ).rejects.toMatchObject({ code: 'cancelled' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[1]?.method).toBe('GET');
  });

  it('does not retry a 405 method mismatch while polling', async () => {
    const { client, fetcher } = setup([
      json({ request_id: 'req_edit' }),
      json({ detail: 'Method Not Allowed' }, 405),
    ]);
    await expect(
      client.run({
        modelId: 'fal-ai/nano-banana-2/edit',
        input: {},
        parse: (value) => value,
      }),
    ).rejects.toMatchObject({ code: 'provider_protocol', status: 405 });
    expect(fetcher).toHaveBeenCalledTimes(2);
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
        { modelId: 'fal-ai/nano-banana-2/edit', input: {}, parse: (v) => v },
        { signal: controller.signal },
      ),
    ).rejects.toMatchObject({ code: 'cancelled' });
    expect(
      fetcher.mock.calls.some(
        ([url, init]) =>
          String(url) ===
            'https://queue.fal.run/fal-ai/nano-banana-2/requests/req_1/cancel' &&
          init?.method === 'PUT',
      ),
    ).toBe(true);
  });

  it('retains a submitted job across pagehide without sending remote cancel', async () => {
    const { credential } = setup([]);
    const controller = new AbortController();
    const submitted: string[] = [];
    const fetcher = vi.fn<typeof fetch>(async (url) => {
      if (String(url).endsWith('/status')) {
        controller.abort('pagehide');
        return json({ status: 'IN_QUEUE' });
      }
      return json({ request_id: 'req_keep' });
    });
    const client = new FalClient(credential, fetcher, 0);
    await expect(
      client.run(
        { modelId: 'fal-ai/nano-banana-2/edit', input: {}, parse: (v) => v },
        {
          signal: controller.signal,
          onSubmitted: (id) => submitted.push(id),
        },
      ),
    ).rejects.toMatchObject({ code: 'cancelled' });
    expect(submitted).toEqual(['req_keep']);
    expect(fetcher.mock.calls.map((call) => call[1]?.method)).toEqual([
      'POST',
      'GET',
    ]);
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
