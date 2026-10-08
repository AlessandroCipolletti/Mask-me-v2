import { RECONSTRUCTION_MODEL_ID } from './FalReconstructionProvider';
import type {
  ReconstructionMetadata,
  ReconstructionResult,
} from './ReconstructionProvider';

const KEY = 'avatar-studio.reconstruction.v1';
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface ReconstructionRecord {
  readonly pending: ReconstructionMetadata | null;
  readonly result: ReconstructionResult | null;
  readonly accepted: boolean;
  readonly yawDegrees: number;
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function validMetadata(value: unknown): value is ReconstructionMetadata {
  const item = object(value);
  if (
    !item ||
    item['provider'] !== 'fal' ||
    item['modelId'] !== RECONSTRUCTION_MODEL_ID ||
    typeof item['providerRequestId'] !== 'string' ||
    !/^[a-zA-Z0-9_-]+$/.test(item['providerRequestId']) ||
    typeof item['submittedAt'] !== 'string'
  )
    return false;
  const urls = object(item['inputUrls']);
  const ids = object(item['viewRequestIds']);
  if (!urls || !ids || !object(item['parameters'])) return false;
  return (
    [
      'input_image_url',
      'left_front_image_url',
      'left_image_url',
      'right_front_image_url',
      'right_image_url',
      'back_image_url',
    ].every((field) => {
      if (typeof urls[field] !== 'string') return false;
      try {
        const url = new URL(urls[field]);
        return url.protocol === 'https:' && !url.username && !url.password;
      } catch {
        return false;
      }
    }) &&
    [
      'front',
      'frontLeft45',
      'left90',
      'frontRight45',
      'right90',
      'back180',
    ].every((field) => typeof ids[field] === 'string')
  );
}

function validResult(value: unknown): value is ReconstructionResult {
  const item = object(value);
  const asset = object(item?.['asset']);
  if (
    !item ||
    !asset ||
    !validMetadata(item['metadata']) ||
    typeof asset['url'] !== 'string'
  )
    return false;
  try {
    const url = new URL(asset['url']);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

function browserStore(): Store | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Tab-scoped request/result metadata; raw GLB bytes live in IndexedDB. */
export class ReconstructionRecordStore {
  constructor(private readonly storage: Store | null = browserStore()) {}

  read(): ReconstructionRecord | null {
    try {
      const raw = this.storage?.getItem(KEY);
      if (!raw) return null;
      const value = object(JSON.parse(raw));
      if (
        value &&
        (value['pending'] === null || validMetadata(value['pending'])) &&
        (value['result'] === null || validResult(value['result'])) &&
        typeof value['accepted'] === 'boolean' &&
        typeof value['yawDegrees'] === 'number' &&
        Number.isFinite(value['yawDegrees'])
      )
        return value as unknown as ReconstructionRecord;
    } catch {
      /* unavailable or malformed */
    }
    this.clear();
    return null;
  }

  write(record: ReconstructionRecord): boolean {
    try {
      this.storage?.setItem(KEY, JSON.stringify(record));
      return this.storage !== null;
    } catch {
      return false;
    }
  }

  clear(): void {
    try {
      this.storage?.removeItem(KEY);
    } catch {
      /* storage denied */
    }
  }
}
