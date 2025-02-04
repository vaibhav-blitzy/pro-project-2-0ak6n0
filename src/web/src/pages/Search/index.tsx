import React, { useState, useCallback, useEffect, useRef } from 'react';
import { styled } from '@mui/material/styles';
import { useLocation, useNavigate } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';

import SearchBar from '../../components/search/SearchBar';
import SearchResults from '../../components/search/SearchResults';
import useDebounce from '../../hooks/useDebounce';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import { SPACING, LAYOUT, ANIMATION } from '../../constants/ui.constants';
import { ErrorState } from '../../interfaces/common.interface';

// Constants for search optimization
const DEBOUNCE_DELAY = 300;
const MIN_SEARCH_LENGTH = 2;
const RESULTS_PER_PAGE = 20;

// Styled components with Material Design 3.0 principles
const StyledSearchPage = styled('div')(({ theme }) => ({
  maxWidth: LAYOUT.MAX_WIDTH,
  margin: '0 auto',
  padding: SPACING.LARGE,
  display: 'flex',
  flexDirection: 'column',
  gap: SPACING.MEDIUM,
  minHeight: '100vh',
  transition: theme.transitions.create(['background-color'], {
    duration: ANIMATION.DURATION_MEDIUM,
    easing: ANIMATION.EASING_STANDARD,
  }),

  [theme.breakpoints.down('sm')]: {
    padding: SPACING.MEDIUM,
  },
}));

const SearchHeader = styled('header')(({ theme }) => ({
  marginBottom: SPACING.LARGE,
  textAlign: 'center',

  '& h1': {
    fontSize: theme.typography.h4.fontSize,
    marginBottom: SPACING.MEDIUM,
    color: theme.palette.text.primary,
  },
}));

const SearchSection = styled('section')({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: SPACING.LARGE,
  position: 'relative',
});

const ResultsSection = styled('div')({
  flex: 1,
  minHeight: '400px',
  position: 'relative',
});

interface SearchPageProps {
  className?: string;
}

const SearchPage: React.FC<SearchPageProps> = ({ className }) => {
  // State management
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<ErrorState | null>(null);

  // Hooks
  const location = useLocation();
  const navigate = useNavigate();
  const debouncedSearchQuery = useDebounce(searchQuery, DEBOUNCE_DELAY);
  const searchResultsRef = useRef<HTMLDivElement>(null);

  // Initialize search state from URL parameters
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const queryParam = params.get('q');
    const pageParam = params.get('page');

    if (queryParam) {
      setSearchQuery(queryParam);
    }
    if (pageParam) {
      setCurrentPage(parseInt(pageParam, 10));
    }
  }, [location]);

  // Update URL with search parameters
  const updateSearchParams = useCallback((query: string, page: number) => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (page > 1) params.set('page', page.toString());
    navigate({ search: params.toString() }, { replace: true });
  }, [navigate]);

  // Handle search query changes
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
    setError(null);
    updateSearchParams(query, 1);
  }, [updateSearchParams]);

  // Handle page changes
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    updateSearchParams(searchQuery, page);
    searchResultsRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [searchQuery, updateSearchParams]);

  // Handle search result click
  const handleResultClick = useCallback((result: any) => {
    navigate(`/tasks/${result.id}`);
  }, [navigate]);

  // Handle search errors
  const handleError = useCallback((error: Error) => {
    setError({
      hasError: true,
      message: error.message,
      code: 'SEARCH_ERROR',
      timestamp: new Date(),
      errorId: crypto.randomUUID()
    });
    setIsLoading(false);
  }, []);

  // Handle search performance metrics
  const handlePerformanceMetric = useCallback((metric: { type: string; duration: number }) => {
    // Report metrics to monitoring system
    console.info('Search Performance:', metric);
  }, []);

  return (
    <ErrorBoundary
      onError={handleError}
      boundaryId="search-page"
      enableLogging={true}
    >
      <StyledSearchPage className={className}>
        <SearchHeader role="banner">
          <h1>Search Tasks</h1>
        </SearchHeader>

        <SearchSection role="search" aria-label="Task search">
          <SearchBar
            placeholder="Search tasks, projects, and more..."
            onSearch={handleSearch}
            showSuggestions={true}
            autoFocus={true}
            enableAnalytics={true}
            onError={handleError}
            ariaLabels={{
              searchInput: 'Search input',
              clearButton: 'Clear search',
              suggestions: 'Search suggestions',
              noResults: 'No suggestions found',
              loading: 'Loading suggestions'
            }}
          />

          <ResultsSection
            ref={searchResultsRef}
            role="region"
            aria-live="polite"
            aria-busy={isLoading}
          >
            <SearchResults
              searchQuery={debouncedSearchQuery}
              limit={RESULTS_PER_PAGE}
              onResultClick={handleResultClick}
              enableVirtualization={true}
              retryAttempts={3}
              onPerformanceMetric={handlePerformanceMetric}
            />
          </ResultsSection>
        </SearchSection>
      </StyledSearchPage>
    </ErrorBoundary>
  );
};

export default SearchPage;