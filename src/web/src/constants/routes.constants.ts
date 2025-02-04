/**
 * @fileoverview Frontend route path constants used throughout the application
 * Implements F-pattern layout navigation and supports all UI component paths
 * @version 1.0.0
 */

/**
 * Authentication related route paths
 * Supports complete authentication flow including email verification
 */
export const AUTH_ROUTES = {
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  FORGOT_PASSWORD: '/auth/forgot-password',
  RESET_PASSWORD: '/auth/reset-password/:token',
  VERIFY_EMAIL: '/auth/verify-email/:token'
} as const;

/**
 * Dashboard route paths implementing F-pattern layout
 * Supports main dashboard views and activity tracking
 */
export const DASHBOARD_ROUTES = {
  HOME: '/',
  ACTIVITY: '/activity',
  METRICS: '/metrics',
  TEAM_OVERVIEW: '/team-overview'
} as const;

/**
 * Task management route paths
 * Supports multiple task views (list, board, calendar) and CRUD operations
 */
export const TASK_ROUTES = {
  LIST: '/tasks',
  BOARD: '/tasks/board',
  CALENDAR: '/tasks/calendar',
  DETAILS: '/tasks/:id',
  CREATE: '/tasks/create',
  EDIT: '/tasks/:id/edit'
} as const;

/**
 * Project management route paths
 * Supports comprehensive project views including timeline and analytics
 */
export const PROJECT_ROUTES = {
  LIST: '/projects',
  DETAILS: '/projects/:id',
  TIMELINE: '/projects/:id/timeline',
  TEAM: '/projects/:id/team',
  ANALYTICS: '/projects/:id/analytics'
} as const;

/**
 * User settings and configuration route paths
 * Supports all user preferences and security settings
 */
export const SETTINGS_ROUTES = {
  PROFILE: '/settings/profile',
  PREFERENCES: '/settings/preferences',
  NOTIFICATIONS: '/settings/notifications',
  SECURITY: '/settings/security',
  INTEGRATIONS: '/settings/integrations'
} as const;

/**
 * Search functionality route paths
 * Supports basic and advanced search capabilities
 */
export const SEARCH_ROUTES = {
  INDEX: '/search',
  RESULTS: '/search/results',
  ADVANCED: '/search/advanced'
} as const;

// Type definitions for route parameters
export type AuthToken = string;
export type TaskId = string;
export type ProjectId = string;

// Ensure route constants are readonly
type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

export type AuthRoutes = DeepReadonly<typeof AUTH_ROUTES>;
export type DashboardRoutes = DeepReadonly<typeof DASHBOARD_ROUTES>;
export type TaskRoutes = DeepReadonly<typeof TASK_ROUTES>;
export type ProjectRoutes = DeepReadonly<typeof PROJECT_ROUTES>;
export type SettingsRoutes = DeepReadonly<typeof SETTINGS_ROUTES>;
export type SearchRoutes = DeepReadonly<typeof SEARCH_ROUTES>;