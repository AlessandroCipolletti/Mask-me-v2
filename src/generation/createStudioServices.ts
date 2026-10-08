import { FalClient } from '../provider/FalClient';
import type { FalDiagnosticSink } from '../provider/FalDiagnostics';
import { VolatileCredential } from '../provider/VolatileCredential';
import {
  CanonicalSession,
  type CanonicalSessionState,
} from './CanonicalSession';
import { FalCanonicalImageGenerator } from './FalCanonicalImageGenerator';
import type {
  CanonicalImage,
  GenerationMetadata,
} from './CharacterImageGenerator';

/** Composition root: UI owns the credential lifecycle, not fal transport details. */
export function createStudioServices(
  credential: VolatileCredential,
  changed: (state: CanonicalSessionState) => void,
  onDiagnostic?: FalDiagnosticSink,
): {
  session: CanonicalSession;
  checkConnection: (signal: AbortSignal) => Promise<void>;
  recoverExisting: (
    requestId: string,
    signal: AbortSignal,
    modelId?: string,
  ) => Promise<CanonicalImage>;
  metadataFor: (sourcePhotoId: string, requestId: string) => GenerationMetadata;
} {
  const client = new FalClient(credential, fetch, undefined, onDiagnostic);
  const generator = new FalCanonicalImageGenerator(client);
  return {
    session: new CanonicalSession(generator, changed),
    checkConnection: async (signal) => {
      await client.checkConnection(signal);
    },
    recoverExisting: (requestId, signal, modelId) =>
      generator.recover(requestId, signal, modelId ? { modelId } : {}),
    metadataFor: (sourcePhotoId, requestId) =>
      generator.metadataFor(sourcePhotoId, requestId),
  };
}
