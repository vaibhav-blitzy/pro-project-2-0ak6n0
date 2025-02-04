// @ts-check
import { check } from 'k6'; // v0.45.0
import { Faker } from '@faker-js/faker'; // v8.0.0
import { ApiClient } from '../../utils/api-client';
import { measureApiResponse } from '../../utils/performance-metrics';
import { ISearchQuery } from '../../../backend/search-service/src/interfaces/search.interface';

// Initialize faker instance for generating realistic search data
const faker = new Faker();

// Performance thresholds based on technical requirements
const PERFORMANCE_THRESHOLDS = {
  SIMPLE_SEARCH: 200, // ms
  COMPLEX_SEARCH: 500, // ms
};

// Search query patterns for realistic test scenarios
const QUERY_PATTERNS = {
  SIMPLE: {
    weight: 0.7, // 70% of queries should be simple
    generators: [
      () => faker.word.words(2),
      () => faker.company.name(),
      () => faker.person.fullName(),
    ]
  },
  COMPLEX: {
    weight: 0.3, // 30% of queries should be complex
    generators: [
      () => ({
        query: faker.word.words(3),
        filters: {
          status: faker.helpers.arrayElement(['active', 'pending', 'completed']),
          priority: faker.helpers.arrayElement(['high', 'medium', 'low']),
          dateRange: {
            from: faker.date.past(),
            to: faker.date.future()
          }
        }
      })
    ]
  }
};

/**
 * Generates a diverse mix of search queries for load testing
 * @param {number} count - Number of queries to generate
 * @param {object} options - Generation options
 * @returns {Array<ISearchQuery>} Array of search queries
 */
export function generateSearchQueries(count, options = {}) {
  const queries = [];
  
  for (let i = 0; i < count; i++) {
    const isSimpleQuery = Math.random() < QUERY_PATTERNS.SIMPLE.weight;
    const pattern = isSimpleQuery ? QUERY_PATTERNS.SIMPLE : QUERY_PATTERNS.COMPLEX;
    const generator = faker.helpers.arrayElement(pattern.generators);
    
    const baseQuery = generator();
    
    const query = {
      query: typeof baseQuery === 'string' ? baseQuery : baseQuery.query,
      filters: typeof baseQuery === 'string' ? {} : baseQuery.filters,
      pagination: {
        page: faker.number.int({ min: 1, max: 10 }),
        limit: faker.number.int({ min: 10, max: 50 }),
        sortBy: faker.helpers.arrayElement(['relevance', 'date', 'priority']),
        sortOrder: faker.helpers.arrayElement(['asc', 'desc'])
      },
      analyzer: isSimpleQuery ? 'standard' : 'custom',
      timeout: isSimpleQuery ? '200ms' : '500ms'
    };
    
    queries.push(query);
  }
  
  return queries;
}

/**
 * Executes load testing scenario for simple keyword-based searches
 * @param {object} options - Test configuration options
 * @returns {Promise<void>}
 */
export async function simpleSearchScenario(options = {}) {
  const apiClient = new ApiClient({
    baseURL: options.baseURL || 'http://localhost:3000/api',
    timeout: PERFORMANCE_THRESHOLDS.SIMPLE_SEARCH
  });

  const queries = generateSearchQueries(options.queryCount || 100, { type: 'simple' });
  
  for (const query of queries) {
    const response = await measureApiResponse(
      apiClient.post('/search', query),
      { queryType: 'simple', query }
    );
    
    check(response, {
      'simple search response time within threshold': (r) => 
        r.duration < PERFORMANCE_THRESHOLDS.SIMPLE_SEARCH,
      'simple search returns valid results': (r) => 
        r.data && Array.isArray(r.data.hits)
    });
  }
}

/**
 * Executes load testing scenario for complex filtered searches
 * @param {object} options - Test configuration options
 * @returns {Promise<void>}
 */
export async function complexSearchScenario(options = {}) {
  const apiClient = new ApiClient({
    baseURL: options.baseURL || 'http://localhost:3000/api',
    timeout: PERFORMANCE_THRESHOLDS.COMPLEX_SEARCH
  });

  const queries = generateSearchQueries(options.queryCount || 50, { type: 'complex' });
  
  for (const query of queries) {
    const response = await measureApiResponse(
      apiClient.post('/search/advanced', query),
      { queryType: 'complex', query }
    );
    
    check(response, {
      'complex search response time within threshold': (r) => 
        r.duration < PERFORMANCE_THRESHOLDS.COMPLEX_SEARCH,
      'complex search returns valid results': (r) => 
        r.data && Array.isArray(r.data.hits),
      'complex search includes aggregations': (r) => 
        r.data && r.data.aggregations
    });
  }
}

/**
 * Main entry point for executing search load testing scenarios
 * @returns {Promise<void>}
 */
export default async function() {
  const options = {
    stages: [
      { duration: '1m', target: 10 },  // Ramp-up
      { duration: '5m', target: 50 },  // Sustained load
      { duration: '1m', target: 100 }, // Peak load
      { duration: '1m', target: 0 }    // Scale down
    ],
    thresholds: {
      'simple_search_duration': ['p95<200'],
      'complex_search_duration': ['p95<500']
    }
  };

  try {
    // Execute simple search scenario
    await simpleSearchScenario({
      queryCount: 1000,
      baseURL: __ENV.API_BASE_URL
    });

    // Execute complex search scenario
    await complexSearchScenario({
      queryCount: 500,
      baseURL: __ENV.API_BASE_URL
    });
  } catch (error) {
    console.error('Search load test failed:', error);
    throw error;
  }
}