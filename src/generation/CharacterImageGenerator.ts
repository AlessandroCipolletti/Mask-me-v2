import type { ProviderPhase } from '../provider/ProviderClient';

export interface SourcePhoto {
  readonly id: string;
  readonly blob: Blob;
  readonly width: number;
  readonly height: number;
}

export interface CanonicalImage {
  readonly url: string;
  readonly width?: number;
  readonly height?: number;
  readonly contentType: string;
}

export interface GenerationMetadata {
  readonly provider: string;
  readonly modelId: string;
  readonly promptVersion: string;
  readonly finalPrompt: string;
  readonly parameters: Readonly<Record<string, string | number | boolean>>;
  readonly sourcePhotoId: string;
  readonly timestamp: string;
  readonly providerRequestId: string;
}

export interface CharacterGeneration {
  readonly image: CanonicalImage;
  readonly metadata: GenerationMetadata;
}

export interface CharacterImageGenerator {
  recover(
    requestId: string,
    signal?: AbortSignal,
    options?: { onPhase?: (phase: ProviderPhase) => void },
  ): Promise<CanonicalImage>;
  generate(
    source: SourcePhoto,
    options?: {
      signal?: AbortSignal;
      onPhase?: (phase: ProviderPhase) => void;
      onSubmitted?: (requestId: string) => void;
    },
  ): Promise<CharacterGeneration>;
}
