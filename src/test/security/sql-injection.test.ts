/**
 * @fileoverview Enterprise-grade SQL injection vulnerability test suite
 * Implements comprehensive security validation for database operations with
 * performance monitoring and detailed failure analysis.
 * @version 1.0.0
 */

import { TestDatabaseManager } from '../utils/test-database';
import { generateSecurityTestData } from '../utils/security-helpers';
import { jest } from '@jest/globals';
import { HTTP_STATUS, ERROR_CODES } from '../../backend/shared/constants/index';

// Initialize test database manager
const testDatabaseManager = new TestDatabaseManager();

// Test configuration constants
const TEST_TIMEOUT = 5000;
const PERFORMANCE_THRESHOLD = 500;

// SQL injection test patterns
const SQL_INJECTION_PATTERNS = [
  { input: "' OR '1'='1", expected: 'sanitized' },
  { input: '; DROP TABLE users;', expected: 'sanitized' },
  { input: '1 UNION SELECT * FROM users', expected: 'sanitized' },
  { input: "' OR 1=1--", expected: 'sanitized' },
  { input: "admin'--", expected: 'sanitized' },
  { input: '1; SELECT @@version', expected: 'sanitized' },
  { input: "' UNION SELECT NULL,NULL,NULL--", expected: 'sanitized' },
  { input: "' OR 'x'='x", expected: 'sanitized' },
  { input: '1 OR sleep(5)', expected: 'sanitized' },
  { input: "' WAITFOR DELAY '0:0:5'--", expected: 'sanitized' }
];

describe('SQL Injection Prevention', () => {
  beforeAll(async () => {
    // Initialize test environment with security configurations
    try {
      await testDatabaseManager.init();
      
      // Set up test schema and tables
      await testDatabaseManager.executeTransaction(async (trx) => {
        await trx.raw(`
          CREATE TABLE IF NOT EXISTS test_users (
            id UUID PRIMARY KEY,
            username VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
      });

      // Generate test data
      const { testCases } = generateSecurityTestData('sql-injection', {
        complexity: 'high',
        includePayloads: true
      });

    } catch (error) {
      console.error('Test setup failed:', error);
      throw error;
    }
  }, TEST_TIMEOUT);

  afterAll(async () => {
    try {
      // Clean up test data and connections
      await testDatabaseManager.executeTransaction(async (trx) => {
        await trx.raw('DROP TABLE IF EXISTS test_users');
      });
      await testDatabaseManager.cleanup();
    } catch (error) {
      console.error('Test cleanup failed:', error);
      throw error;
    }
  });

  describe('Parameterized Query Tests', () => {
    it('should prevent SQL injection in parameterized queries', async () => {
      const startTime = Date.now();

      for (const pattern of SQL_INJECTION_PATTERNS) {
        await testDatabaseManager.executeTransaction(async (trx) => {
          // Test SELECT query
          const selectResult = await trx.raw(
            'SELECT * FROM test_users WHERE username = ?',
            [pattern.input]
          );
          expect(selectResult.rows).toBeDefined();

          // Test INSERT query
          const insertResult = await trx.raw(
            'INSERT INTO test_users (id, username, email) VALUES (?, ?, ?) RETURNING *',
            [
              crypto.randomUUID(),
              pattern.input,
              'test@example.com'
            ]
          );
          expect(insertResult.rows[0]).toBeDefined();
        });
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD);
    }, TEST_TIMEOUT);

    it('should handle SQL injection attempts in complex queries', async () => {
      const startTime = Date.now();

      await testDatabaseManager.executeTransaction(async (trx) => {
        for (const pattern of SQL_INJECTION_PATTERNS) {
          // Test complex JOIN query
          const result = await trx.raw(`
            WITH user_data AS (
              SELECT * FROM test_users WHERE username = ?
            )
            SELECT * FROM user_data
            WHERE email LIKE ?
          `, [pattern.input, '%test%']);

          expect(result.rows).toBeDefined();
          expect(Array.isArray(result.rows)).toBe(true);
        }
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD);
    }, TEST_TIMEOUT);
  });

  describe('Error Handling Tests', () => {
    it('should properly handle and sanitize error messages', async () => {
      for (const pattern of SQL_INJECTION_PATTERNS) {
        try {
          await testDatabaseManager.executeTransaction(async (trx) => {
            await trx.raw('SELECT * FROM nonexistent_table WHERE id = ?', [pattern.input]);
          });
          fail('Should have thrown an error');
        } catch (error) {
          expect(error.message).not.toContain('syntax error');
          expect(error.message).not.toContain('SELECT');
          expect(error.message).not.toContain('FROM');
        }
      }
    });

    it('should validate error responses for security', async () => {
      try {
        await testDatabaseManager.executeTransaction(async (trx) => {
          await trx.raw('INSERT INTO test_users (id, username) VALUES (?, ?)', [
            crypto.randomUUID(),
            SQL_INJECTION_PATTERNS[0].input
          ]);
        });
      } catch (error) {
        expect(error.code).not.toContain('42P01');
        expect(error.detail).not.toContain('SELECT');
        expect(error.hint).toBeFalsy();
      }
    });
  });

  describe('Performance Impact Tests', () => {
    it('should maintain performance under injection attempts', async () => {
      const iterations = 100;
      const startTime = Date.now();

      await testDatabaseManager.executeTransaction(async (trx) => {
        const promises = Array(iterations).fill(null).map((_, index) => {
          return trx.raw(
            'SELECT * FROM test_users WHERE username = ? OR email = ?',
            [SQL_INJECTION_PATTERNS[index % SQL_INJECTION_PATTERNS.length].input, 'test@example.com']
          );
        });

        await Promise.all(promises);
      });

      const duration = Date.now() - startTime;
      const averageTime = duration / iterations;
      expect(averageTime).toBeLessThan(PERFORMANCE_THRESHOLD / iterations);
    }, TEST_TIMEOUT * 2);
  });

  describe('Transaction Security Tests', () => {
    it('should maintain transaction integrity during injection attempts', async () => {
      await testDatabaseManager.executeTransaction(async (trx) => {
        const initialCount = await trx.raw('SELECT COUNT(*) FROM test_users');
        
        try {
          await trx.raw(
            'INSERT INTO test_users (id, username, email) VALUES (?, ?, ?)',
            [crypto.randomUUID(), SQL_INJECTION_PATTERNS[0].input, 'test@example.com']
          );
          
          await trx.raw(
            'DELETE FROM test_users WHERE username = ?',
            [SQL_INJECTION_PATTERNS[1].input]
          );
        } catch (error) {
          // Transaction should be rolled back
          const finalCount = await trx.raw('SELECT COUNT(*) FROM test_users');
          expect(finalCount.rows[0].count).toEqual(initialCount.rows[0].count);
        }
      });
    });
  });
});