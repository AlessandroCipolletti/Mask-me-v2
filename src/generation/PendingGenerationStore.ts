import type { GenerationMetadata } from './CharacterImageGenerator';

const KEY = 'avatar-studio.pending-generation.v1';
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface PendingGeneration {
  readonly requestId: string;
  readonly metadata: GenerationMetadata;
}

function isPending(value: unknown): value is PendingGeneration {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  if (
    typeof item['requestId'] !== 'string' ||
    !/^[a-zA-Z0-9_-]+$/.test(item['requestId']) ||
    !item['metadata'] ||
    typeof item['metadata'] !== 'object'
  )
    return false;
  const metadata = item['metadata'] as Record<string, unknown>;
  return (
    metadata['provider'] === 'fal' &&
    metadata['modelId'] === 'fal-ai/nano-banana-2/edit' &&
    metadata['providerRequestId'] === item['requestId'] &&
    typeof metadata['promptVersion'] === 'string' &&
    typeof metadata['finalPrompt'] === 'string' &&
    typeof metadata['sourcePhotoId'] === 'string' &&
    typeof metadata['timestamp'] === 'string' &&
    !!metadata['parameters'] &&
    typeof metadata['parameters'] === 'object'
  );
}

function browserStore(): Store | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Stores only a request reference and nonsecret metadata for this browser tab. */
export class PendingGenerationStore {
  constructor(private readonly storage: Store | null = browserStore()) {}

  read(): PendingGeneration | null {
    try {
      const raw = this.storage?.getItem(KEY);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (isPending(parsed)) return parsed;
    } catch {
      // Storage can be disabled or contain an older malformed version.
    }
    this.clear();
    return null;
  }

  write(pending: PendingGeneration): boolean {
    try {
      this.storage?.setItem(KEY, JSON.stringify(pending));
      return this.storage !== null;
    } catch {
      return false;
    }
  }

  clear(): void {
    try {
      this.storage?.removeItem(KEY);
    } catch {
      // A denied store must not break the current generation.
    }
  }
}
