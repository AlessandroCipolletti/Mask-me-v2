import type { ViewSetState } from '../generation/ViewSetSession';
import { viewSetReady } from '../generation/ViewSetSession';
import type { ProviderClient, ProviderPhase } from '../provider/ProviderClient';
import { ProviderError } from '../provider/ProviderError';
import {
  DEFAULT_RECONSTRUCTION_MODEL_ID,
  isHi3dModel,
  isReconstructionModelId,
  reconstructionEndpoint,
  type ReconstructionModelId,
} from './ReconstructionModels';
import type {
  ReconstructionAsset,
  ReconstructionMetadata,
  ReconstructionProvider,
  ReconstructionResult,
} from './ReconstructionProvider';

export const RECONSTRUCTION_MODEL_ID = DEFAULT_RECONSTRUCTION_MODEL_ID;
const HUNYUAN_PARAMETERS = {
  generate_type: 'Normal',
  face_count: 500000,
} as const;
const TRIPO_PARAMETERS = {
  geometry_quality: 'detailed',
  texture: true,
  quad: false,
} as const;
const MESHY_PARAMETERS = {
  should_texture: true,
  enable_rigging: false,
} as const;
const HI3D_PARAMETERS = {
  model: 'scene-portraitv2.1',
  resolution: '1536pro',
  face_count: 500000,
  enable_texture: true,
  enable_pbr: false,
  export_format: 'glb',
} as const;
const HI3D_FAST_PARAMETERS = {
  ...HI3D_PARAMETERS,
  resolution: '1536profast',
} as const;

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

function parseAsset(value: unknown): ReconstructionAsset {
  const model = record(value);
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
  return asset;
}

export function parseFalReconstruction(
  value: unknown,
  modelId: ReconstructionModelId = RECONSTRUCTION_MODEL_ID,
): {
  asset: ReconstructionAsset;
  seed?: number;
} {
  const output = record(value);
  const tripoUrls =
    modelId === 'tripo3d/h3.1/multiview-to-3d' && output['model_urls']
      ? record(output['model_urls'])
      : null;
  const candidate =
    modelId === 'tripo3d/h3.1/multiview-to-3d'
      ? (tripoUrls?.['glb'] ?? output['model_mesh'])
      : isHi3dModel(modelId)
        ? output['model_mesh']
        : output['model_glb'];
  const asset = parseAsset(candidate);
  if (
    (modelId === 'tripo3d/h3.1/multiview-to-3d' || isHi3dModel(modelId)) &&
    !tripoUrls?.['glb'] &&
    !new URL(asset.url).pathname.toLowerCase().endsWith('.glb') &&
    asset.contentType !== 'model/gltf-binary'
  )
    throw new ProviderError('invalid_response');
  const seed = output['seed'];
  return {
    asset,
    ...(typeof seed === 'number' && Number.isSafeInteger(seed) ? { seed } : {}),
  };
}

export function reconstructionInput(
  views: ViewSetState,
  modelId: ReconstructionModelId,
): {
  inputUrls: Record<string, string>;
  viewRequestIds: Record<string, string>;
  parameters: Record<string, string | number | boolean>;
  requestInput: Record<string, unknown>;
} {
  if (!viewSetReady(views) || !views.reference)
    throw new ProviderError('invalid_request');
  const image = {
    front: views.reference.image.url,
    frontLeft45: views.views.frontLeft45.result!.image.url,
    left90: views.views.left90.result!.image.url,
    frontRight45: views.views.frontRight45.result!.image.url,
    right90: views.views.right90.result!.image.url,
    back180: views.views.back180.result!.image.url,
  };
  const ids = {
    front: views.reference.metadata.providerRequestId,
    frontLeft45: views.views.frontLeft45.result!.metadata.providerRequestId,
    left90: views.views.left90.result!.metadata.providerRequestId,
    frontRight45: views.views.frontRight45.result!.metadata.providerRequestId,
    right90: views.views.right90.result!.metadata.providerRequestId,
    back180: views.views.back180.result!.metadata.providerRequestId,
  };
  const selected =
    modelId === RECONSTRUCTION_MODEL_ID
      ? {
          input_image_url: image.front,
          left_front_image_url: image.frontLeft45,
          left_image_url: image.left90,
          right_front_image_url: image.frontRight45,
          right_image_url: image.right90,
          back_image_url: image.back180,
        }
      : {
          front: image.front,
          left90: image.left90,
          back180: image.back180,
          right90: image.right90,
        };
  for (const url of Object.values(selected)) httpsUrl(url);
  const parameters =
    modelId === RECONSTRUCTION_MODEL_ID
      ? { ...HUNYUAN_PARAMETERS }
      : modelId === 'tripo3d/h3.1/multiview-to-3d'
        ? { ...TRIPO_PARAMETERS }
        : modelId === 'meshy/v7.1/multi-image-to-3d'
          ? { ...MESHY_PARAMETERS }
          : modelId === 'hitem3d/hi3d/multi-view-to-3d/fast'
            ? { ...HI3D_FAST_PARAMETERS }
            : { ...HI3D_PARAMETERS };
  return {
    inputUrls: selected,
    viewRequestIds:
      modelId === RECONSTRUCTION_MODEL_ID
        ? ids
        : {
            front: ids.front,
            left90: ids.left90,
            back180: ids.back180,
            right90: ids.right90,
          },
    parameters,
    requestInput:
      modelId === RECONSTRUCTION_MODEL_ID
        ? { ...selected, ...parameters }
        : isHi3dModel(modelId)
          ? {
              front_image_url: image.front,
              left_image_url: image.left90,
              back_image_url: image.back180,
              right_image_url: image.right90,
              ...parameters,
            }
          : {
              image_urls: [
                image.front,
                image.left90,
                image.back180,
                image.right90,
              ],
              ...parameters,
            },
  };
}

/** Each provider's input and GLB output shape remains inside this adapter. */
export class FalReconstructionProvider implements ReconstructionProvider {
  constructor(
    private readonly provider: ProviderClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  metadataFor(
    views: ViewSetState,
    requestId: string,
    modelId: ReconstructionModelId = RECONSTRUCTION_MODEL_ID,
  ): ReconstructionMetadata {
    if (
      !/^[a-zA-Z0-9_-]+$/.test(requestId) ||
      !isReconstructionModelId(modelId)
    )
      throw new ProviderError('invalid_request');
    const mapped = reconstructionInput(views, modelId);
    return {
      provider: 'fal',
      modelId,
      parameters: mapped.parameters,
      inputUrls: mapped.inputUrls,
      viewRequestIds: mapped.viewRequestIds,
      submittedAt: this.now().toISOString(),
      providerRequestId: requestId,
    };
  }

  async createReconstruction(
    views: ViewSetState,
    options: {
      signal: AbortSignal;
      onPhase: (phase: ProviderPhase) => void;
      onSubmitted: (requestId: string) => void;
      modelId?: ReconstructionModelId;
    },
  ): Promise<ReconstructionResult> {
    const modelId = options.modelId ?? RECONSTRUCTION_MODEL_ID;
    if (!isReconstructionModelId(modelId))
      throw new ProviderError('invalid_request');
    const mapped = reconstructionInput(views, modelId);
    let submitted: ReconstructionMetadata | null = null;
    const response = await this.provider.run(
      {
        modelId: reconstructionEndpoint(modelId),
        input: mapped.requestInput,
        parse: (value) => parseFalReconstruction(value, modelId),
      },
      {
        ...options,
        onSubmitted: (id) => {
          submitted = this.metadataFor(views, id, modelId);
          options.onSubmitted(id);
        },
      },
    );
    const metadata =
      submitted ?? this.metadataFor(views, response.requestId, modelId);
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
    onPhase: (phase: ProviderPhase) => void,
  ): Promise<ReconstructionResult> {
    if (
      !isReconstructionModelId(metadata.modelId) ||
      !/^[a-zA-Z0-9_-]+$/.test(metadata.providerRequestId)
    )
      throw new ProviderError('invalid_request');
    const response = await this.provider.resume(
      {
        modelId: reconstructionEndpoint(
          metadata.modelId as ReconstructionModelId,
        ),
        parse: (value) =>
          parseFalReconstruction(
            value,
            metadata.modelId as ReconstructionModelId,
          ),
      },
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
