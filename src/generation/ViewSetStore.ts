import type {
  CanonicalImage,
  CharacterGeneration,
  GenerationMetadata,
} from './CharacterImageGenerator';
import type {
  ViewGeneration,
  ViewGenerationMetadata,
} from './ViewImageGenerator';
import type { ViewEntry, ViewSetState } from './ViewSetSession';
import { VIEW_IDS } from './viewPrompts';

const KEY = 'avatar-studio.view-set.v1';
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function httpsImage(value: unknown): value is CanonicalImage {
  const item = record(value);
  if (!item || typeof item['url'] !== 'string') return false;
  try {
    const url = new URL(item['url']);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      typeof item['contentType'] === 'string' &&
      item['contentType'].startsWith('image/')
    );
  } catch {
    return false;
  }
}

function metadata(value: unknown): value is GenerationMetadata {
  const item = record(value);
  return !!(
    item &&
    item['provider'] === 'fal' &&
    typeof item['modelId'] === 'string' &&
    typeof item['promptVersion'] === 'string' &&
    typeof item['finalPrompt'] === 'string' &&
    record(item['parameters']) &&
    typeof item['sourcePhotoId'] === 'string' &&
    typeof item['timestamp'] === 'string' &&
    typeof item['providerRequestId'] === 'string'
  );
}

function character(value: unknown): value is CharacterGeneration {
  const item = record(value);
  return !!(item && httpsImage(item['image']) && metadata(item['metadata']));
}

function viewMetadata(
  value: unknown,
  view: string,
  referenceId: string,
): value is ViewGenerationMetadata {
  const item = record(value);
  return !!(
    item &&
    item['provider'] === 'fal' &&
    item['modelId'] === 'google/nano-banana-2.1/edit' &&
    item['view'] === view &&
    item['referenceRequestId'] === referenceId &&
    typeof item['promptVersion'] === 'string' &&
    typeof item['finalPrompt'] === 'string' &&
    record(item['parameters']) &&
    typeof item['timestamp'] === 'string' &&
    typeof item['providerRequestId'] === 'string' &&
    /^[a-zA-Z0-9_-]+$/.test(item['providerRequestId'])
  );
}

function viewResult(
  value: unknown,
  view: string,
  referenceId: string,
): value is ViewGeneration {
  const item = record(value);
  return !!(
    item &&
    httpsImage(item['image']) &&
    viewMetadata(item['metadata'], view, referenceId)
  );
}

function entry(
  value: unknown,
  view: string,
  referenceId: string,
): value is ViewEntry {
  const item = record(value);
  if (!item) return false;
  const allowedStatus = [
    'empty',
    'waiting',
    'generating',
    'paused',
    'ready',
    'failed',
  ];
  const allowedReview = ['pending', 'accepted', 'flagged'];
  const allowedReasons = [
    'dimensions_unverified',
    'resolution_too_low',
    'aspect_ratio_mismatch',
    'image_unavailable',
  ];
  if (
    item['status'] === 'ready' &&
    !viewResult(item['result'], view, referenceId)
  )
    return false;
  if (
    item['status'] === 'paused' &&
    !viewMetadata(item['pendingMetadata'], view, referenceId)
  )
    return false;
  return (
    allowedStatus.includes(String(item['status'])) &&
    allowedReview.includes(String(item['review'])) &&
    (item['phase'] === null ||
      ['submitting', 'queued', 'running', 'retrieving'].includes(
        String(item['phase']),
      )) &&
    (item['result'] === null ||
      viewResult(item['result'], view, referenceId)) &&
    (item['pendingMetadata'] === null ||
      viewMetadata(item['pendingMetadata'], view, referenceId)) &&
    Array.isArray(item['qualityReasons']) &&
    item['qualityReasons'].every((reason: unknown) =>
      allowedReasons.includes(String(reason)),
    ) &&
    (item['error'] === null || typeof item['error'] === 'string')
  );
}

function isViewSet(value: unknown): value is ViewSetState {
  const item = record(value);
  if (!item || !character(item['reference'])) return false;
  const views = record(item['views']);
  if (!views) return false;
  const referenceId = item['reference'].metadata.providerRequestId;
  return VIEW_IDS.every((view) => entry(views[view], view, referenceId));
}

function browserStore(): Store | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Tab-scoped URLs, prompt metadata and request IDs. No key or source bytes. */
export class ViewSetStore {
  constructor(private readonly storage: Store | null = browserStore()) {}

  read(): ViewSetState | null {
    try {
      const raw = this.storage?.getItem(KEY);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (isViewSet(parsed)) return parsed;
    } catch {
      // Storage may be disabled or contain malformed older data.
    }
    this.clear();
    return null;
  }

  write(state: ViewSetState): boolean {
    if (!state.reference) {
      this.clear();
      return true;
    }
    try {
      this.storage?.setItem(KEY, JSON.stringify(state));
      return this.storage !== null;
    } catch {
      return false;
    }
  }

  clear(): void {
    try {
      this.storage?.removeItem(KEY);
    } catch {
      // Denied storage must not interrupt generation.
    }
  }
}
