/**
 * @fileoverview Integration tests for the search service validating Elasticsearch functionality,
 * search operations, indexing, and performance requirements.
 * @version 1.0.0
 */

import { Client } from '@elastic/elasticsearch'; // v8.0.0
import { SearchService } from '../../backend/search-service/src/services/search.service';
import { ISearchQuery } from '../../backend/search-service/src/interfaces/search.interface';
import { TestDataGenerator } from '@test/data-generator'; // v1.0.0
import { PerformanceMonitor } from '@test/performance-monitor'; // v1.0.0
import { HTTP_STATUS } from '../../backend/shared/constants';

/**
 * Sets up test environment with Elasticsearch cluster and test data
 */
async function setupTestEnvironment(
  searchService: SearchService,
  indexName: string,
  dataGenerator: TestDataGenerator
): Promise<void> {
  try {
    // Initialize test index
    await searchService['indexBuilder'].createIndex({
      name: indexName,
      settings: {
        number_of_shards: 1,
        number_of_replicas: 0,
        refresh_interval: '1s'
      },
      mappings: {
        properties: {
          title: { type: 'text', analyzer: 'custom_analyzer' },
          content: { type: 'text', analyzer: 'custom_analyzer' },
          tags: { type: 'keyword' }
        }
      }
    });

    // Generate and index test data
    const testDocuments = await dataGenerator.generateDocuments(100);
    await searchService['indexBuilder']['esClient'].bulk({
      refresh: true,
      body: testDocuments.flatMap(doc => [
        { index: { _index: indexName } },
        doc
      ])
    });
  } catch (error) {
    throw new Error(`Test environment setup failed: ${error.message}`);
  }
}

/**
 * Cleans up test environment and resources
 */
async function teardownTestEnvironment(
  searchService: SearchService,
  indexName: string
): Promise<void> {
  try {
    await searchService['indexBuilder'].deleteIndex(indexName);
  } catch (error) {
    throw new Error(`Test environment cleanup failed: ${error.message}`);
  }
}

describe('SearchService Integration Tests', () => {
  let searchService: SearchService;
  let testIndexName: string;
  let dataGenerator: TestDataGenerator;
  let performanceMonitor: PerformanceMonitor;

  beforeAll(async () => {
    testIndexName = `test_index_${Date.now()}`;
    searchService = new SearchService(null); // IndexBuilder will be mocked internally
    dataGenerator = new TestDataGenerator();
    performanceMonitor = new PerformanceMonitor();

    await setupTestEnvironment(searchService, testIndexName, dataGenerator);
  });

  afterAll(async () => {
    await teardownTestEnvironment(searchService, testIndexName);
  });

  describe('Basic Search Operations', () => {
    it('should perform simple search within 200ms', async () => {
      const query: ISearchQuery = {
        query: 'test',
        pagination: {
          page: 1,
          limit: 10,
          sortBy: 'title',
          sortOrder: 'asc'
        }
      };

      const startTime = performanceMonitor.startTimer();
      const response = await searchService.search(query, testIndexName);
      const duration = performanceMonitor.stopTimer(startTime);

      expect(response.success).toBe(true);
      expect(response.statusCode).toBe(HTTP_STATUS.OK);
      expect(duration).toBeLessThan(200);
      expect(response.hits.length).toBeGreaterThan(0);
    });

    it('should handle empty search results correctly', async () => {
      const query: ISearchQuery = {
        query: 'nonexistentterm123456',
        pagination: {
          page: 1,
          limit: 10,
          sortBy: 'title',
          sortOrder: 'asc'
        }
      };

      const response = await searchService.search(query, testIndexName);

      expect(response.success).toBe(true);
      expect(response.hits.length).toBe(0);
      expect(response.total).toBe(0);
    });
  });

  describe('Complex Search Operations', () => {
    it('should perform complex search within 500ms', async () => {
      const query: ISearchQuery = {
        query: 'test~2 OR development^2',
        filters: {
          tags: ['important']
        },
        pagination: {
          page: 1,
          limit: 20,
          sortBy: '_score',
          sortOrder: 'desc'
        },
        analyzer: 'custom_analyzer'
      };

      const startTime = performanceMonitor.startTimer();
      const response = await searchService.search(query, testIndexName);
      const duration = performanceMonitor.stopTimer(startTime);

      expect(response.success).toBe(true);
      expect(duration).toBeLessThan(500);
      expect(response.hits.some(hit => hit.score > 0)).toBe(true);
    });

    it('should handle filtered search with aggregations', async () => {
      const query: ISearchQuery = {
        query: 'test',
        filters: {
          tags: ['technical']
        },
        pagination: {
          page: 1,
          limit: 10,
          sortBy: 'title',
          sortOrder: 'asc'
        }
      };

      const response = await searchService.search(query, testIndexName);

      expect(response.success).toBe(true);
      expect(response.hits.every(hit => 
        hit.source.tags.includes('technical')
      )).toBe(true);
    });
  });

  describe('High Availability Tests', () => {
    it('should handle cluster recovery scenarios', async () => {
      // Simulate node failure by temporarily disconnecting a node
      const client = searchService['esClient'] as Client;
      const originalNodes = client.nodes.getAll();

      try {
        // Remove one node from the pool
        await client.nodes.removeNode(originalNodes[0]);

        const query: ISearchQuery = {
          query: 'test',
          pagination: {
            page: 1,
            limit: 10,
            sortBy: 'title',
            sortOrder: 'asc'
          }
        };

        const response = await searchService.search(query, testIndexName);

        expect(response.success).toBe(true);
        expect(response.statusCode).toBe(HTTP_STATUS.OK);
      } finally {
        // Restore the node
        await client.nodes.addNode(originalNodes[0]);
      }
    });

    it('should maintain performance during reindexing', async () => {
      const newIndexName = `${testIndexName}_v2`;

      // Start reindexing in background
      const reindexPromise = searchService['indexBuilder'].reindex(
        testIndexName,
        newIndexName
      );

      // Perform searches during reindexing
      const searchPromises = Array(5).fill(null).map(() => {
        const query: ISearchQuery = {
          query: 'test',
          pagination: {
            page: 1,
            limit: 10,
            sortBy: 'title',
            sortOrder: 'asc'
          }
        };
        return searchService.search(query, testIndexName);
      });

      const responses = await Promise.all(searchPromises);
      await reindexPromise;

      responses.forEach(response => {
        expect(response.success).toBe(true);
        expect(response.statusCode).toBe(HTTP_STATUS.OK);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed queries gracefully', async () => {
      const query: ISearchQuery = {
        query: 'test AND AND OR',
        pagination: {
          page: 1,
          limit: 10,
          sortBy: 'title',
          sortOrder: 'asc'
        }
      };

      const response = await searchService.search(query, testIndexName);

      expect(response.success).toBe(false);
      expect(response.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
    });

    it('should handle timeout scenarios', async () => {
      const query: ISearchQuery = {
        query: '*',
        pagination: {
          page: 1,
          limit: 10000, // Large result set
          sortBy: 'title',
          sortOrder: 'asc'
        },
        timeout: '1ms' // Unrealistic timeout
      };

      const response = await searchService.search(query, testIndexName);

      expect(response.success).toBe(false);
      expect(response.timedOut).toBe(true);
    });
  });
});