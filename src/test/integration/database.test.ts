/**
 * @fileoverview Integration tests for database operations in Task Management System
 * Validates database security, performance, and data integrity requirements
 * @version 1.0.0
 */

import { TestDatabaseManager } from '../utils/test-database';
import { generateMockUser, generateMockTask, generateMockProject } from '../utils/mock-data';
import { Logger } from '../../backend/shared/utils/logger';
import { HTTP_STATUS, ERROR_CODES } from '../../backend/shared/constants';
import { UserRole } from '../../backend/auth-service/src/interfaces/auth.interface';
import knex from 'knex';

// Global test configuration
const TEST_DB_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'task_manager_test',
  user: 'test_user',
  password: 'test_password',
  ssl: true,
  pool: { min: 2, max: 10 }
};

const SECURITY_CONFIG = {
  encryption: 'AES-256-GCM',
  saltRounds: 12,
  tokenExpiry: '1h'
};

const PERFORMANCE_THRESHOLDS = {
  queryTimeout: 500,
  maxConnections: 50,
  slowQueryThreshold: 100
};

/**
 * Sets up test database with security configurations
 */
beforeAll(async () => {
  const dbManager = new TestDatabaseManager(TEST_DB_CONFIG);
  const logger = new Logger('DatabaseIntegrationTest', {
    defaultMetadata: { context: 'integration-test' }
  });

  try {
    await dbManager.init();
    logger.info('Test database initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize test database', error);
    throw error;
  }
});

/**
 * Cleans up test database with secure data disposal
 */
afterAll(async () => {
  const dbManager = new TestDatabaseManager(TEST_DB_CONFIG);
  const logger = new Logger('DatabaseIntegrationTest');

  try {
    await dbManager.cleanup();
    logger.info('Test database cleaned up successfully');
  } catch (error) {
    logger.error('Failed to cleanup test database', error);
    throw error;
  }
});

/**
 * Database integration test suite with security and performance validation
 */
export class DatabaseIntegrationTests {
  private dbManager: TestDatabaseManager;
  private knex: knex;
  private logger: Logger;

  constructor() {
    this.dbManager = new TestDatabaseManager(TEST_DB_CONFIG);
    this.knex = this.dbManager.getKnexInstance();
    this.logger = new Logger('DatabaseIntegrationTests');
  }

  /**
   * Tests database security features and configurations
   */
  async testSecurityFeatures() {
    describe('Database Security Features', () => {
      let testUser;

      beforeEach(async () => {
        testUser = generateMockUser(UserRole.MEMBER);
      });

      test('should enforce encryption at rest', async () => {
        const startTime = Date.now();
        await this.dbManager.executeTransaction(async (trx) => {
          // Insert user with encrypted sensitive data
          const userId = await trx('users').insert(testUser).returning('id');
          expect(userId).toBeTruthy();

          // Verify encrypted fields
          const storedUser = await trx('users').where({ id: userId }).first();
          expect(storedUser.password).not.toBe(testUser.password);
          expect(storedUser.mfaSecret).not.toBe(testUser.mfaSecret);
        });
        this.logger.recordMetric('encryption_test', Date.now() - startTime);
      });

      test('should prevent SQL injection attacks', async () => {
        const maliciousInput = "'; DROP TABLE users; --";
        await expect(
          this.knex.raw(`SELECT * FROM users WHERE email = '${maliciousInput}'`)
        ).rejects.toThrow();
      });

      test('should validate access control', async () => {
        await this.dbManager.executeTransaction(async (trx) => {
          const result = await this.dbManager.validateSecurityConfig(SECURITY_CONFIG);
          expect(result).toBe(true);
        });
      });
    });
  }

  /**
   * Tests database performance against benchmarks
   */
  async testPerformanceMetrics() {
    describe('Database Performance', () => {
      test('should meet read operation performance benchmarks', async () => {
        const startTime = Date.now();
        await this.dbManager.executeTransaction(async (trx) => {
          await trx('users').select('*').limit(100);
          const duration = Date.now() - startTime;
          expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.queryTimeout);
          this.logger.recordMetric('read_performance', duration);
        });
      });

      test('should meet write operation performance benchmarks', async () => {
        const startTime = Date.now();
        const testUser = generateMockUser(UserRole.MEMBER);
        
        await this.dbManager.executeTransaction(async (trx) => {
          await trx('users').insert(testUser);
          const duration = Date.now() - startTime;
          expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.queryTimeout);
          this.logger.recordMetric('write_performance', duration);
        });
      });

      test('should handle concurrent operations efficiently', async () => {
        const operations = Array(10).fill(null).map(() => 
          this.dbManager.measureQueryPerformance(
            () => this.knex('users').select('*').limit(10)
          )
        );

        const results = await Promise.all(operations);
        results.forEach(duration => {
          expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.slowQueryThreshold);
        });
      });
    });
  }

  /**
   * Tests data integrity and constraints
   */
  async testDataIntegrity() {
    describe('Data Integrity', () => {
      test('should enforce foreign key constraints', async () => {
        await this.dbManager.executeTransaction(async (trx) => {
          const task = generateMockTask();
          await expect(
            trx('tasks').insert(task)
          ).rejects.toThrow();
        });
      });

      test('should maintain ACID properties', async () => {
        await this.dbManager.executeTransaction(async (trx) => {
          const user = generateMockUser(UserRole.MEMBER);
          const project = generateMockProject();

          await trx('users').insert(user);
          await trx('projects').insert(project);

          // Simulate failure
          await expect(
            trx('invalid_table').insert({})
          ).rejects.toThrow();

          // Verify rollback
          const userCount = await trx('users').where({ email: user.email }).count();
          expect(userCount[0].count).toBe('0');
        });
      });
    });
  }
}

// Export test suite for execution
export default DatabaseIntegrationTests;