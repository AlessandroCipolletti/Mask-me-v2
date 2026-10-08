import { describe, expect, it } from 'vitest';
import { CanonicalSession } from './CanonicalSession';
import type {
  CharacterGeneration,
  CharacterImageGenerator,
  SourcePhoto,
} from './CharacterImageGenerator';

const source: SourcePhoto = {
  id: 'capture-1',
  blob: new Blob(['x'], { type: 'image/jpeg' }),
  width: 1,
  height: 1,
};
const result: CharacterGeneration = {
  image: { url: 'https://fal.media/a.png', contentType: 'image/png' },
  metadata: {
    provider: 'fal',
    modelId: 'm',
    promptVersion: 'v',
    finalPrompt: 'p',
    parameters: {},
    sourcePhotoId: 'capture-1',
    timestamp: 't',
    providerRequestId: 'r',
  },
};

describe('CanonicalSession', () => {
  it('reviews, generates, retains the photo, returns and retakes deterministically', async () => {
    const generator: CharacterImageGenerator = {
      generate: async () => result,
      recover: async () => result.image,
    };
    const session = new CanonicalSession(generator);
    session.review(source);
    expect(session.state.step).toBe('photoReview');
    await session.generate();
    expect(session.state).toMatchObject({
      step: 'characterReview',
      source,
      result,
    });
    session.backToPhoto();
    expect(session.state).toMatchObject({ step: 'photoReview', source });
    session.retake();
    expect(session.state).toMatchObject({
      step: 'camera',
      source: null,
      result: null,
    });
  });

  it('prevents overlap and ignores a result after cancellation', async () => {
    let resolve!: (value: CharacterGeneration) => void;
    let calls = 0;
    const generator: CharacterImageGenerator = {
      recover: async () => result.image,
      generate: () => {
        calls++;
        return new Promise((r) => {
          resolve = r;
        });
      },
    };
    const session = new CanonicalSession(generator);
    session.review(source);
    const pending = session.generate();
    await session.generate();
    expect(calls).toBe(1);
    session.cancel();
    resolve(result);
    await pending;
    expect(session.state).toMatchObject({
      step: 'photoReview',
      result: null,
      source,
    });
  });

  it('preserves the previous result when regeneration fails', async () => {
    let calls = 0;
    const generator: CharacterImageGenerator = {
      recover: async () => result.image,
      generate: async () => {
        if (++calls === 1) return result;
        throw new Error('sensitive raw failure');
      },
    };
    const session = new CanonicalSession(generator);
    session.review(source);
    await session.generate();
    await session.generate();
    expect(session.state.step).toBe('characterReview');
    expect(session.state.result).toBe(result);
    expect(session.state.error).not.toContain('sensitive raw failure');
  });

  it('publishes the submitted ID and resumes an existing job without generate', async () => {
    let submitted!: (requestId: string) => void;
    let complete!: (value: CharacterGeneration) => void;
    let generateCalls = 0;
    const recoveredModels: string[] = [];
    const generator: CharacterImageGenerator = {
      generate: (_source, options) => {
        generateCalls++;
        submitted = options!.onSubmitted!;
        return new Promise((resolve) => {
          complete = resolve;
        });
      },
      recover: async (_requestId, _signal, options) => {
        recoveredModels.push(options?.modelId ?? '');
        return result.image;
      },
    };
    const session = new CanonicalSession(generator);
    session.review(source);
    const original = session.generate();
    submitted('req_123');
    expect(session.state).toMatchObject({
      step: 'generating',
      requestId: 'req_123',
    });
    session.cancel('pagehide');
    expect(session.state.requestId).toBe('req_123');
    complete(result);
    await original;

    await session.recover('req_123', source, result.metadata);
    expect(generateCalls).toBe(1);
    expect(recoveredModels).toEqual([result.metadata.modelId]);
    expect(session.state).toMatchObject({
      step: 'characterReview',
      result,
      requestId: null,
    });
  });
});
