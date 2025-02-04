/**
 * @fileoverview TypeScript interfaces for the Elasticsearch-based search service,
 * defining core search functionality types including queries, responses, and configurations.
 * Implements enterprise-grade search capabilities with performance monitoring.
 * @version Elasticsearch 8.0.0
 */

import { SearchRequest, SearchTemplateRequest } from '@elastic/elasticsearch';
import { IBaseResponse, IPaginationParams } from '../../shared/interfaces/base.interface';

/**
 * Enhanced interface for search query parameters with analyzer and timeout support
 * Supports both simple (<200ms) and complex (<500ms) search operations
 */
export interface ISearchQuery {
  /** Search query string */
  query: string;
  /** Optional filters to narrow search results */
  filters?: Record<string, any>;
  /** Pagination parameters for result set */
  pagination: IPaginationParams;
  /** Custom analyzer configuration for text analysis */
  analyzer?: string;
  /** Query timeout configuration (e.g., '200ms' for simple, '500ms' for complex) */
  timeout?: string;
}

/**
 * Enhanced interface for individual search result items with suggestions
 * Provides comprehensive result data including relevance scoring and highlighting
 */
export interface ISearchResult {
  /** Unique identifier of the search result */
  id: string;
  /** Relevance score from Elasticsearch */
  score: number;
  /** Original document source */
  source: Record<string, any>;
  /** Highlighted matches in search results */
  highlights?: Record<string, string[]>;
  /** Search suggestions for query enhancement */
  suggestions?: string[];
}

/**
 * Enhanced interface for search response data with performance monitoring
 * Extends IBaseResponse for consistent API response structure
 */
export interface ISearchResponse extends IBaseResponse<ISearchResult[]> {
  /** Array of search result items */
  hits: ISearchResult[];
  /** Total number of matching documents */
  total: number;
  /** Search execution time in milliseconds */
  took: number;
  /** Aggregation results if requested */
  aggregations?: Record<string, any>;
  /** Indicates if search timed out */
  timedOut: boolean;
}

/**
 * Interface for Elasticsearch index configuration
 * Supports cluster configuration and advanced analyzer settings
 */
export interface IIndexConfig {
  /** Index name */
  name: string;
  /** Index settings including shards, replicas, and analyzers */
  settings: Record<string, any>;
  /** Field mappings and types */
  mappings: Record<string, any>;
  /** Index aliases for zero-downtime reindexing */
  aliases?: string[];
}

/**
 * Enhanced interface for configurable search options with caching support
 * Provides fine-grained control over search behavior and performance
 */
export interface ISearchOptions {
  /** Target index name */
  index: string;
  /** Document type (deprecated in ES 7+, included for backward compatibility) */
  type?: string;
  /** Highlighting configuration */
  highlight?: Record<string, any>;
  /** Aggregation definitions */
  aggregations?: Record<string, any>;
  /** Custom analyzer configuration */
  analyzer?: Record<string, any>;
  /** Cache timeout in milliseconds */
  cacheTimeout?: number;
}

/**
 * Type alias for Elasticsearch native search request
 * Provides type safety for raw Elasticsearch queries
 */
export type ElasticsearchSearchRequest = SearchRequest;

/**
 * Type alias for Elasticsearch search template request
 * Supports reusable search templates
 */
export type ElasticsearchTemplateRequest = SearchTemplateRequest;