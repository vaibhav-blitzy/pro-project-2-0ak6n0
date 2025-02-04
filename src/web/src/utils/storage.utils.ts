import { sanitizeInput } from './validation.utils';
import AES from 'crypto-js/aes';
import * as compress from 'lz-string';
import { ErrorState } from '../interfaces/common.interface';

// Global constants for storage configuration
const STORAGE_PREFIX = 'task_manager_';
const ENCRYPTION_KEY = process.env.REACT_APP_STORAGE_ENCRYPTION_KEY;
const STORAGE_VERSION = '1.0';
const MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB limit

/**
 * Interface for storage item metadata
 */
interface StorageMetadata {
  version: string;
  timestamp: number;
  compressed: boolean;
  encrypted: boolean;
}

/**
 * Interface for storage metrics
 */
interface StorageMetrics {
  totalSize: number;
  itemCount: number;
  quotaUsage: number;
  lastUpdated: Date;
}

/**
 * Class for managing browser storage with advanced features
 * Implements secure storage, compression, and cross-tab synchronization
 */
export class StorageManager {
  private static instance: StorageManager;
  private storageEventListeners: Map<string, ((event: StorageEvent) => void)[]>;

  private constructor() {
    this.storageEventListeners = new Map();
    this.initializeStorageListener();
  }

  /**
   * Gets singleton instance of StorageManager
   */
  public static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  /**
   * Retrieves and deserializes an item from localStorage
   * @param key - Storage key
   * @param encrypted - Whether the item is encrypted
   * @param compressed - Whether the item is compressed
   * @returns Retrieved value or null if not found
   */
  public getLocalStorageItem<T>(key: string, encrypted: boolean = false, compressed: boolean = false): T | null {
    try {
      const fullKey = `${STORAGE_PREFIX}${key}`;
      const rawValue = localStorage.getItem(fullKey);

      if (!rawValue) {
        return null;
      }

      let parsedValue: { data: T; metadata: StorageMetadata };

      try {
        parsedValue = JSON.parse(rawValue);
      } catch (error) {
        console.error(`Error parsing storage value for key ${key}:`, error);
        return null;
      }

      // Version check
      if (parsedValue.metadata.version !== STORAGE_VERSION) {
        console.warn(`Storage version mismatch for key ${key}`);
        return null;
      }

      let processedData = parsedValue.data;

      // Handle encryption
      if (encrypted && ENCRYPTION_KEY) {
        try {
          const decrypted = AES.decrypt(processedData as string, ENCRYPTION_KEY).toString();
          processedData = JSON.parse(decrypted);
        } catch (error) {
          console.error(`Decryption error for key ${key}:`, error);
          return null;
        }
      }

      // Handle compression
      if (compressed) {
        try {
          processedData = JSON.parse(compress.decompress(processedData as string));
        } catch (error) {
          console.error(`Decompression error for key ${key}:`, error);
          return null;
        }
      }

      return processedData as T;
    } catch (error) {
      console.error(`Error retrieving storage item for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Serializes and stores an item in localStorage
   * @param key - Storage key
   * @param value - Value to store
   * @param encrypted - Whether to encrypt the item
   * @param compressed - Whether to compress the item
   * @returns Success status of storage operation
   */
  public setLocalStorageItem<T>(key: string, value: T, encrypted: boolean = false, compressed: boolean = false): boolean {
    try {
      const fullKey = `${STORAGE_PREFIX}${key}`;
      
      // Check storage quota
      if (!this.hasStorageQuota(value)) {
        throw new Error('Storage quota exceeded');
      }

      // Sanitize string values
      let processedValue = typeof value === 'string' ? sanitizeInput(value) : value;

      // Prepare storage metadata
      const metadata: StorageMetadata = {
        version: STORAGE_VERSION,
        timestamp: Date.now(),
        compressed,
        encrypted
      };

      // Handle compression
      if (compressed) {
        processedValue = compress.compress(JSON.stringify(processedValue));
      }

      // Handle encryption
      if (encrypted && ENCRYPTION_KEY) {
        processedValue = AES.encrypt(JSON.stringify(processedValue), ENCRYPTION_KEY).toString();
      }

      const storageValue = JSON.stringify({
        data: processedValue,
        metadata
      });

      localStorage.setItem(fullKey, storageValue);

      // Trigger storage event for cross-tab sync
      this.dispatchStorageEvent(key, processedValue);

      return true;
    } catch (error) {
      console.error(`Error setting storage item for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Gets current storage usage metrics
   * @returns Storage metrics object
   */
  public getStorageMetrics(): StorageMetrics {
    const metrics: StorageMetrics = {
      totalSize: 0,
      itemCount: 0,
      quotaUsage: 0,
      lastUpdated: new Date()
    };

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(STORAGE_PREFIX)) {
          const value = localStorage.getItem(key);
          if (value) {
            metrics.totalSize += value.length * 2; // UTF-16 characters = 2 bytes
            metrics.itemCount++;
          }
        }
      }

      metrics.quotaUsage = (metrics.totalSize / MAX_STORAGE_SIZE) * 100;
    } catch (error) {
      console.error('Error calculating storage metrics:', error);
    }

    return metrics;
  }

  /**
   * Checks if there's enough storage quota available
   * @param value - Value to be stored
   * @returns Boolean indicating if storage quota is available
   */
  private hasStorageQuota<T>(value: T): boolean {
    try {
      const valueSize = JSON.stringify(value).length * 2; // UTF-16 characters = 2 bytes
      const metrics = this.getStorageMetrics();
      return (metrics.totalSize + valueSize) <= MAX_STORAGE_SIZE;
    } catch (error) {
      console.error('Error checking storage quota:', error);
      return false;
    }
  }

  /**
   * Initializes storage event listener for cross-tab synchronization
   */
  private initializeStorageListener(): void {
    window.addEventListener('storage', (event: StorageEvent) => {
      if (event.key?.startsWith(STORAGE_PREFIX)) {
        const key = event.key.replace(STORAGE_PREFIX, '');
        const listeners = this.storageEventListeners.get(key);
        if (listeners) {
          listeners.forEach(listener => listener(event));
        }
      }
    });
  }

  /**
   * Dispatches storage event for cross-tab synchronization
   * @param key - Storage key
   * @param value - New value
   */
  private dispatchStorageEvent(key: string, value: any): void {
    const event = new StorageEvent('storage', {
      key: `${STORAGE_PREFIX}${key}`,
      newValue: JSON.stringify(value),
      oldValue: localStorage.getItem(`${STORAGE_PREFIX}${key}`),
      storageArea: localStorage
    });
    window.dispatchEvent(event);
  }
}

export default StorageManager.getInstance();