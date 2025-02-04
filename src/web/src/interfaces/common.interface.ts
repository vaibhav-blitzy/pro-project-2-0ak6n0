import { ReactNode } from 'react'; // ^18.0.0
import { LoadingState, ComponentVariant } from '../types/common.types';

/**
 * Base interface for common component properties
 * Provides standardized props used across all components
 */
export interface ComponentProps {
  id?: string;
  className?: string;
  testId?: string;
  children?: ReactNode;
  disabled?: boolean;
  loadingState?: LoadingState;
  variant?: ComponentVariant;
}

/**
 * Enhanced interface for comprehensive error state handling
 * Provides detailed error information for debugging and user feedback
 */
export interface ErrorState {
  hasError: boolean;
  message: string;
  code?: string;
  stackTrace?: string;
  timestamp: Date;
  errorId: string;
  details?: Record<string, unknown>;
}

/**
 * Interface for component metadata with SEO support
 * Used for managing page and component meta information
 */
export interface MetaData {
  title: string;
  description?: string;
  keywords?: string[];
  canonicalUrl?: string;
  openGraph?: Record<string, string>;
  attributes?: Record<string, string>;
}

/**
 * Interface for filter validation rules
 * Defines validation constraints for filter inputs
 */
export interface ValidationRules {
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  required?: boolean;
  allowedValues?: string[];
}

/**
 * Interface for common filter options with validation
 * Provides standardized filtering and pagination options
 */
export interface FilterOptions {
  searchTerm?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  filters?: string[];
  page?: number;
  pageSize?: number;
  validationRules?: ValidationRules;
}

/**
 * Utility type for nullable values
 * Provides type safety for optional values that can be null
 */
export type Nullable<T> = T | null;

/**
 * Utility type for optional values
 * Provides type safety for optional values that can be undefined
 */
export type Optional<T> = T | undefined;

/**
 * Enhanced type for async operation states
 * Provides comprehensive state tracking for asynchronous operations
 */
export type AsyncState<T> = {
  loading: boolean;
  error: ErrorState | null;
  data: T | null;
  status: 'idle' | 'loading' | 'success' | 'error';
  lastUpdated: Date;
  retryCount: number;
};