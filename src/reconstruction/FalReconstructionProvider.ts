import type { ViewSetState } from '../generation/ViewSetSession';
import { viewSetReady } from '../generation/ViewSetSession';
import type { ProviderClient } from '../provider/ProviderClient';
import { ProviderError } from '../provider/ProviderError';
import type {
  ReconstructionAsset,
  ReconstructionMetadata,
  ReconstructionProvider,
  ReconstructionResult,
} from './ReconstructionProvider';

export const RECONSTRUCTION_MODEL_ID = 'fal-ai/hunyuan-3d/v3.1/pro/image-to-3d';
const PARAMETERS = { generate_type: 'Normal', face_count: 500000 } as const;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ProviderError('invalid_response');
  return value as Record<string, unknown>;
}

function httpsUrl(value: unknown): string {
  if (typeof value !== 'string') throw new ProviderError('invalid_response');
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password)
      return url.href;
  } catch {
    // Invalid provider URL.
  }
  throw new ProviderError('invalid_response');
}

export function parseFalReconstruction(value: unknown): {
  asset: ReconstructionAsset;
  seed?: number;
} {
  const output = record(value);
  const model = record(output['model_glb']);
  const asset: ReconstructionAsset = {
    url: httpsUrl(model['url']),
    contentType:
      typeof model['content_type'] === 'string' ? model['content_type'] : null,
    fileName:
      typeof model['file_name'] === 'string' ? model['file_name'] : null,
    fileSize:
      typeof model['file_size'] === 'number' &&
      Number.isSafeInteger(model['file_size']) &&
      model['file_size'] > 0
        ? model['file_size']
        : null,
  };
  if (asset.fileName && !asset.fileName.toLowerCase().endsWith('.glb'))
    throw new ProviderError('invalid_response');
  const seed = output['seed'];
  return {
    asset,
    ...(typeof seed === 'number' && Number.isSafeInteger(seed) ? { seed } : {}),
  };
}

function input(views: ViewSetState): {
  inputUrls: Record<string, string>;
  viewRequestIds: Record<string, string>;
} {
  if (!viewSetReady(views) || !views.reference)
    throw new ProviderError('invalid_request');
  const urls = {
    input_image_url: views.reference.image.url,
    left_front_image_url: views.views.frontLeft45.result!.image.url,
    left_image_url: views.views.left90.result!.image.url,
    right_front_image_url: views.views.frontRight45.result!.image.url,
    right_image_url: views.views.right90.result!.image.url,
    back_image_url: views.views.back180.result!.image.url,
  };
  for (const url of Object.values(urls)) httpsUrl(url);
  return {
    inputUrls: urls,
    viewRequestIds: {
      front: views.reference.metadata.providerRequestId,
      frontLeft45: views.views.frontLeft45.result!.metadata.providerRequestId,
      left90: views.views.left90.result!.metadata.providerRequestId,
      frontRight45: views.views.frontRight45.result!.metadata.providerRequestId,
      right90: views.views.right90.result!.metadata.providerRequestId,
      back180: views.views.back180.result!.metadata.providerRequestId,
    },
  };
}

/** Model-specific six-angle mapping stays out of UI and asset validation. */
export class FalReconstructionProvider implements ReconstructionProvider {
  constructor(
    private readonly provider: ProviderClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  metadataFor(views: ViewSetState, requestId: string): ReconstructionMetadata {
    if (!/^[a-zA-Z0-9_-]+$/.test(requestId))
      throw new ProviderError('invalid_request');
    return {
      provider: 'fal',
      modelId: RECONSTRUCTION_MODEL_ID,
      parameters: { ...PARAMETERS },
      ...input(views),
      submittedAt: this.now().toISOString(),
      providerRequestId: requestId,
    };
  }

  async createReconstruction(
    views: ViewSetState,
    options: {
      signal: AbortSignal;
      onPhase: (
        phase: import('../provider/ProviderClient').ProviderPhase,
      ) => void;
      onSubmitted: (requestId: string) => void;
    },
  ): Promise<ReconstructionResult> {
    const mapped = input(views);
    let submitted: ReconstructionMetadata | null = null;
    const response = await this.provider.run(
      {
        modelId: RECONSTRUCTION_MODEL_ID,
        input: { ...mapped.inputUrls, ...PARAMETERS },
        parse: parseFalReconstruction,
      },
      {
        ...options,
        onSubmitted: (id) => {
          submitted = this.metadataFor(views, id);
          options.onSubmitted(id);
        },
      },
    );
    const metadata = submitted ?? this.metadataFor(views, response.requestId);
    return {
      asset: response.data.asset,
      metadata: {
        ...metadata,
        completedAt: this.now().toISOString(),
        ...(response.data.seed === undefined
          ? {}
          : { seed: response.data.seed }),
      },
    };
  }

  async getStatus(
    metadata: ReconstructionMetadata,
    signal: AbortSignal,
    onPhase: (
      phase: import('../provider/ProviderClient').ProviderPhase,
    ) => void,
  ): Promise<ReconstructionResult> {
    if (
      metadata.modelId !== RECONSTRUCTION_MODEL_ID ||
      !/^[a-zA-Z0-9_-]+$/.test(metadata.providerRequestId)
    )
      throw new ProviderError('invalid_request');
    const response = await this.provider.resume(
      { modelId: metadata.modelId, parse: parseFalReconstruction },
      metadata.providerRequestId,
      { signal, onPhase },
    );
    return {
      asset: response.data.asset,
      metadata: {
        ...metadata,
        completedAt: this.now().toISOString(),
        ...(response.data.seed === undefined
          ? {}
          : { seed: response.data.seed }),
      },
    };
  }
}
