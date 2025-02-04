import { useState, useEffect, useMemo } from 'react'; // ^18.0.0
import { breakpoints } from '../config/theme.config';

/**
 * Configuration options for media query hook
 */
interface MediaQueryOptions {
  query: string;
  defaultMatches?: boolean;
  debounceTime?: number;
}

/**
 * Creates a standardized media query string with proper syntax
 * @param options - Media query configuration options
 * @returns Formatted media query string
 */
export const createMediaQueryString = (options: MediaQueryOptions): string => {
  if (typeof options === 'string') {
    return options;
  }

  // Validate query string
  if (!options.query) {
    throw new Error('Media query string is required');
  }

  // Ensure proper media query syntax
  const queryString = options.query.trim();
  if (!queryString.startsWith('(') && !queryString.startsWith('@media')) {
    return `(${queryString})`;
  }

  return queryString;
};

/**
 * React hook for responsive design through media queries
 * Provides SSR support and optimized performance through debouncing
 * 
 * @param queryOrOptions - Media query string or configuration options
 * @returns Current media query match state
 * 
 * @example
 * // Using predefined breakpoints
 * const isMobile = useMediaQuery(`(max-width: ${breakpoints.values.sm}px)`);
 * 
 * // Using custom query
 * const isRetina = useMediaQuery('(min-resolution: 2dppx)');
 * 
 * // Using options object
 * const isTablet = useMediaQuery({
 *   query: `(min-width: ${breakpoints.values.sm}px) and (max-width: ${breakpoints.values.md}px)`,
 *   defaultMatches: false,
 *   debounceTime: 100
 * });
 */
const useMediaQuery = (queryOrOptions: string | MediaQueryOptions): boolean => {
  // Parse input options
  const options = typeof queryOrOptions === 'string' 
    ? { query: queryOrOptions }
    : queryOrOptions;

  const {
    query,
    defaultMatches = false,
    debounceTime = 100
  } = options;

  // Initialize state with SSR-safe default value
  const [matches, setMatches] = useState<boolean>(() => {
    // Use defaultMatches for SSR
    if (typeof window === 'undefined') {
      return defaultMatches;
    }

    // For client-side, try to match immediately
    try {
      return window.matchMedia(createMediaQueryString(options)).matches;
    } catch (e) {
      console.error('Invalid media query:', e);
      return defaultMatches;
    }
  });

  // Memoize media query string for performance
  const mediaQueryString = useMemo(
    () => createMediaQueryString(options),
    [options]
  );

  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout;

    // Skip effect on server
    if (typeof window === 'undefined') {
      return undefined;
    }

    // Create media query list with error handling
    let mediaQueryList: MediaQueryList;
    try {
      mediaQueryList = window.matchMedia(mediaQueryString);
    } catch (e) {
      console.error('Invalid media query:', e);
      return undefined;
    }

    // Debounced handler for media query changes
    const debouncedHandler = (event: MediaQueryListEvent) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (mounted) {
          setMatches(event.matches);
        }
      }, debounceTime);
    };

    // Set initial value
    setMatches(mediaQueryList.matches);

    // Add listener based on browser support
    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', debouncedHandler);
    } else {
      // Fallback for older browsers
      mediaQueryList.addListener(debouncedHandler);
    }

    // Cleanup function
    return () => {
      mounted = false;
      clearTimeout(timeoutId);

      if (mediaQueryList.removeEventListener) {
        mediaQueryList.removeEventListener('change', debouncedHandler);
      } else {
        // Fallback cleanup for older browsers
        mediaQueryList.removeListener(debouncedHandler);
      }
    };
  }, [mediaQueryString, debounceTime]);

  return matches;
};

export default useMediaQuery;