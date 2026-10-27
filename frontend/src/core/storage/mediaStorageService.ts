/**
 * Persistent Media Storage Service (IndexedDB)
 * 
 * Provides reliable local browser persistence for uploaded course media assets (videos, PDFs, images).
 * Stores raw Blob / File binaries in IndexedDB under a stable ID (mediaId).
 * 
 * STORAGE BOUNDARY NOTICE:
 * This is a frontend-only prototype. IndexedDB provides persistence strictly within the local
 * browser and application origin. It does NOT upload files to a remote server or make them
 * available across different devices or browsers.
 */

export interface StoredMediaAsset {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  file: Blob;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface StorageQuotaEstimate {
  usedBytes: number;
  quotaBytes: number;
  usedMB: number;
  quotaMB: number;
  usagePercent: number;
}

const DB_NAME = 'metro_lms_media_db';
const DB_VERSION = 1;
const STORE_NAME = 'media_assets';

export class MediaStorageError extends Error {
  code: 'QUOTA_EXCEEDED' | 'NOT_FOUND' | 'CORRUPTED' | 'UNSUPPORTED' | 'DB_ERROR';

  constructor(
    message: string,
    code: 'QUOTA_EXCEEDED' | 'NOT_FOUND' | 'CORRUPTED' | 'UNSUPPORTED' | 'DB_ERROR'
  ) {
    super(message);
    this.name = 'MediaStorageError';
    this.code = code;
  }
}

class MediaStorageService {
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  // In-memory fallback for environments without IndexedDB (e.g. certain unit test runners)
  private memoryStore: Map<string, StoredMediaAsset> = new Map();
  // Registry of actively created Object URLs to allow tracked cleanup without accidental file deletion
  private activeObjectUrls: Set<string> = new Set();

  /**
   * Initialize or retrieve the IndexedDB database instance
   */
  private async getDB(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === 'undefined') {
      return null;
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise<IDBDatabase | null>((resolve) => {
        try {
          const request = indexedDB.open(DB_NAME, DB_VERSION);

          request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
              db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
          };

          request.onsuccess = () => {
            resolve(request.result);
          };

          request.onerror = () => {
            console.warn('[MediaStorageService] IndexedDB open failed, using in-memory fallback');
            resolve(null);
          };

          request.onblocked = () => {
            console.warn('[MediaStorageService] IndexedDB upgrade blocked');
            resolve(null);
          };
        } catch (err) {
          console.warn('[MediaStorageService] IndexedDB error, using in-memory fallback:', err);
          resolve(null);
        }
      });
    }

    return this.dbPromise;
  }

  /**
   * Generate a unique, stable media ID
   */
  public generateMediaId(prefix = 'media'): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `${prefix}_${timestamp}_${random}`;
  }

  /**
   * Save a File or Blob into persistent storage with a stable ID
   */
  public async saveMedia(
    file: File | Blob,
    options?: {
      id?: string;
      fileName?: string;
      mimeType?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<StoredMediaAsset> {
    if (!file || file.size === 0) {
      throw new MediaStorageError(
        'عذراً، الملف المحدد فارغ أو غير صالح للحفظ.',
        'UNSUPPORTED'
      );
    }

    const id = options?.id || this.generateMediaId();
    const fileName =
      options?.fileName ||
      (file instanceof File ? file.name : `media_${Date.now()}`);
    const mimeType =
      options?.mimeType ||
      file.type ||
      'application/octet-stream';
    const fileSize = file.size;
    const createdAt = new Date().toISOString();

    const asset: StoredMediaAsset = {
      id,
      fileName,
      mimeType,
      fileSize,
      file,
      createdAt,
      metadata: options?.metadata,
    };

    const db = await this.getDB();
    if (!db) {
      this.memoryStore.set(id, asset);
      return asset;
    }

    return new Promise<StoredMediaAsset>((resolve, reject) => {
      try {
        const tx = db.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(asset);

        req.onsuccess = () => {
          this.memoryStore.set(id, asset);
          resolve(asset);
        };

        req.onerror = (e) => {
          const targetError = (e.target as IDBRequest).error;
          if (
            targetError?.name === 'QuotaExceededError' ||
            targetError?.name === 'NS_ERROR_DOM_QUOTA_REACHED'
          ) {
            reject(
              new MediaStorageError(
                `عذراً، تم تجاوز سعة التخزين المتاحة في المتصفح (${(fileSize / (1024 * 1024)).toFixed(1)} ميجابايت). يرجى تفريغ مساحة على جهازك أو حذف بعض الوسائط المؤقتة.`,
                'QUOTA_EXCEEDED'
              )
            );
          } else {
            reject(
              new MediaStorageError(
                `فشل في حفظ الملف محلياً: ${targetError?.message || 'خطأ غير معروف'}`,
                'DB_ERROR'
              )
            );
          }
        };

        tx.onabort = (e) => {
          const txError = (e.target as IDBTransaction).error;
          if (txError?.name === 'QuotaExceededError') {
            reject(
              new MediaStorageError(
                'عذراً، تم إلغاء الحفظ بسبب نفاد مساحة التخزين في المتصفح.',
                'QUOTA_EXCEEDED'
              )
            );
          }
        };
      } catch (err: unknown) {
        if (
          err instanceof Error &&
          (err.name === 'QuotaExceededError' || err.message?.includes('quota'))
        ) {
          reject(
            new MediaStorageError(
              'عذراً، تم تجاوز سعة التخزين المتاحة في المتصفح.',
              'QUOTA_EXCEEDED'
            )
          );
        } else {
          // Fallback to memory
          this.memoryStore.set(id, asset);
          resolve(asset);
        }
      }
    });
  }

  /**
   * Retrieve stored media asset by stable ID
   */
  public async getMedia(id: string): Promise<StoredMediaAsset | null> {
    if (!id) return null;

    // Check memory store first
    if (this.memoryStore.has(id)) {
      return this.memoryStore.get(id) || null;
    }

    const db = await this.getDB();
    if (!db) {
      return null;
    }

    return new Promise<StoredMediaAsset | null>((resolve) => {
      try {
        const tx = db.transaction([STORE_NAME], 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);

        req.onsuccess = () => {
          const result = req.result as StoredMediaAsset | undefined;
          if (result) {
            this.memoryStore.set(id, result);
            resolve(result);
          } else {
            resolve(null);
          }
        };

        req.onerror = () => {
          resolve(null);
        };
      } catch {
        resolve(null);
      }
    });
  }

  /**
   * Recreate an active browser Object URL from a stored media ID.
   * This is called whenever a saved draft or lesson is reopened or reloaded.
   */
  public async createMediaObjectUrl(id: string): Promise<string | null> {
    const asset = await this.getMedia(id);
    if (!asset || !asset.file) {
      return null;
    }

    try {
      if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        const url = URL.createObjectURL(asset.file);
        this.activeObjectUrls.add(url);
        return url;
      }
      const fallbackUrl = `blob:http://localhost/${asset.id}`;
      this.activeObjectUrls.add(fallbackUrl);
      return fallbackUrl;
    } catch (err) {
      console.error('[MediaStorageService] Failed to create object URL for media ID:', id, err);
      return null;
    }
  }

  /**
   * Safely revoke an active Object URL without deleting the underlying persisted file
   */
  public revokeMediaObjectUrl(url: string | null | undefined): void {
    if (!url) return;
    this.activeObjectUrls.delete(url);
    try {
      if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(url);
      }
    } catch {
      // ignore error
    }
  }

  /**
   * Revoke all actively created Object URLs (e.g. on application exit or teardown)
   */
  public revokeAllObjectUrls(): void {
    for (const url of this.activeObjectUrls) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    }
    this.activeObjectUrls.clear();
  }

  /**
   * Delete a media asset by ID
   */
  public async deleteMedia(id: string): Promise<void> {
    if (!id) return;

    this.memoryStore.delete(id);

    const db = await this.getDB();
    if (!db) return;

    return new Promise<void>((resolve) => {
      try {
        const tx = db.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);

        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  /**
   * Check if a media asset exists in storage
   */
  public async hasMedia(id: string): Promise<boolean> {
    if (!id) return false;
    if (this.memoryStore.has(id)) return true;

    const media = await this.getMedia(id);
    return Boolean(media);
  }

  /**
   * Clear all records in the media store (used for test resets)
   */
  public async clearAll(): Promise<void> {
    this.revokeAllObjectUrls();
    this.memoryStore.clear();

    const db = await this.getDB();
    if (!db) return;

    return new Promise<void>((resolve) => {
      try {
        const tx = db.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.clear();

        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  /**
   * Get estimated storage usage and quota from browser
   */
  public async getStorageEstimate(): Promise<StorageQuotaEstimate | null> {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        const usedBytes = estimate.usage || 0;
        const quotaBytes = estimate.quota || 0;
        const usedMB = Math.round((usedBytes / (1024 * 1024)) * 10) / 10;
        const quotaMB = Math.round((quotaBytes / (1024 * 1024)) * 10) / 10;
        const usagePercent = quotaBytes > 0 ? Math.round((usedBytes / quotaBytes) * 100) : 0;

        return {
          usedBytes,
          quotaBytes,
          usedMB,
          quotaMB,
          usagePercent,
        };
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Standardized storage boundary explanation in Arabic
   */
  public getStorageBoundaryNotice(): string {
    return 'تنبيه: يتم حفظ وسائط المحتوى المرفوعة محلياً داخل متصفحك (IndexedDB). لا يتم رفع الملفات إلى خادم خارجي أو مزامنتها تلقائياً مع أجهزة أخرى.';
  }
}

export const mediaStorageService = new MediaStorageService();
