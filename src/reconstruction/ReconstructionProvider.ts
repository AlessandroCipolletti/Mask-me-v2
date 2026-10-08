import type { ProviderPhase } from '../provider/ProviderClient';
import type { ViewSetState } from '../generation/ViewSetSession';

export interface ReconstructionAsset {
  readonly url: string;
  readonly contentType: string | null;
  readonly fileName: string | null;
  readonly fileSize: number | null;
}

export interface ReconstructionMetadata {
  readonly provider: string;
  readonly modelId: string;
  readonly parameters: Readonly<Record<string, string | number | boolean>>;
  readonly inputUrls: Readonly<Record<string, string>>;
  readonly viewRequestIds: Readonly<Record<string, string>>;
  readonly submittedAt: string;
  readonly providerRequestId: string;
  readonly completedAt?: string;
  readonly seed?: number;
}

export interface ReconstructionResult {
  readonly asset: ReconstructionAsset;
  readonly metadata: ReconstructionMetadata;
}

export interface ReconstructionProvider {
  metadataFor(views: ViewSetState, requestId: string): ReconstructionMetadata;
  createReconstruction(
    views: ViewSetState,
    options: {
      signal: AbortSignal;
      onPhase: (phase: ProviderPhase) => void;
      onSubmitted: (requestId: string) => void;
    },
  ): Promise<ReconstructionResult>;
  getStatus(
    metadata: ReconstructionMetadata,
    signal: AbortSignal,
    onPhase: (phase: ProviderPhase) => void,
  ): Promise<ReconstructionResult>;
}
