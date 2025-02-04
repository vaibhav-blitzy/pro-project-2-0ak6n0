import { useState, useEffect, useCallback } from 'react'; // ^18.0.0
import { getLocalStorageItem, setLocalStorageItem } from '../utils/storage.utils';
import { ErrorState } from '../interfaces/common.interface';

/**
 * Custom hook for managing localStorage values with type safety, encryption, and cross-tab sync
 * @template T - Type of the stored value
 * @param {string} key - Storage key
 * @param {T} initialValue - Initial value if no stored value exists
 * @param {boolean} [encrypted=false] - Whether to encrypt the stored value
 * @returns {[T, (value: T) => void, () => void]} Tuple containing current value, setter, and remove functions
 */
const useLocalStorage = <T>(
  key: string,
  initialValue: T,
  encrypted: boolean = false
): [T, (value: T) => void, () => void] => {
  // Validate input parameters
  if (!key) {
    throw new Error('Storage key is required');
  }

  // Initialize state with stored value or initial value
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = getLocalStorageItem<T>(key, encrypted);
      return item !== null ? item : initialValue;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return initialValue;
    }
  });

  // Error state for storage operations
  const [error, setError] = useState<ErrorState | null>(null);

  /**
   * Memoized setter function with error handling and storage quota management
   */
  const setValue = useCallback((value: T) => {
    try {
      // Handle function updates
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      // Update state
      setStoredValue(valueToStore);
      
      // Attempt to store in localStorage with encryption if enabled
      const success = setLocalStorageItem(key, valueToStore, encrypted);
      
      if (!success) {
        setError({
          hasError: true,
          message: 'Failed to save to localStorage. Storage quota may be exceeded.',
          code: 'STORAGE_ERROR',
          timestamp: new Date(),
          errorId: crypto.randomUUID()
        });
      } else {
        setError(null);
      }
    } catch (error) {
      console.error('Error saving to localStorage:', error);
      setError({
        hasError: true,
        message: 'Error saving to localStorage',
        code: 'STORAGE_ERROR',
        timestamp: new Date(),
        errorId: crypto.randomUUID(),
        details: { error }
      });
    }
  }, [key, encrypted, storedValue]);

  /**
   * Memoized remove function with secure cleanup
   */
  const removeValue = useCallback(() => {
    try {
      // Remove from localStorage
      localStorage.removeItem(key);
      // Reset state to initial value
      setStoredValue(initialValue);
      setError(null);
    } catch (error) {
      console.error('Error removing from localStorage:', error);
      setError({
        hasError: true,
        message: 'Error removing from localStorage',
        code: 'STORAGE_ERROR',
        timestamp: new Date(),
        errorId: crypto.randomUUID(),
        details: { error }
      });
    }
  }, [key, initialValue]);

  /**
   * Effect for cross-tab synchronization
   */
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key && event.newValue !== null) {
        try {
          const newValue = getLocalStorageItem<T>(key, encrypted);
          setStoredValue(newValue !== null ? newValue : initialValue);
          setError(null);
        } catch (error) {
          console.error('Error handling storage change:', error);
          setError({
            hasError: true,
            message: 'Error syncing with other tabs',
            code: 'SYNC_ERROR',
            timestamp: new Date(),
            errorId: crypto.randomUUID(),
            details: { error }
          });
        }
      }
    };

    // Add event listener for storage changes
    window.addEventListener('storage', handleStorageChange);

    // Cleanup event listener on unmount
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key, encrypted, initialValue]);

  // Return tuple with value, setter, and remove functions
  return [storedValue, setValue, removeValue];
};

export default useLocalStorage;