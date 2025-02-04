/**
 * @fileoverview Search API Module
 * Provides secure and monitored search functionality with enhanced error handling,
 * rate limiting, and circuit breaker protection for the task management system.
 * @version 1.0.0
 */

import axios from 'axios'; // ^1.6.0
import circuitBreaker from 'opossum'; // ^6.0.0
import handleApiError from '@error-handling/utils'; // ^1.0.0
import performanceMonitor from '@monitoring/utils'; // ^1.0.0

import { ApiResponse } from '../types/api.types';
import { apiClient } from '../utils/api.utils';
import { SEARCH } from '../constants/api.constants';

/**
 * Search query interface with comprehensive filtering options
 */
interface ISearchQuery {
  query: string;
  filters?: {
    type?: 'task' | 'project';
    status?: string[];
    priority?: string[];
    assignee?: string[];
    dateRange?: {
      start: string;
      end: string;
    };
  };
  sort?: {
    field: string;
    direction: 'asc' | 'desc';
  };
}

/**
 * Search options interface for pagination and response customization
 */
interface ISearchOptions {
  page?: number;
  pageSize?: number;
  includeArchived?: boolean;
  highlight?: boolean;
  fields?: string[];
}

/**
 * Search response interface with metadata and performance metrics
 */
interface ISearchResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  took: number;
  highlights?: Record<string, string[]>;
  suggestions?: string[];
}

/**
 * Search suggestion interface with metadata
 */
interface ISearchSuggestion {
  text: string;
  type: string;
  score: number;
  metadata?: Record<string, unknown>;
}

/**
 * Circuit breaker configuration for search API calls
 */
const searchCircuitBreaker = new circuitBreaker(
  async (url: string, options: any) => apiClient.get(url, options),
  {
    timeout: 5000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000
  }
);

/**
 * Performs a secure and monitored search across tasks and projects
 * @param query - Search query parameters
 * @param options - Search customization options
 * @returns Promise with search results and metadata
 */
export const search = async <T>(
  query: ISearchQuery,
  options: ISearchOptions = {}
): Promise<ApiResponse<ISearchResponse<T>>> => {
  const perfTracker = performanceMonitor.start('search-api');

  try {
    // Validate search parameters
    if (!query.query?.trim()) {
      throw new Error('Search query is required');
    }

    // Set security headers
    apiClient.setSecurityHeaders({
      'X-Search-Context': 'user-search',
      'X-Search-Type': query.filters?.type || 'all'
    });

    const response = await searchCircuitBreaker.fire(
      SEARCH.BASE,
      {
        params: {
          q: query.query,
          ...query.filters,
          ...options,
          sort: query.sort ? `${query.sort.field}:${query.sort.direction}` : undefined
        },
        metadata: {
          searchType: 'global',
          timestamp: new Date().toISOString()
        }
      }
    );

    perfTracker.addMetric('responseTime', response.headers['x-response-time']);
    perfTracker.addMetric('resultCount', response.data.total);

    return {
      data: response.data,
      status: response.status,
      message: 'Search completed successfully',
      timestamp: new Date().toISOString(),
      requestId: response.headers['x-request-id'],
      responseTime: parseInt(response.headers['x-response-time'])
    };
  } catch (error) {
    perfTracker.addError(error);
    throw handleApiError(error);
  } finally {
    perfTracker.end();
  }
};

/**
 * Retrieves search suggestions with security and monitoring
 * @param query - Search query string
 * @param options - Suggestion customization options
 * @returns Promise with search suggestions
 */
export const getSearchSuggestions = async (
  query: string,
  options: Partial<ISearchOptions> = {}
): Promise<ApiResponse<ISearchSuggestion[]>> => {
  const perfTracker = performanceMonitor.start('search-suggestions');

  try {
    // Validate query
    if (!query?.trim()) {
      throw new Error('Query string is required for suggestions');
    }

    // Set security headers
    apiClient.setSecurityHeaders({
      'X-Search-Context': 'suggestions',
      'X-Suggestion-Type': options.fields?.join(',') || 'all'
    });

    const response = await searchCircuitBreaker.fire(
      SEARCH.SUGGESTIONS,
      {
        params: {
          q: query,
          ...options
        },
        metadata: {
          suggestionType: 'autocomplete',
          timestamp: new Date().toISOString()
        }
      }
    );

    perfTracker.addMetric('suggestionCount', response.data.length);

    return {
      data: response.data,
      status: response.status,
      message: 'Suggestions retrieved successfully',
      timestamp: new Date().toISOString(),
      requestId: response.headers['x-request-id'],
      responseTime: parseInt(response.headers['x-response-time'])
    };
  } catch (error) {
    perfTracker.addError(error);
    throw handleApiError(error);
  } finally {
    perfTracker.end();
  }
};