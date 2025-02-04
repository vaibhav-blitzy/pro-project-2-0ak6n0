/**
 * @fileoverview Comprehensive performance test suite for measuring and validating search latency
 * across different types of search operations in the Task Management System.
 * @version 1.0.0
 */

import { describe, it, beforeAll, afterAll } from 'jest'; // v29.0.0
import { expect } from '@jest/globals'; // v29.0.0
import { ISearchQuery } from '../../backend/search-service/src/interfaces/search.interface';
import { SearchService } from '../../backend/search-service/src/services/search.service';
import { 
    measureApiResponse, 
    analyzePerformanceMetrics, 
    PerformanceMetricsCollector 
} from '../utils/performance-metrics';

// Test configuration constants
const TEST_CONFIG = {
    DOCUMENT_COUNT: 10000,
    SIMPLE_QUERY_THRESHOLD: 200, // ms
    COMPLEX_QUERY_THRESHOLD: 500, // ms
    TEST_INDEX: 'test_tasks',
    BATCH_SIZE: 1000,
    CONCURRENT_USERS: 50,
    TEST_DURATION: 300000, // 5 minutes
};

// Sample test data generator
const generateTestData = (count: number) => {
    return Array.from({ length: count }, (_, i) => ({
        id: `task-${i}`,
        title: `Test Task ${i}`,
        description: `Detailed description for task ${i} with multiple searchable terms`,
        status: i % 2 === 0 ? 'active' : 'completed',
        priority: ['high', 'medium', 'low'][i % 3],
        tags: [`tag-${i % 5}`, `category-${i % 3}`],
        created_at: new Date().toISOString(),
    }));
};

describe('Search Service Performance Tests', () => {
    let searchService: SearchService;
    let metricsCollector: PerformanceMetricsCollector;

    beforeAll(async () => {
        // Initialize services and collectors
        searchService = new SearchService(null);
        metricsCollector = new PerformanceMetricsCollector(
            {}, // Use default thresholds
            {
                retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
                rotationSize: 10000,
                storageType: 'persistent'
            }
        );

        // Setup test data
        const testData = generateTestData(TEST_CONFIG.DOCUMENT_COUNT);
        await setupTestData(searchService, testData);
    });

    afterAll(async () => {
        await cleanupTestData(searchService);
    });

    describe('Simple Search Performance', () => {
        it('should perform simple keyword search within 200ms threshold', async () => {
            const simpleQuery: ISearchQuery = {
                query: 'Test Task',
                pagination: {
                    page: 1,
                    limit: 10,
                    sortBy: 'created_at',
                    sortOrder: 'desc'
                }
            };

            const metric = await measureApiResponse(
                searchService.search(simpleQuery, TEST_CONFIG.TEST_INDEX),
                { queryType: 'simple', queryTerms: simpleQuery.query }
            );

            await metricsCollector.addMetric(metric);
            expect(metric.duration).toBeLessThan(TEST_CONFIG.SIMPLE_QUERY_THRESHOLD);
        });
    });

    describe('Complex Search Performance', () => {
        it('should perform complex search within 500ms threshold', async () => {
            const complexQuery: ISearchQuery = {
                query: 'high priority active',
                filters: {
                    status: 'active',
                    priority: 'high'
                },
                pagination: {
                    page: 1,
                    limit: 20,
                    sortBy: 'created_at',
                    sortOrder: 'desc'
                },
                aggregations: {
                    status_counts: {
                        terms: { field: 'status' }
                    },
                    priority_counts: {
                        terms: { field: 'priority' }
                    }
                }
            };

            const metric = await measureApiResponse(
                searchService.search(complexQuery, TEST_CONFIG.TEST_INDEX),
                { queryType: 'complex', filters: complexQuery.filters }
            );

            await metricsCollector.addMetric(metric);
            expect(metric.duration).toBeLessThan(TEST_CONFIG.COMPLEX_QUERY_THRESHOLD);
        });
    });

    describe('Search Performance Under Load', () => {
        it('should maintain performance under concurrent load', async () => {
            const concurrentQueries = Array.from(
                { length: TEST_CONFIG.CONCURRENT_USERS },
                (_, i) => ({
                    query: `Test Task ${i % 100}`,
                    pagination: {
                        page: 1,
                        limit: 10,
                        sortBy: 'created_at',
                        sortOrder: 'desc'
                    }
                })
            );

            const startTime = Date.now();
            const results = await Promise.all(
                concurrentQueries.map(query =>
                    measureApiResponse(
                        searchService.search(query, TEST_CONFIG.TEST_INDEX),
                        { queryType: 'concurrent', userId: `user-${Math.random()}` }
                    )
                )
            );

            const analysis = analyzePerformanceMetrics(results);
            expect(analysis.percentiles.p95).toBeLessThan(TEST_CONFIG.SIMPLE_QUERY_THRESHOLD * 1.5);
            expect(analysis.percentiles.p99).toBeLessThan(TEST_CONFIG.SIMPLE_QUERY_THRESHOLD * 2);
        });
    });

    describe('Search Performance Degradation', () => {
        it('should not show significant performance degradation over time', async () => {
            const startTime = Date.now();
            const metrics = [];

            while (Date.now() - startTime < TEST_CONFIG.TEST_DURATION) {
                const query: ISearchQuery = {
                    query: `Test Task ${Math.floor(Math.random() * 100)}`,
                    pagination: {
                        page: 1,
                        limit: 10,
                        sortBy: 'created_at',
                        sortOrder: 'desc'
                    }
                };

                const metric = await measureApiResponse(
                    searchService.search(query, TEST_CONFIG.TEST_INDEX),
                    { queryType: 'degradation_test', timestamp: Date.now() }
                );

                metrics.push(metric);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            const analysis = analyzePerformanceMetrics(metrics, {
                timeRange: [new Date(startTime), new Date()],
                detectAnomalies: true,
                trendAnalysis: true
            });

            expect(analysis.trends.degradation).toBeLessThan(1.5);
        });
    });
});

async function setupTestData(searchService: SearchService, data: any[]): Promise<void> {
    try {
        const indexConfig = {
            name: TEST_CONFIG.TEST_INDEX,
            settings: {
                number_of_shards: 3,
                number_of_replicas: 1,
                refresh_interval: '1s'
            },
            mappings: {
                properties: {
                    id: { type: 'keyword' },
                    title: { type: 'text', analyzer: 'custom_analyzer' },
                    description: { type: 'text', analyzer: 'custom_analyzer' },
                    status: { type: 'keyword' },
                    priority: { type: 'keyword' },
                    tags: { type: 'keyword' },
                    created_at: { type: 'date' }
                }
            }
        };

        // Create test index with optimized settings
        await searchService['indexBuilder'].createIndex(indexConfig);

        // Bulk index test data
        for (let i = 0; i < data.length; i += TEST_CONFIG.BATCH_SIZE) {
            const batch = data.slice(i, i + TEST_CONFIG.BATCH_SIZE);
            await searchService.bulkIndex(TEST_CONFIG.TEST_INDEX, batch, {
                refresh: true
            });
        }

        // Verify index health and document count
        await searchService['validateClusterHealth']();
    } catch (error) {
        throw new Error(`Failed to setup test data: ${error.message}`);
    }
}

async function cleanupTestData(searchService: SearchService): Promise<void> {
    try {
        await searchService['indexBuilder'].deleteIndex(TEST_CONFIG.TEST_INDEX);
    } catch (error) {
        throw new Error(`Failed to cleanup test data: ${error.message}`);
    }
}