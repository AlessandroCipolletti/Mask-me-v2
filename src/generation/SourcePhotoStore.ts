import type { SourcePhoto } from './CharacterImageGenerator';

const DATABASE = 'avatar-studio-m4';
const STORE = 'source-photo';
const KEY = 'current';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE))
        request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      request.onsuccess = () => request.result.close();
      reject(new Error('Photo storage is blocked.'));
    };
  });
}

/** One source still, kept locally so a refreshed tab can review the paid result. */
export class SourcePhotoStore {
  async save(source: SourcePhoto): Promise<boolean> {
    try {
      const database = await openDatabase();
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = database.transaction(STORE, 'readwrite');
          transaction.objectStore(STORE).put(source, KEY);
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
          transaction.onabort = () => reject(transaction.error);
        });
        return true;
      } finally {
        database.close();
      }
    } catch {
      return false;
    }
  }

  async read(id: string): Promise<SourcePhoto | null> {
    try {
      const database = await openDatabase();
      try {
        const value = await new Promise<unknown>((resolve, reject) => {
          const request = database
            .transaction(STORE, 'readonly')
            .objectStore(STORE)
            .get(KEY);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        if (!value || typeof value !== 'object') return null;
        const source = value as Partial<SourcePhoto>;
        return source.id === id &&
          source.blob instanceof Blob &&
          typeof source.width === 'number' &&
          typeof source.height === 'number'
          ? (source as SourcePhoto)
          : null;
      } finally {
        database.close();
      }
    } catch {
      return null;
    }
  }

  async clear(): Promise<void> {
    try {
      const database = await openDatabase();
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = database.transaction(STORE, 'readwrite');
          transaction.objectStore(STORE).delete(KEY);
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
          transaction.onabort = () => reject(transaction.error);
        });
      } finally {
        database.close();
      }
    } catch {
      // Ephemeral storage can disappear at any time.
    }
  }
}
