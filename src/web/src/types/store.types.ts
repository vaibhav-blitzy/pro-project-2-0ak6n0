import { PayloadAction } from '@reduxjs/toolkit'; // ^2.0.0
import { LoadingState, BaseEntity } from './common.types';

/**
 * Comprehensive error type for thunk actions
 * Provides standardized error structure across the application
 */
export type ThunkError = {
  message: string;
  code: string;
  details?: Record<string, unknown>;
};

/**
 * Type for sorting direction in lists and tables
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Interface for tracking application performance metrics
 */
interface PerformanceMetrics {
  pageLoadTime: number;
  apiResponseTime: number;
  lastUpdated: number;
}

/**
 * Interface for toast notification state management
 */
interface ToastState {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

/**
 * Enhanced pagination state interface with sorting capabilities
 */
interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  sortDirection: SortDirection;
  sortField: string;
}

/**
 * Enhanced UI state interface with performance metrics tracking
 */
interface UIState {
  theme: 'light' | 'dark' | 'system';
  isSidebarOpen: boolean;
  isMobileView: boolean;
  toasts: ToastState[];
  performanceMetrics: PerformanceMetrics;
}

/**
 * Enhanced notification state interface with WebSocket support
 */
interface NotificationState {
  notifications: Notification[];
  isOpen: boolean;
  unreadCount: number;
  loading: LoadingState;
  websocketStatus: LoadingState;
  lastSyncTimestamp: number;
  error: ThunkError | null;
}

/**
 * Authentication state interface
 */
interface AuthState extends BaseEntity {
  isAuthenticated: boolean;
  user: {
    id: string;
    email: string;
    role: string;
  } | null;
  loading: LoadingState;
  error: ThunkError | null;
}

/**
 * Task management state interface
 */
interface TaskState {
  items: BaseEntity[];
  selectedTask: BaseEntity | null;
  loading: LoadingState;
  error: ThunkError | null;
  pagination: PaginationState;
}

/**
 * Project management state interface
 */
interface ProjectState {
  items: BaseEntity[];
  selectedProject: BaseEntity | null;
  loading: LoadingState;
  error: ThunkError | null;
  pagination: PaginationState;
}

/**
 * Root state interface combining all slice states
 * Provides type safety for the entire Redux store
 */
export interface RootState {
  auth: AuthState;
  tasks: TaskState;
  projects: ProjectState;
  notifications: NotificationState;
  ui: UIState;
}