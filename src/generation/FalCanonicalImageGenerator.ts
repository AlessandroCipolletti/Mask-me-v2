import type { ProviderClient } from '../provider/ProviderClient';
import { ProviderError } from '../provider/ProviderError';
import {
  buildCanonicalPrompt,
  buildCanonicalSystemPrompt,
  CANONICAL_PROMPT_VERSION,
} from './canonicalPrompt';
import type {
  CanonicalImage,
  CharacterImageGenerator,
  CharacterGeneration,
  GenerationMetadata,
  SourcePhoto,
} from './CharacterImageGenerator';

export const CANONICAL_MODEL_ID = 'google/nano-banana-2.1/edit';
export const LEGACY_CANONICAL_MODEL_ID = 'fal-ai/nano-banana-2/edit';

export function isCanonicalModelId(value: unknown): value is string {
  return value === CANONICAL_MODEL_ID || value === LEGACY_CANONICAL_MODEL_ID;
}
const PARAMETERS = {
  num_images: 1,
  aspect_ratio: '4:5',
  output_format: 'png',
  resolution: '2K',
  limit_generations: true,
  thinking_level: 'medium',
} as const;

function parseImage(value: unknown): CanonicalImage {
  if (!value || typeof value !== 'object' || !('images' in value))
    throw new ProviderError('invalid_response');
  const images = value.images;
  const image = Array.isArray(images) ? images[0] : null;
  if (!image || typeof image !== 'object')
    throw new ProviderError('invalid_response');
  const item = image as Record<string, unknown>;
  const url = item['url'];
  const contentType = item['content_type'];
  if (
    typeof url !== 'string' ||
    (contentType != null &&
      (typeof contentType !== 'string' || !contentType.startsWith('image/')))
  )
    throw new ProviderError('invalid_response');
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ProviderError('invalid_response');
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password)
    throw new ProviderError('invalid_response');
  const width = item['width'];
  const height = item['height'];
  if (width != null && (!Number.isSafeInteger(width) || (width as number) <= 0))
    throw new ProviderError('invalid_response');
  if (
    height != null &&
    (!Number.isSafeInteger(height) || (height as number) <= 0)
  )
    throw new ProviderError('invalid_response');
  return {
    url: parsed.href,
    contentType: typeof contentType === 'string' ? contentType : 'image/png',
    ...(typeof width === 'number' ? { width } : {}),
    ...(typeof height === 'number' ? { height } : {}),
  };
}

export function blobToDataUri(
  blob: Blob,
  signal?: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new ProviderError('cancelled'));
      return;
    }
    const reader = new FileReader();
    const cleanup = () => signal?.removeEventListener('abort', abort);
    const abort = () => reader.abort();
    signal?.addEventListener('abort', abort, { once: true });
    reader.onload = () => {
      cleanup();
      if (signal?.aborted || typeof reader.result !== 'string')
        reject(new ProviderError('cancelled'));
      else resolve(reader.result);
    };
    reader.onerror = () => {
      cleanup();
      reject(new ProviderError('invalid_request'));
    };
    reader.onabort = () => {
      cleanup();
      reject(new ProviderError('cancelled'));
    };
    reader.readAsDataURL(blob);
  });
}

/** Model-specific input/output policy; transport and UI never know its schema. */
export class FalCanonicalImageGenerator implements CharacterImageGenerator {
  constructor(
    private readonly provider: ProviderClient,
    private readonly encode: typeof blobToDataUri = blobToDataUri,
    private readonly now: () => Date = () => new Date(),
  ) {}

  metadataFor(
    sourcePhotoId: string,
    providerRequestId: string,
  ): GenerationMetadata {
    return {
      provider: 'fal',
      modelId: CANONICAL_MODEL_ID,
      promptVersion: CANONICAL_PROMPT_VERSION,
      finalPrompt: buildCanonicalPrompt(),
      parameters: {
        ...PARAMETERS,
        system_prompt: buildCanonicalSystemPrompt(),
      },
      sourcePhotoId,
      timestamp: this.now().toISOString(),
      providerRequestId,
    };
  }

  /** Retrieve a previously submitted edit job without submitting a new one. */
  async recover(
    requestId: string,
    signal?: AbortSignal,
    options?: {
      modelId?: string;
      onPhase?: (
        phase: import('../provider/ProviderClient').ProviderPhase,
      ) => void;
    },
  ): Promise<CanonicalImage> {
    const modelId = options?.modelId ?? CANONICAL_MODEL_ID;
    if (!isCanonicalModelId(modelId))
      throw new ProviderError('invalid_request');
    const result = await this.provider.resume(
      { modelId, parse: parseImage },
      requestId,
      {
        ...(signal ? { signal } : {}),
        ...(options?.onPhase ? { onPhase: options.onPhase } : {}),
      },
    );
    return result.data;
  }

  async generate(
    source: SourcePhoto,
    options: {
      signal?: AbortSignal;
      onPhase?: (
        phase: import('../provider/ProviderClient').ProviderPhase,
      ) => void;
      onSubmitted?: (requestId: string) => void;
    } = {},
  ): Promise<CharacterGeneration> {
    if (
      !source.id ||
      source.width <= 0 ||
      source.height <= 0 ||
      source.blob.size === 0 ||
      source.blob.size > 12_000_000 ||
      !['image/jpeg', 'image/png', 'image/webp'].includes(source.blob.type)
    )
      throw new ProviderError('invalid_request');
    if (options.signal?.aborted) throw new ProviderError('cancelled');
    const imageUri = await this.encode(source.blob, options.signal);
    if (options.signal?.aborted) throw new ProviderError('cancelled');
    const finalPrompt = buildCanonicalPrompt();
    const result = await this.provider.run(
      {
        modelId: CANONICAL_MODEL_ID,
        input: {
          prompt: finalPrompt,
          system_prompt: buildCanonicalSystemPrompt(),
          image_urls: [imageUri],
          ...PARAMETERS,
        },
        parse: parseImage,
      },
      options,
    );
    return {
      image: result.data,
      metadata: this.metadataFor(source.id, result.requestId),
    };
  }
}
