/**
 * @fileoverview Elasticsearch configuration and client setup with high-availability,
 * performance optimizations, and robust error handling for the search service.
 * @version Elasticsearch 8.0.0
 */

import { Client, ConnectionOptions } from '@elastic/elasticsearch'; // v8.0.0
import { Logger } from 'winston'; // v3.8.2
import { IIndexConfig } from '../interfaces/search.interface';

/**
 * Default Elasticsearch cluster configuration with high-availability settings
 */
export const elasticsearchConfig: ConnectionOptions = {
  nodes: process.env.ELASTICSEARCH_NODES?.split(',') || ['http://localhost:9200'],
  auth: {
    username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
    password: process.env.ELASTICSEARCH_PASSWORD || '',
  },
  ssl: {
    rejectUnauthorized: process.env.NODE_ENV === 'production',
    ca: process.env.ELASTICSEARCH_CA || '',
  },
  maxRetries: 3,
  requestTimeout: 30000, // 30 seconds
  sniffOnStart: true,
  compression: true,
  healthCheck: {
    interval: 30000, // 30 seconds
  },
  nodeSelector: 'round-robin',
};

/**
 * Default index settings optimized for performance and reliability
 */
const DEFAULT_INDEX_SETTINGS = {
  number_of_shards: 3,
  number_of_replicas: 2,
  refresh_interval: '1s',
  analysis: {
    analyzer: {
      custom_analyzer: {
        type: 'custom',
        tokenizer: 'standard',
        filter: ['lowercase', 'asciifolding', 'trim', 'word_delimiter_graph'],
      },
    },
  },
  // Performance optimizations
  'index.search.slowlog.threshold.query.warn': '10s',
  'index.search.slowlog.threshold.fetch.warn': '1s',
  'index.indexing.slowlog.threshold.index.warn': '10s',
  'index.routing.allocation.total_shards_per_node': 3,
  'index.queries.cache.enabled': true,
};

/**
 * Creates and configures an Elasticsearch client instance with retry logic and health checks
 * @returns Promise<Client> Configured Elasticsearch client instance
 * @throws Error if client initialization fails
 */
export const createElasticsearchClient = async (): Promise<Client> => {
  try {
    const client = new Client(elasticsearchConfig);

    // Verify cluster health and connectivity
    await client.cluster.health({
      wait_for_status: 'yellow',
      timeout: '30s',
    });

    // Configure client-side circuit breaker
    client.extend('utility', ({ client }) => ({
      async isHealthy() {
        try {
          const health = await client.cluster.health();
          return health.status !== 'red';
        } catch {
          return false;
        }
      },
    }));

    return client;
  } catch (error) {
    throw new Error(`Failed to initialize Elasticsearch client: ${error.message}`);
  }
};

/**
 * Generates optimized index configuration with performance settings and mappings
 * @param indexName - Name of the index to configure
 * @param customSettings - Optional custom settings to merge with defaults
 * @returns Promise<IIndexConfig> Complete index configuration
 */
export const getIndexConfiguration = async (
  indexName: string,
  customSettings: Record<string, any> = {}
): Promise<IIndexConfig> => {
  const baseConfig: IIndexConfig = {
    name: indexName,
    settings: {
      ...DEFAULT_INDEX_SETTINGS,
      // Index lifecycle management
      'index.lifecycle.name': 'search_policy',
      'index.lifecycle.rollover_alias': `${indexName}_alias`,
    },
    mappings: {
      dynamic: 'strict',
      _source: {
        enabled: true,
      },
      properties: {
        id: { type: 'keyword' },
        title: {
          type: 'text',
          analyzer: 'custom_analyzer',
          fields: {
            keyword: {
              type: 'keyword',
              ignore_above: 256,
            },
          },
        },
        content: {
          type: 'text',
          analyzer: 'custom_analyzer',
          term_vector: 'with_positions_offsets',
        },
        created_at: { type: 'date' },
        updated_at: { type: 'date' },
      },
    },
    aliases: {
      [`${indexName}_read`]: {},
      [`${indexName}_write`]: {
        is_write_index: true,
      },
    },
  };

  // Merge custom settings with base configuration
  return {
    ...baseConfig,
    settings: {
      ...baseConfig.settings,
      ...customSettings,
    },
  };
};

/**
 * Performance monitoring configuration for search operations
 */
export const searchPerformanceConfig = {
  simpleQueryTimeout: '200ms',
  complexQueryTimeout: '500ms',
  scrollTimeout: '1m',
  maxResultWindow: 10000,
  trackTotalHits: true,
};

export default {
  elasticsearchConfig,
  createElasticsearchClient,
  getIndexConfiguration,
  searchPerformanceConfig,
};