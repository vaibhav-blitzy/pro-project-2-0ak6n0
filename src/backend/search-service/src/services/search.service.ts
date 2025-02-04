/**
 * @fileoverview Enhanced search service implementing Elasticsearch functionality with
 * performance monitoring, high availability, and comprehensive error handling.
 * @version Elasticsearch 8.0.0
 */

import { Client } from '@elastic/elasticsearch'; // v8.0.0
import { Injectable, Logger } from '@nestjs/common'; // v9.0.0
import CircuitBreaker from 'opossum'; // v6.0.0
import { ISearchQuery, ISearchResponse, ISearchResult } from '../interfaces/search.interface';
import { IndexBuilder } from '../utils/index-builder';
import { searchPerformanceConfig } from '../config/elasticsearch.config';
import { HTTP_STATUS, ERROR_CODES } from '../../shared/constants';

@Injectable()
export class SearchService {
    private readonly esClient: Client;
    private readonly logger: Logger;
    private readonly circuitBreaker: CircuitBreaker;

    constructor(private readonly indexBuilder: IndexBuilder) {
        this.logger = new Logger('SearchService');
        this.initializeService();
    }

    /**
     * Initializes the search service with enhanced monitoring and circuit breaker
     */
    private async initializeService(): Promise<void> {
        try {
            // Initialize Elasticsearch client with cluster configuration
            this.esClient = await this.indexBuilder['esClient'];

            // Configure circuit breaker for search operations
            this.circuitBreaker = new CircuitBreaker(this.executeSearch.bind(this), {
                timeout: 3000, // 3 seconds
                errorThresholdPercentage: 50,
                resetTimeout: 30000, // 30 seconds
                rollingCountTimeout: 10000, // 10 seconds
                rollingCountBuckets: 10,
            });

            // Circuit breaker event handlers
            this.circuitBreaker.on('open', () => {
                this.logger.warn('Circuit breaker opened - search service degraded');
            });

            this.circuitBreaker.on('halfOpen', () => {
                this.logger.log('Circuit breaker half-open - attempting recovery');
            });

            this.circuitBreaker.on('close', () => {
                this.logger.log('Circuit breaker closed - service recovered');
            });

            await this.validateClusterHealth();
        } catch (error) {
            this.logger.error(`Service initialization failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Validates Elasticsearch cluster health
     */
    private async validateClusterHealth(): Promise<void> {
        try {
            const health = await this.esClient.cluster.health();
            if (health.status === 'red') {
                throw new Error('Elasticsearch cluster is in red status');
            }
            this.logger.log(`Cluster health: ${health.status}`);
        } catch (error) {
            this.logger.error(`Cluster health check failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Executes search operation with performance monitoring
     */
    private async executeSearch(
        searchQuery: ISearchQuery,
        indexName: string
    ): Promise<ISearchResponse> {
        const startTime = Date.now();
        try {
            const { query, filters, pagination, analyzer, timeout } = searchQuery;
            const searchTimeout = timeout || 
                (this.isComplexQuery(query) ? 
                    searchPerformanceConfig.complexQueryTimeout : 
                    searchPerformanceConfig.simpleQueryTimeout);

            const searchResponse = await this.esClient.search({
                index: indexName,
                body: {
                    query: {
                        bool: {
                            must: [
                                {
                                    multi_match: {
                                        query,
                                        fields: ['title^2', 'content'],
                                        analyzer: analyzer || 'custom_analyzer',
                                    },
                                },
                            ],
                            filter: this.buildFilters(filters),
                        },
                    },
                    highlight: {
                        fields: {
                            title: {},
                            content: {},
                        },
                    },
                    from: (pagination.page - 1) * pagination.limit,
                    size: pagination.limit,
                    sort: [
                        { _score: 'desc' },
                        { [pagination.sortBy]: pagination.sortOrder },
                    ],
                    track_total_hits: true,
                },
                timeout: searchTimeout,
            });

            const results: ISearchResult[] = searchResponse.hits.hits.map(hit => ({
                id: hit._id,
                score: hit._score || 0,
                source: hit._source,
                highlights: hit.highlight,
            }));

            const duration = Date.now() - startTime;
            this.logger.log(`Search completed in ${duration}ms`);

            return {
                success: true,
                message: 'Search completed successfully',
                data: results,
                statusCode: HTTP_STATUS.OK,
                correlationId: searchQuery.correlationId,
                hits: results,
                total: searchResponse.hits.total.value,
                took: duration,
                timedOut: searchResponse.timed_out,
            };
        } catch (error) {
            this.logger.error(`Search operation failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Performs search with circuit breaker protection
     */
    async search(searchQuery: ISearchQuery, indexName: string): Promise<ISearchResponse> {
        try {
            return await this.circuitBreaker.fire(searchQuery, indexName);
        } catch (error) {
            const errorResponse: ISearchResponse = {
                success: false,
                message: `Search failed: ${error.message}`,
                data: [],
                statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
                correlationId: searchQuery.correlationId,
                hits: [],
                total: 0,
                took: 0,
                timedOut: true,
            };

            if (error.meta?.body?.error?.type === 'search_phase_execution_exception') {
                errorResponse.statusCode = HTTP_STATUS.BAD_REQUEST;
            }

            return errorResponse;
        }
    }

    /**
     * Determines if a query is complex based on its characteristics
     */
    private isComplexQuery(query: string): boolean {
        return (
            query.length > 100 ||
            query.includes('"') ||
            query.includes('~') ||
            query.includes('^')
        );
    }

    /**
     * Builds Elasticsearch filters from query parameters
     */
    private buildFilters(filters?: Record<string, any>): any[] {
        if (!filters) return [];
        return Object.entries(filters).map(([field, value]) => ({
            term: { [field]: value },
        }));
    }

    /**
     * Performs bulk indexing with progress tracking
     */
    async bulkIndex(
        indexName: string,
        documents: Record<string, any>[],
        options: { batchSize?: number; refresh?: boolean } = {}
    ): Promise<{ success: boolean; indexed: number; failed: number; errors: any[] }> {
        const batchSize = options.batchSize || 1000;
        const errors: any[] = [];
        let indexed = 0;
        let failed = 0;

        try {
            for (let i = 0; i < documents.length; i += batchSize) {
                const batch = documents.slice(i, i + batchSize);
                const body = batch.flatMap(doc => [
                    { index: { _index: indexName } },
                    doc,
                ]);

                const { items } = await this.esClient.bulk({
                    refresh: options.refresh,
                    body,
                });

                items.forEach(item => {
                    if (item.index?.error) {
                        failed++;
                        errors.push(item.index.error);
                    } else {
                        indexed++;
                    }
                });

                this.logger.log(`Indexed ${indexed}/${documents.length} documents`);
            }

            return { success: failed === 0, indexed, failed, errors };
        } catch (error) {
            this.logger.error(`Bulk indexing failed: ${error.message}`);
            throw error;
        }
    }
}