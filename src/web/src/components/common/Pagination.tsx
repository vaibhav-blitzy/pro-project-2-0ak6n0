import React from 'react'; // ^18.0.0
import styled from '@emotion/styled'; // ^11.11.0
import Button from './Button';
import { ComponentSize, ComponentVariant } from '../../types/common.types';

interface PaginationProps {
  /** Current active page number */
  currentPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Number of items per page */
  pageSize: number;
  /** Total number of items */
  totalItems: number;
  /** Size variant for pagination controls */
  size?: ComponentSize;
  /** Disabled state */
  disabled?: boolean;
  /** Additional CSS class */
  className?: string;
  /** Show page information text */
  showPageInfo?: boolean;
  /** Accessible label */
  ariaLabel?: string;
  /** Page change handler */
  onPageChange: (page: number) => void;
  /** Error handler */
  onError?: (error: Error) => void;
}

const PaginationContainer = styled.nav<{ size?: ComponentSize }>`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${props => props.size === ComponentSize.SMALL ? '8px' : '12px'};
  margin: ${props => props.size === ComponentSize.SMALL ? '12px' : '16px'} 0;
  
  @media (max-width: 768px) {
    gap: 4px;
    flex-wrap: wrap;
    justify-content: space-between;
  }
`;

const PageInfo = styled.span<{ size?: ComponentSize }>`
  font-size: ${props => props.size === ComponentSize.SMALL ? '0.875rem' : '1rem'};
  color: var(--color-text-secondary);
  margin: 0 16px;
  
  @media (max-width: 768px) {
    width: 100%;
    text-align: center;
    margin: 8px 0;
    order: -1;
  }
`;

const PageButton = styled(Button)`
  min-width: ${props => props.size === ComponentSize.SMALL ? '32px' : '40px'};
  padding: 0;
  
  &[aria-current="true"] {
    background-color: var(--color-primary);
    color: var(--color-on-primary);
  }
`;

const getPageNumbers = (currentPage: number, totalPages: number): number[] => {
  const delta = 2;
  const range: number[] = [];
  const rangeWithDots: number[] = [];
  let l: number;

  range.push(1);

  for (let i = currentPage - delta; i <= currentPage + delta; i++) {
    if (i < totalPages && i > 1) {
      range.push(i);
    }
  }
  
  range.push(totalPages);

  for (let i = 0; i < range.length; i++) {
    if (l) {
      if (range[i] - l === 2) {
        rangeWithDots.push(l + 1);
      } else if (range[i] - l !== 1) {
        rangeWithDots.push(-1); // represents dots
      }
    }
    rangeWithDots.push(range[i]);
    l = range[i];
  }

  return rangeWithDots;
};

const Pagination: React.FC<PaginationProps> = React.memo(({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  size = ComponentSize.MEDIUM,
  disabled = false,
  className,
  showPageInfo = true,
  ariaLabel = 'Pagination navigation',
  onPageChange,
  onError
}) => {
  const handlePageChange = React.useCallback((newPage: number) => {
    try {
      if (newPage < 1 || newPage > totalPages) {
        throw new Error('Invalid page number');
      }
      if (disabled) return;
      onPageChange(newPage);
    } catch (error) {
      onError?.(error as Error);
    }
  }, [totalPages, disabled, onPageChange, onError]);

  const pageNumbers = React.useMemo(() => 
    getPageNumbers(currentPage, totalPages),
    [currentPage, totalPages]
  );

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <PaginationContainer
      size={size}
      className={className}
      aria-label={ariaLabel}
      role="navigation"
    >
      <PageButton
        size={size}
        variant={ComponentVariant.OUTLINE}
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={disabled || currentPage === 1}
        ariaLabel="Previous page"
      >
        ‹
      </PageButton>

      {pageNumbers.map((pageNumber, index) => (
        pageNumber === -1 ? (
          <span
            key={`dots-${index}`}
            aria-hidden="true"
            style={{ userSelect: 'none' }}
          >
            …
          </span>
        ) : (
          <PageButton
            key={pageNumber}
            size={size}
            variant={ComponentVariant.GHOST}
            onClick={() => handlePageChange(pageNumber)}
            disabled={disabled}
            aria-current={currentPage === pageNumber ? 'true' : undefined}
            ariaLabel={`Page ${pageNumber}`}
          >
            {pageNumber}
          </PageButton>
        )
      ))}

      <PageButton
        size={size}
        variant={ComponentVariant.OUTLINE}
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={disabled || currentPage === totalPages}
        ariaLabel="Next page"
      >
        ›
      </PageButton>

      {showPageInfo && (
        <PageInfo
          size={size}
          role="status"
          aria-live="polite"
        >
          {`Showing ${startItem}-${endItem} of ${totalItems} items`}
        </PageInfo>
      )}
    </PaginationContainer>
  );
});

Pagination.displayName = 'Pagination';

export default Pagination;