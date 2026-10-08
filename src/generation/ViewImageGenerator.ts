import type { ProviderPhase } from '../provider/ProviderClient';
import type {
  CanonicalImage,
  CharacterGeneration,
} from './CharacterImageGenerator';
import type { GeneratedViewId } from './viewPrompts';

export interface ViewGenerationMetadata {
  readonly provider: string;
  readonly modelId: string;
  readonly promptVersion: string;
  readonly finalPrompt: string;
  readonly parameters: Readonly<Record<string, string | number | boolean>>;
  readonly referenceRequestId: string;
  readonly view: GeneratedViewId;
  readonly timestamp: string;
  readonly providerRequestId: string;
}

export interface ViewGeneration {
  readonly image: CanonicalImage;
  readonly metadata: ViewGenerationMetadata;
}

export interface ViewImageGenerator {
  metadataFor(
    reference: CharacterGeneration,
    view: GeneratedViewId,
    requestId: string,
  ): ViewGenerationMetadata;
  generate(
    reference: CharacterGeneration,
    view: GeneratedViewId,
    options?: {
      signal?: AbortSignal;
      onPhase?: (phase: ProviderPhase) => void;
      onSubmitted?: (requestId: string) => void;
    },
  ): Promise<ViewGeneration>;
  recover(
    metadata: ViewGenerationMetadata,
    signal?: AbortSignal,
    onPhase?: (phase: ProviderPhase) => void,
  ): Promise<CanonicalImage>;
}
