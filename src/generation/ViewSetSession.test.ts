import { describe, expect, it, vi } from 'vitest';
import type { CharacterGeneration } from './CharacterImageGenerator';
import type {
  ViewGeneration,
  ViewGenerationMetadata,
  ViewImageGenerator,
} from './ViewImageGenerator';
import { ViewSetSession, viewSetReady } from './ViewSetSession';
import type { GeneratedViewId } from './viewPrompts';

const reference: CharacterGeneration = {
  image: { url: 'https://fal.media/front.png', contentType: 'image/png' },
  metadata: {
    provider: 'fal',
    modelId: 'google/nano-banana-2.1/edit',
    promptVersion: 'canonical-v8',
    finalPrompt: 'front',
    parameters: {},
    sourcePhotoId: 'photo',
    timestamp: '2026-01-01T00:00:00Z',
    providerRequestId: 'front_1',
  },
};

function metadataFor(
  view: GeneratedViewId,
  requestId: string,
): ViewGenerationMetadata {
  return {
    provider: 'fal',
    modelId: 'google/nano-banana-2.1/edit',
    promptVersion: 'multiview-v1',
    finalPrompt: view,
    parameters: {},
    referenceRequestId: 'front_1',
    view,
    timestamp: '2026-01-01T00:00:00Z',
    providerRequestId: requestId,
  };
}

function result(view: GeneratedViewId): ViewGeneration {
  return {
    image: {
      url: `https://fal.media/${view}.png`,
      contentType: 'image/png',
      width: 1024,
      height: 1280,
    },
    metadata: metadataFor(view, `req_${view}`),
  };
}

describe('ViewSetSession', () => {
  it('limits full-set concurrency to two, keeps successes and retries one failed view', async () => {
    let active = 0;
    let peak = 0;
    const calls: GeneratedViewId[] = [];
    const failed = new Set<GeneratedViewId>(['left90']);
    const generator: ViewImageGenerator = {
      metadataFor: (_reference, view, requestId) =>
        metadataFor(view, requestId),
      generate: async (_reference, view) => {
        calls.push(view);
        active++;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active--;
        if (failed.delete(view)) throw new Error('fixture failure');
        return result(view);
      },
      recover: vi.fn(),
    };
    const session = new ViewSetSession(generator);
    session.start(reference);
    await session.generateMissing();
    expect(peak).toBeLessThanOrEqual(2);
    expect(calls).toHaveLength(5);
    expect(session.state.views.left90.status).toBe('failed');
    expect(session.state.views.back180.status).toBe('ready');
    await session.retry('left90');
    expect(calls).toHaveLength(6);
    expect(calls[5]).toBe('left90');
    expect(session.state.views.back180.result).toEqual(result('back180'));
    for (const view of calls.slice(0, 5)) session.review(view, 'accepted');
    expect(viewSetReady(session.state)).toBe(true);
  });

  it('resumes acknowledged requests without another generation call', async () => {
    const run = vi.fn();
    const recover = vi.fn(async (metadata: ViewGenerationMetadata) => ({
      url: `https://fal.media/${metadata.view}.png`,
      contentType: 'image/png',
    }));
    const generator: ViewImageGenerator = {
      metadataFor: (_reference, view, requestId) =>
        metadataFor(view, requestId),
      generate: run,
      recover,
    };
    const session = new ViewSetSession(generator);
    session.start(reference);
    const old = session.state.views.frontLeft45;
    session.restore({
      ...session.state,
      views: {
        ...session.state.views,
        frontLeft45: {
          ...old,
          status: 'generating',
          pendingMetadata: metadataFor('frontLeft45', 'known_1'),
        },
      },
    });
    expect(session.state.views.frontLeft45.status).toBe('paused');
    await session.resumePending();
    expect(run).not.toHaveBeenCalled();
    expect(recover).toHaveBeenCalledTimes(1);
    expect(session.state.views.frontLeft45.status).toBe('ready');
  });

  it('requires an explicit forget before replacing an acknowledged request', async () => {
    const run = vi.fn(async () => result('back180'));
    const generator: ViewImageGenerator = {
      metadataFor: (_reference, view, requestId) =>
        metadataFor(view, requestId),
      generate: run,
      recover: vi.fn(),
    };
    const session = new ViewSetSession(generator);
    session.start(reference);
    session.restore({
      ...session.state,
      views: {
        ...session.state.views,
        back180: {
          ...session.state.views.back180,
          status: 'paused',
          pendingMetadata: metadataFor('back180', 'known_2'),
        },
      },
    });
    await session.retry('back180');
    expect(run).not.toHaveBeenCalled();
    session.forgetPending('back180');
    await session.retry('back180');
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('requires visual acceptance and blocks structurally invalid views', () => {
    const generator: ViewImageGenerator = {
      metadataFor: (_reference, view, requestId) =>
        metadataFor(view, requestId),
      generate: vi.fn(),
      recover: vi.fn(),
    };
    const session = new ViewSetSession(generator);
    session.start(reference);
    const invalid = result('left90');
    session.restore({
      ...session.state,
      views: {
        ...session.state.views,
        left90: {
          ...session.state.views.left90,
          status: 'ready',
          result: invalid,
          qualityReasons: ['resolution_too_low'],
        },
      },
    });
    session.review('left90', 'accepted');
    expect(session.state.views.left90.review).toBe('pending');
    session.reportDimensions('left90', 1024, 1280);
    session.review('left90', 'accepted');
    expect(session.state.views.left90.review).toBe('accepted');
    expect(viewSetReady(session.state)).toBe(false);
  });

  it('pauses acknowledged work while leaving unsent angles empty', async () => {
    const generator: ViewImageGenerator = {
      metadataFor: (_reference, view, requestId) =>
        metadataFor(view, requestId),
      generate: async (_reference, view, options) => {
        options?.onSubmitted?.(`known_${view}`);
        await new Promise<void>((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () =>
            reject(new Error('stopped')),
          );
        });
        return result(view);
      },
      recover: vi.fn(),
    };
    const session = new ViewSetSession(generator);
    session.start(reference);
    const batch = session.generateMissing();
    session.pause();
    await batch;
    expect(session.state.views.frontLeft45.status).toBe('paused');
    expect(session.state.views.left90.status).toBe('paused');
    expect(session.state.views.frontRight45.status).toBe('empty');
    expect(
      session.state.views.frontLeft45.pendingMetadata?.providerRequestId,
    ).toBe('known_frontLeft45');
  });
});
