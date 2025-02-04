import React, { useState, useCallback, useRef, useEffect } from 'react';
import { styled } from '@mui/material/styles';
import { useVirtualizer } from '@tanstack/react-virtual';
import { analytics } from '@segment/analytics-next';
import { ErrorBoundary } from 'react-error-boundary';

import useDebounce from '../../hooks/useDebounce';
import Icon from '../common/Icon';
import Input from '../common/Input';
import { search, getSearchSuggestions } from '../../api/search.api';
import { ComponentSize } from '../../types/common.types';

// Constants for search configuration
const DEBOUNCE_DELAY = 300;
const MAX_SUGGESTIONS = 10;
const MIN_SEARCH_LENGTH = 2;
const MAX_SEARCH_LENGTH = 100;
const RATE_LIMIT_WINDOW = 60000;
const MAX_REQUESTS_PER_WINDOW = 60;

// Interface for search bar props with comprehensive options
interface SearchBarProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  showSuggestions?: boolean;
  autoFocus?: boolean;
  className?: string;
  maxSuggestions?: number;
  enableAnalytics?: boolean;
  onError?: (error: Error) => void;
  ariaLabels?: {
    searchInput?: string;
    clearButton?: string;
    suggestions?: string;
    noResults?: string;
    loading?: string;
  };
}

// Enhanced styled components with accessibility and theme support
const StyledSearchBar = styled('div')(({ theme }) => ({
  position: 'relative',
  width: '100%',
  maxWidth: '600px',
  margin: '0 auto',
  transition: theme.transitions.create(['width', 'box-shadow']),
  '&:focus-within': {
    boxShadow: theme.shadows[4],
  },
  '@media (max-width: 768px)': {
    maxWidth: '100%',
  },
  '@media (prefers-reduced-motion)': {
    transition: 'none',
  },
}));

const StyledSuggestions = styled('ul')(({ theme }) => ({
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  maxHeight: 'min(300px, 50vh)',
  margin: 0,
  padding: 0,
  listStyle: 'none',
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[3],
  overflowY: 'auto',
  zIndex: theme.zIndex.modal,
  scrollBehavior: 'smooth',
  overscrollBehavior: 'contain',
}));

const SearchBar: React.FC<SearchBarProps> = React.memo(({
  placeholder = 'Search...',
  onSearch,
  showSuggestions = true,
  autoFocus = false,
  className,
  maxSuggestions = MAX_SUGGESTIONS,
  enableAnalytics = false,
  onError,
  ariaLabels,
}) => {
  // State management
  const [searchValue, setSearchValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Refs for DOM elements and rate limiting
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLUListElement>(null);
  const requestCount = useRef(0);
  const lastRequestTime = useRef(Date.now());

  // Debounced search value for API calls
  const debouncedSearchValue = useDebounce(searchValue, DEBOUNCE_DELAY);

  // Virtual scrolling for suggestions
  const rowVirtualizer = useVirtualizer({
    count: suggestions.length,
    getScrollElement: () => suggestionsRef.current,
    estimateSize: () => 40,
    overscan: 5,
  });

  // Security validation for search input
  const validateSearchInput = (value: string): boolean => {
    if (value.length > MAX_SEARCH_LENGTH) return false;
    if (/[<>{}]/.test(value)) return false; // Prevent XSS
    return true;
  };

  // Rate limiting check
  const checkRateLimit = (): boolean => {
    const now = Date.now();
    if (now - lastRequestTime.current > RATE_LIMIT_WINDOW) {
      requestCount.current = 0;
      lastRequestTime.current = now;
    }
    return requestCount.current < MAX_REQUESTS_PER_WINDOW;
  };

  // Handle search input changes
  const handleSearchChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.trim();
    
    if (!validateSearchInput(value)) {
      setError(new Error('Invalid search input'));
      return;
    }

    setSearchValue(value);
    setError(null);

    if (enableAnalytics) {
      analytics.track('Search Input Changed', {
        value,
        timestamp: new Date().toISOString(),
      });
    }

    if (!value) {
      setSuggestions([]);
      onSearch('');
    }
  }, [enableAnalytics, onSearch]);

  // Handle suggestion selection
  const handleSuggestionClick = useCallback((suggestion: string) => {
    setSearchValue(suggestion);
    onSearch(suggestion);
    setSuggestions([]);
    inputRef.current?.focus();

    if (enableAnalytics) {
      analytics.track('Search Suggestion Selected', {
        suggestion,
        timestamp: new Date().toISOString(),
      });
    }
  }, [enableAnalytics, onSearch]);

  // Clear search input
  const handleClear = useCallback(() => {
    setSearchValue('');
    setSuggestions([]);
    setError(null);
    inputRef.current?.focus();
    onSearch('');

    if (enableAnalytics) {
      analytics.track('Search Cleared', {
        timestamp: new Date().toISOString(),
      });
    }
  }, [enableAnalytics, onSearch]);

  // Fetch search suggestions
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!debouncedSearchValue || debouncedSearchValue.length < MIN_SEARCH_LENGTH || !showSuggestions) {
        setSuggestions([]);
        return;
      }

      if (!checkRateLimit()) {
        setError(new Error('Rate limit exceeded'));
        return;
      }

      try {
        setIsLoading(true);
        requestCount.current++;

        const response = await getSearchSuggestions(debouncedSearchValue, {
          pageSize: maxSuggestions,
        });

        setSuggestions(response.data.map(suggestion => suggestion.text));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch suggestions';
        setError(new Error(errorMessage));
        onError?.(new Error(errorMessage));
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuggestions();
  }, [debouncedSearchValue, maxSuggestions, showSuggestions, onError]);

  return (
    <ErrorBoundary
      fallback={<div>Error: Failed to load search component</div>}
      onError={onError}
    >
      <StyledSearchBar className={className}>
        <Input
          ref={inputRef}
          type="search"
          value={searchValue}
          onChange={handleSearchChange}
          placeholder={placeholder}
          autoFocus={autoFocus}
          size={ComponentSize.MEDIUM}
          aria-label={ariaLabels?.searchInput || 'Search input'}
          aria-expanded={showSuggestions && suggestions.length > 0}
          aria-controls={suggestions.length > 0 ? 'search-suggestions' : undefined}
          aria-describedby={error ? 'search-error' : undefined}
          error={!!error}
          helperText={error?.message}
          data-testid="search-input"
          rightElement={
            searchValue && (
              <Icon
                name="clear"
                size={ComponentSize.SMALL}
                onClick={handleClear}
                aria-label={ariaLabels?.clearButton || 'Clear search'}
                testId="clear-search"
              />
            )
          }
        />

        {showSuggestions && suggestions.length > 0 && (
          <StyledSuggestions
            ref={suggestionsRef}
            role="listbox"
            id="search-suggestions"
            aria-label={ariaLabels?.suggestions || 'Search suggestions'}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => (
              <li
                key={virtualRow.index}
                role="option"
                aria-selected={false}
                style={{
                  height: virtualRow.size,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                onClick={() => handleSuggestionClick(suggestions[virtualRow.index])}
              >
                {suggestions[virtualRow.index]}
              </li>
            ))}
          </StyledSuggestions>
        )}

        {isLoading && (
          <div
            role="status"
            aria-label={ariaLabels?.loading || 'Loading suggestions'}
          >
            <Icon
              name="sync"
              size={ComponentSize.SMALL}
              spin
              testId="loading-indicator"
            />
          </div>
        )}
      </StyledSearchBar>
    </ErrorBoundary>
  );
});

SearchBar.displayName = 'SearchBar';

export default SearchBar;