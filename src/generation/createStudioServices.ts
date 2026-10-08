import { FalClient } from '../provider/FalClient';
import type { FalDiagnosticSink } from '../provider/FalDiagnostics';
import { VolatileCredential } from '../provider/VolatileCredential';
import {
  CanonicalSession,
  type CanonicalSessionState,
} from './CanonicalSession';
import { FalCanonicalImageGenerator } from './FalCanonicalImageGenerator';
import { FalViewImageGenerator } from './FalViewImageGenerator';
import { ViewSetSession, type ViewSetState } from './ViewSetSession';
import type {
  CanonicalImage,
  GenerationMetadata,
} from './CharacterImageGenerator';

/** Composition root: UI owns the credential lifecycle, not fal transport details. */
export function createStudioServices(
  credential: VolatileCredential,
  changed: (state: CanonicalSessionState) => void,
  viewChanged: (state: ViewSetState) => void,
  onDiagnostic?: FalDiagnosticSink,
): {
  session: CanonicalSession;
  views: ViewSetSession;
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
  const viewGenerator = new FalViewImageGenerator(client);
  return {
    session: new CanonicalSession(generator, changed),
    views: new ViewSetSession(viewGenerator, viewChanged),
    checkConnection: async (signal) => {
      await client.checkConnection(signal);
    },
    recoverExisting: (requestId, signal, modelId) =>
      generator.recover(requestId, signal, modelId ? { modelId } : {}),
    metadataFor: (sourcePhotoId, requestId) =>
      generator.metadataFor(sourcePhotoId, requestId),
  };
}
