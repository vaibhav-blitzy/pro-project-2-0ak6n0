import { ReactNode } from 'react'; // ^18.0.0

/**
 * Generic ID type supporting both string and number formats
 * Used for flexible entity identification across the application
 */
export type ID = string | number;

/**
 * UUID type following RFC4122 format
 * Used for strict entity identification
 */
export type UUID = string;

/**
 * Flexible timestamp type supporting both ISO string and Date object formats
 * Used for date/time handling across the application
 */
export type Timestamp = string | Date;

/**
 * Application theme type supporting light, dark, and system preference modes
 * Used for consistent theme management
 */
export type Theme = 'light' | 'dark' | 'system';

/**
 * Base interface for all entity types with standard tracking fields
 * Provides consistent structure for database entities
 */
export interface BaseEntity {
  id: UUID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: UUID;
  updatedBy: UUID;
  isActive: boolean;
  version: string;
}

/**
 * Standard pagination interface for list operations and data fetching
 * Ensures consistent pagination structure across the application
 */
export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Enum defining possible component loading states
 * Used for consistent state management across components
 */
export enum LoadingState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

/**
 * Enum for standardized component size variants
 * Follows design system specifications
 */
export enum ComponentSize {
  SMALL = 'SMALL',
  MEDIUM = 'MEDIUM',
  LARGE = 'LARGE',
  XLARGE = 'XLARGE'
}

/**
 * Enum for component style variants
 * Aligned with Material Design 3.0 specifications
 */
export enum ComponentVariant {
  PRIMARY = 'PRIMARY',
  SECONDARY = 'SECONDARY',
  TERTIARY = 'TERTIARY',
  OUTLINE = 'OUTLINE',
  GHOST = 'GHOST',
  LINK = 'LINK'
}

/**
 * Enum for consistent sorting direction
 * Used across data operations
 */
export enum SortDirection {
  ASC = 'ASC',
  DESC = 'DESC'
}

/**
 * Common type for component children
 * Provides type safety for React components
 */
export type ComponentChildren = {
  children?: ReactNode;
};

/**
 * Base component props interface
 * Provides common props for all components
 */
export interface BaseComponentProps extends ComponentChildren {
  className?: string;
  id?: string;
  testId?: string;
}

/**
 * Common props for interactive components
 * Extends base component props with interaction-specific properties
 */
export interface InteractiveComponentProps extends BaseComponentProps {
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  variant?: ComponentVariant;
  size?: ComponentSize;
}

/**
 * Error state interface
 * Provides consistent error handling structure
 */
export interface ErrorState {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

/**
 * API response wrapper interface
 * Ensures consistent API response structure
 */
export interface ApiResponse<T> {
  data: T;
  error?: ErrorState;
  status: number;
  timestamp: Timestamp;
}

/**
 * List response wrapper interface
 * Provides consistent structure for paginated data
 */
export interface ListResponse<T> extends ApiResponse<T[]> {
  pagination: Pagination;
}