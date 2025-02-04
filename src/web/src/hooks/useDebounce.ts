import { useEffect, useState } from 'react'; // ^18.0.0

/**
 * A custom hook that creates a debounced version of a value.
 * Useful for optimizing real-time updates, search inputs, and API calls
 * by preventing excessive updates or requests.
 * 
 * @template T - The type of the value being debounced
 * @param {T} value - The value to debounce
 * @param {number} delay - The delay in milliseconds before updating the debounced value
 * @returns {T} The debounced value
 * 
 * @example
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearchTerm = useDebounce(searchTerm, 500);
 */
const useDebounce = <T>(value: T, delay: number): T => {
  // Store the debounced value in state
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Create a timeout to update the debounced value after the specified delay
    const timeoutId = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cleanup function to clear the timeout if the value changes
    // or the component unmounts before the delay has elapsed
    return () => {
      clearTimeout(timeoutId);
    };
  }, [value, delay]); // Only re-run the effect if value or delay changes

  return debouncedValue;
};

export default useDebounce;