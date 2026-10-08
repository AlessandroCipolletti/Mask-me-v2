import type { ReconstructionResult } from './ReconstructionProvider';

const DB = 'avatar-studio-original-reconstruction';
const STORE = 'assets';

export interface SavedOriginalAsset {
  readonly result: ReconstructionResult;
  readonly blob: Blob;
}

/** Originals are keyed by fal request ID; later M7 experiments can reuse each one. */
export class OriginalAssetStore {
  private async database(): Promise<IDBDatabase> {
    return await new Promise((resolve, reject) => {
      const request = indexedDB.open(DB, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  private async transaction<T>(
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await this.database();
    try {
      return await new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = action(tx.objectStore(STORE));
        let value: T;
        request.onsuccess = () => {
          value = request.result;
        };
        request.onerror = () => reject(request.error);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
        tx.oncomplete = () => resolve(value);
      });
    } finally {
      db.close();
    }
  }

  async save(asset: SavedOriginalAsset): Promise<void> {
    await this.transaction('readwrite', (store) =>
      store.put(asset, asset.result.metadata.providerRequestId),
    );
  }

  async read(requestId: string): Promise<SavedOriginalAsset | null> {
    try {
      const value = await this.transaction<unknown>('readonly', (store) =>
        store.get(requestId),
      );
      if (!value || typeof value !== 'object') return null;
      const item = value as Partial<SavedOriginalAsset>;
      return item.blob instanceof Blob &&
        item.result?.metadata?.providerRequestId === requestId
        ? (item as SavedOriginalAsset)
        : null;
    } catch {
      return null;
    }
  }

  async remove(requestId: string): Promise<void> {
    await this.transaction('readwrite', (store) => store.delete(requestId));
  }

  async clear(): Promise<void> {
    try {
      await this.transaction('readwrite', (store) => store.clear());
    } catch {
      // Storage may be denied on page exit.
    }
  }
}
