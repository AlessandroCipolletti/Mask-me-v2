import type { ProviderClient } from '../provider/ProviderClient';
import { ProviderError } from '../provider/ProviderError';
import type { CharacterGeneration } from './CharacterImageGenerator';
import {
  CANONICAL_MODEL_ID,
  parseFalImage,
} from './FalCanonicalImageGenerator';
import type {
  ViewGeneration,
  ViewGenerationMetadata,
  ViewImageGenerator,
} from './ViewImageGenerator';
import {
  buildViewPrompt,
  buildViewSystemPrompt,
  type GeneratedViewId,
  VIEW_IDS,
  VIEW_PROMPT_VERSION,
} from './viewPrompts';

const PARAMETERS = {
  num_images: 1,
  aspect_ratio: '4:5',
  output_format: 'png',
  resolution: '2K',
  limit_generations: true,
  thinking_level: 'medium',
} as const;

function safeReference(reference: CharacterGeneration): string {
  const url = reference.image.url;
  if (reference.image.contentType.startsWith('image/')) {
    try {
      const parsed = new URL(url);
      if (
        parsed.protocol === 'https:' &&
        !parsed.username &&
        !parsed.password &&
        reference.metadata.providerRequestId
      )
        return parsed.href;
    } catch {
      // An invalid canonical URL cannot be submitted to fal.
    }
  }
  throw new ProviderError('invalid_request');
}

/** All five edit requests take the same M4 canonical URL, never a generated view. */
export class FalViewImageGenerator implements ViewImageGenerator {
  constructor(
    private readonly provider: ProviderClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  metadataFor(
    reference: CharacterGeneration,
    view: GeneratedViewId,
    requestId: string,
  ): ViewGenerationMetadata {
    if (!VIEW_IDS.includes(view)) throw new ProviderError('invalid_request');
    return {
      provider: 'fal',
      modelId: CANONICAL_MODEL_ID,
      promptVersion: VIEW_PROMPT_VERSION,
      finalPrompt: buildViewPrompt(view),
      parameters: { ...PARAMETERS, system_prompt: buildViewSystemPrompt() },
      referenceRequestId: reference.metadata.providerRequestId,
      view,
      timestamp: this.now().toISOString(),
      providerRequestId: requestId,
    };
  }

  async generate(
    reference: CharacterGeneration,
    view: GeneratedViewId,
    options: {
      signal?: AbortSignal;
      onPhase?: (
        phase: import('../provider/ProviderClient').ProviderPhase,
      ) => void;
      onSubmitted?: (requestId: string) => void;
    } = {},
  ): Promise<ViewGeneration> {
    if (!VIEW_IDS.includes(view)) throw new ProviderError('invalid_request');
    const referenceUrl = safeReference(reference);
    const result = await this.provider.run(
      {
        modelId: CANONICAL_MODEL_ID,
        input: {
          prompt: buildViewPrompt(view),
          system_prompt: buildViewSystemPrompt(),
          image_urls: [referenceUrl],
          ...PARAMETERS,
        },
        parse: parseFalImage,
      },
      options,
    );
    return {
      image: result.data,
      metadata: this.metadataFor(reference, view, result.requestId),
    };
  }

  async recover(
    metadata: ViewGenerationMetadata,
    signal?: AbortSignal,
    onPhase?: (
      phase: import('../provider/ProviderClient').ProviderPhase,
    ) => void,
  ) {
    if (
      metadata.modelId !== CANONICAL_MODEL_ID ||
      !VIEW_IDS.includes(metadata.view) ||
      !/^[a-zA-Z0-9_-]+$/.test(metadata.providerRequestId)
    )
      throw new ProviderError('invalid_request');
    const result = await this.provider.resume(
      { modelId: metadata.modelId, parse: parseFalImage },
      metadata.providerRequestId,
      {
        ...(signal ? { signal } : {}),
        ...(onPhase ? { onPhase } : {}),
      },
    );
    return result.data;
  }
}
