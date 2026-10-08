export const RECONSTRUCTION_MODELS = [
  {
    id: 'fal-ai/hunyuan-3d/v3.1/pro/image-to-3d',
    label: 'Hunyuan 3D Pro 3.1',
    views: 'All six approved views',
    documentation:
      'https://fal.ai/models/fal-ai/hunyuan-3d/v3.1/pro/image-to-3d/api',
  },
  {
    id: 'tripo3d/h3.1/multiview-to-3d',
    label: 'Tripo H3.1',
    views: 'Front, left profile, back, right profile (4 of 6)',
    documentation: 'https://fal.ai/models/tripo3d/h3.1/multiview-to-3d/api',
  },
  {
    id: 'meshy/v7.1/multi-image-to-3d',
    label: 'Meshy 7.1',
    views: 'Front, left profile, back, right profile (4 of 6)',
    documentation: 'https://fal.ai/models/meshy/v7.1/multi-image-to-3d/api',
  },
  {
    id: 'hitem3d/hi3d/multi-view-to-3d',
    label: 'Hi3D Portrait 2.1 · quality',
    views: 'Front, left profile, back, right profile (4 of 6)',
    documentation: 'https://fal.ai/models/hitem3d/hi3d/multi-view-to-3d/api',
  },
  {
    id: 'hitem3d/hi3d/multi-view-to-3d/fast',
    label: 'Hi3D Portrait 2.1 · fast',
    views: 'Front, left profile, back, right profile (4 of 6)',
    documentation: 'https://fal.ai/models/hitem3d/hi3d/multi-view-to-3d/api',
    endpoint: 'hitem3d/hi3d/multi-view-to-3d',
  },
] as const;

export type ReconstructionModelId =
  (typeof RECONSTRUCTION_MODELS)[number]['id'];
export const DEFAULT_RECONSTRUCTION_MODEL_ID = RECONSTRUCTION_MODELS[0].id;

export function isReconstructionModelId(
  value: unknown,
): value is ReconstructionModelId {
  return RECONSTRUCTION_MODELS.some((model) => model.id === value);
}

export function reconstructionModel(id: ReconstructionModelId) {
  return RECONSTRUCTION_MODELS.find((model) => model.id === id)!;
}

export function reconstructionEndpoint(id: ReconstructionModelId): string {
  const model = reconstructionModel(id);
  return 'endpoint' in model ? model.endpoint : model.id;
}

export function isHi3dModel(id: ReconstructionModelId): boolean {
  return reconstructionEndpoint(id) === 'hitem3d/hi3d/multi-view-to-3d';
}
