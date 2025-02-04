import React, { useCallback, useEffect, useState, useMemo } from 'react'; // ^18.0.0
import styled from 'styled-components'; // ^6.0.0
import { useVirtualizer } from '@tanstack/react-virtual'; // ^3.0.0
import { useTheme } from '../../hooks/useTheme';
import { ComponentProps, ErrorState } from '../../interfaces/common.interface';
import { LoadingSpinner } from '../common/LoadingSpinner';
import Card from '../common/Card';
import { search } from '../../api/search.api';

// Constants for performance and UX optimization
const DEFAULT_PAGE_SIZE = 20;
const VIRTUALIZATION_THRESHOLD = 100;
const RETRY_DELAY = 3000;
const DEFAULT_RETRY_ATTEMPTS = 3;

interface SearchResultsProps extends ComponentProps {
  searchQuery: string;
  limit?: number;
  onResultClick?: (result: SearchResultItem) => void;
  enableVirtualization?: boolean;
  retryAttempts?: number;
  onPerformanceMetric?: (metric: { type: string; duration: number }) => void;
}

interface SearchResultItem {
  id: string;
  title: string;
  type: string;
  description?: string;
  highlights: Record<string, string[]>;
  ariaLabel: string;
  metadata: Record<string, unknown>;
}

// Styled components with theme-aware styling
const ResultsContainer = styled.div<{ isEmpty: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  min-height: ${({ isEmpty }) => isEmpty ? '200px' : 'auto'};
  position: relative;
  width: 100%;
  padding: ${({ theme }) => theme.spacing(2)} 0;
`;

const ResultItem = styled(Card)`
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  padding: ${({ theme }) => theme.spacing(3)};

  &:hover {
    transform: translateY(-2px);
  }

  &:focus-visible {
    outline: 3px solid ${({ theme }) => theme.palette.primary.main};
    outline-offset: 2px;
  }
`;

const HighlightedText = styled.span<{ $isDarkMode: boolean }>`
  background-color: ${({ theme, $isDarkMode }) => 
    $isDarkMode ? theme.palette.primary.dark : theme.palette.primary.light}40;
  border-radius: ${({ theme }) => theme.borderRadius.small};
  padding: 0 ${({ theme }) => theme.spacing(0.5)};
`;

const ErrorContainer = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.spacing(4)};
  color: ${({ theme }) => theme.palette.error.main};
`;

const NoResultsContainer = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.spacing(4)};
  color: ${({ theme }) => theme.palette.text.secondary};
`;

const SearchResults: React.FC<SearchResultsProps> = React.memo(({
  searchQuery,
  className,
  limit = DEFAULT_PAGE_SIZE,
  onResultClick,
  enableVirtualization = true,
  retryAttempts = DEFAULT_RETRY_ATTEMPTS,
  onPerformanceMetric
}) => {
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { isDarkMode } = useTheme();

  // Virtual list configuration for large result sets
  const parentRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: results.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5
  });

  // Format highlighted text with proper ARIA attributes
  const formatHighlightedText = useCallback((text: string, highlights: Record<string, string[]>) => {
    if (!highlights || !text) return text;

    const parts = text.split(new RegExp(`(${Object.values(highlights).flat().join('|')})`, 'gi'));
    return parts.map((part, index) => {
      const isHighlighted = Object.values(highlights).flat().some(h => 
        part.toLowerCase() === h.toLowerCase()
      );
      return isHighlighted ? (
        <HighlightedText
          key={index}
          $isDarkMode={isDarkMode}
          aria-label={`Matching term: ${part}`}
        >
          {part}
        </HighlightedText>
      ) : part;
    });
  }, [isDarkMode]);

  // Fetch search results with performance monitoring and retry logic
  const fetchResults = useCallback(async () => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    const startTime = performance.now();
    setIsLoading(true);
    setError(null);

    try {
      const response = await search<SearchResultItem[]>({
        query: searchQuery,
        filters: {
          type: 'all'
        }
      }, {
        page: 1,
        pageSize: limit,
        highlight: true
      });

      setResults(response.data.items);
      onPerformanceMetric?.({
        type: 'search',
        duration: performance.now() - startTime
      });
      setRetryCount(0);
    } catch (err) {
      setError({
        hasError: true,
        message: 'Failed to fetch search results',
        code: 'SEARCH_ERROR',
        timestamp: new Date(),
        errorId: crypto.randomUUID()
      });

      if (retryCount < retryAttempts) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
        }, RETRY_DELAY);
      }
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, limit, retryAttempts, retryCount, onPerformanceMetric]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults, searchQuery]);

  // Memoized result rendering with virtualization support
  const renderResults = useMemo(() => {
    if (isLoading) {
      return (
        <LoadingSpinner
          size="LARGE"
          aria-label="Loading search results"
        />
      );
    }

    if (error) {
      return (
        <ErrorContainer role="alert">
          <p>{error.message}</p>
          {retryCount < retryAttempts && (
            <button onClick={fetchResults} aria-label="Retry search">
              Retry
            </button>
          )}
        </ErrorContainer>
      );
    }

    if (results.length === 0) {
      return (
        <NoResultsContainer role="status">
          No results found for "{searchQuery}"
        </NoResultsContainer>
      );
    }

    const renderResultItem = (result: SearchResultItem, style?: React.CSSProperties) => (
      <ResultItem
        key={result.id}
        elevation="low"
        interactive
        onClick={() => onResultClick?.(result)}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onResultClick?.(result);
          }
        }}
        role="listitem"
        tabIndex={0}
        aria-label={result.ariaLabel}
        style={style}
      >
        <h3>{formatHighlightedText(result.title, result.highlights)}</h3>
        {result.description && (
          <p>{formatHighlightedText(result.description, result.highlights)}</p>
        )}
      </ResultItem>
    );

    if (enableVirtualization && results.length > VIRTUALIZATION_THRESHOLD) {
      return (
        <div
          ref={parentRef}
          style={{
            height: '600px',
            overflow: 'auto'
          }}
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative'
            }}
          >
            {virtualizer.getVirtualItems().map(virtualRow => (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`
                }}
              >
                {renderResultItem(results[virtualRow.index])}
              </div>
            ))}
          </div>
        </div>
      );
    }

    return results.map(result => renderResultItem(result));
  }, [
    isLoading,
    error,
    results,
    searchQuery,
    retryCount,
    retryAttempts,
    virtualizer,
    formatHighlightedText,
    onResultClick,
    fetchResults,
    enableVirtualization
  ]);

  return (
    <ResultsContainer
      className={className}
      isEmpty={results.length === 0}
      role="list"
      aria-label="Search results"
    >
      {renderResults}
    </ResultsContainer>
  );
});

SearchResults.displayName = 'SearchResults';

export default SearchResults;