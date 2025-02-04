/**
 * @fileoverview API Constants and Configuration
 * Defines comprehensive API endpoint constants, status codes, headers, and configuration values
 * for standardized HTTP communication with backend microservices.
 * @version 1.0.0
 */

// Global API configuration
export const API_VERSION = 'v1';
export const API_BASE_PATH = '/api';

/**
 * Authentication service endpoints with comprehensive auth flows
 */
export const AUTH = {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
    REFRESH_TOKEN: '/auth/refresh',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
    VERIFY_EMAIL: '/auth/verify-email',
    ME: '/auth/me',
    UPDATE_PROFILE: '/auth/profile',
    CHANGE_PASSWORD: '/auth/change-password',
    MFA_SETUP: '/auth/mfa/setup',
    MFA_VERIFY: '/auth/mfa/verify',
    SSO_LOGIN: '/auth/sso/:provider',
    SSO_CALLBACK: '/auth/sso/:provider/callback'
} as const;

/**
 * Task management service endpoints with CRUD and specialized operations
 */
export const TASKS = {
    BASE: '/tasks',
    BY_ID: '/tasks/:id',
    STATUS: '/tasks/:id/status',
    ATTACHMENTS: '/tasks/:id/attachments',
    COMMENTS: '/tasks/:id/comments',
    ASSIGN: '/tasks/:id/assign',
    BULK_UPDATE: '/tasks/bulk',
    TEMPLATES: '/tasks/templates',
    DEPENDENCIES: '/tasks/:id/dependencies',
    HISTORY: '/tasks/:id/history',
    METRICS: '/tasks/:id/metrics',
    EXPORT: '/tasks/export',
    IMPORT: '/tasks/import',
    RECURRING: '/tasks/recurring',
    TAGS: '/tasks/tags'
} as const;

/**
 * Project management service endpoints with team and resource management
 */
export const PROJECTS = {
    BASE: '/projects',
    BY_ID: '/projects/:id',
    MEMBERS: '/projects/:id/members',
    TASKS: '/projects/:id/tasks',
    TIMELINE: '/projects/:id/timeline',
    STATISTICS: '/projects/:id/statistics',
    ROLES: '/projects/:id/roles',
    PERMISSIONS: '/projects/:id/permissions',
    ACTIVITY: '/projects/:id/activity',
    RESOURCES: '/projects/:id/resources',
    TEMPLATES: '/projects/templates',
    CATEGORIES: '/projects/categories',
    REPORTS: '/projects/:id/reports',
    ARCHIVES: '/projects/archives'
} as const;

/**
 * Real-time notification service endpoints with preference management
 */
export const NOTIFICATIONS = {
    BASE: '/notifications',
    MARK_READ: '/notifications/mark-read',
    PREFERENCES: '/notifications/preferences',
    SUBSCRIBE: '/notifications/subscribe',
    UNSUBSCRIBE: '/notifications/unsubscribe',
    CHANNELS: '/notifications/channels',
    DIGEST: '/notifications/digest',
    MUTE: '/notifications/mute',
    UNMUTE: '/notifications/unmute',
    WEBSOCKET: '/notifications/ws',
    HISTORY: '/notifications/history'
} as const;

/**
 * Advanced search service endpoints with filtering and suggestions
 */
export const SEARCH = {
    BASE: '/search',
    TASKS: '/search/tasks',
    PROJECTS: '/search/projects',
    GLOBAL: '/search/global',
    SUGGESTIONS: '/search/suggestions',
    ADVANCED: '/search/advanced',
    FILTERS: '/search/filters',
    SAVED: '/search/saved',
    RECENT: '/search/recent',
    EXPORT: '/search/export'
} as const;

/**
 * Comprehensive HTTP status codes for API responses
 */
export const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503
} as const;

/**
 * Standardized API request and response headers
 */
export const API_HEADERS = {
    AUTHORIZATION: 'Authorization',
    CONTENT_TYPE: 'Content-Type',
    ACCEPT: 'Accept',
    ACCEPT_LANGUAGE: 'Accept-Language',
    X_REQUEST_ID: 'X-Request-ID',
    X_API_VERSION: 'X-API-Version',
    X_CORRELATION_ID: 'X-Correlation-ID',
    X_RATE_LIMIT: 'X-Rate-Limit',
    X_RATE_LIMIT_REMAINING: 'X-Rate-Limit-Remaining',
    X_RATE_LIMIT_RESET: 'X-Rate-Limit-Reset',
    CACHE_CONTROL: 'Cache-Control',
    ETAG: 'ETag',
    IF_NONE_MATCH: 'If-None-Match',
    IF_MODIFIED_SINCE: 'If-Modified-Since'
} as const;

/**
 * Combined API endpoints object for unified access
 */
export const API_ENDPOINTS = {
    AUTH,
    TASKS,
    PROJECTS,
    NOTIFICATIONS,
    SEARCH
} as const;