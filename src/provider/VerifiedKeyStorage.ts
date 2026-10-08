import { ProviderError } from './ProviderError';
import { VolatileCredential } from './VolatileCredential';

const STORAGE_KEY = 'avatar-studio.fal-key.v1';
type KeyStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function browserStorage(): KeyStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Only a successful, user-initiated connection probe may persist a key. */
export class VerifiedKeyStorage {
  constructor(private readonly storage: KeyStorage | null = browserStorage()) {}

  restore(credential: VolatileCredential): boolean {
    try {
      const saved = this.storage?.getItem(STORAGE_KEY);
      if (!saved) return false;
      credential.set(saved);
      return true;
    } catch {
      this.forget();
      return false;
    }
  }

  async verifyAndRemember(
    credential: VolatileCredential,
    checkConnection: () => Promise<unknown>,
    signal: AbortSignal,
  ): Promise<boolean> {
    if (signal.aborted) throw new ProviderError('cancelled');
    await checkConnection();
    if (signal.aborted) throw new ProviderError('cancelled');
    try {
      return credential.withValue((key) => {
        if (!this.storage) return false;
        this.storage.setItem(STORAGE_KEY, key);
        return true;
      });
    } catch {
      return false;
    }
  }

  forget(): void {
    try {
      this.storage?.removeItem(STORAGE_KEY);
    } catch {
      // The browser may deny storage; the caller still clears the live key.
    }
  }
}
