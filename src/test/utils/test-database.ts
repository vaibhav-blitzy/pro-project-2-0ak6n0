/**
 * @fileoverview Enhanced test database utility module providing comprehensive database management
 * for testing scenarios with connection pooling, transaction support, and resource optimization.
 * @version 1.0.0
 */

import { Logger } from '../../backend/shared/utils/logger';
import { Pool, PoolConfig } from 'pg'; // ^8.11.0
import Knex from 'knex'; // ^2.5.0

// Default configuration for test database with optimized settings
export const DEFAULT_TEST_DB_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'task_manager_test',
  pool: {
    min: 2,
    max: 10
  },
  acquireConnectionTimeout: 10000
};

/**
 * Enhanced database manager class with connection pooling and transaction support
 */
export class TestDatabaseManager {
  private knexInstance: Knex;
  private logger: Logger;
  private config: any;
  private connectionPool: Pool;
  private preparedStatements: Map<string, any>;

  /**
   * Creates a new TestDatabaseManager instance with enhanced configuration
   * @param config - Database configuration options
   */
  constructor(config: typeof DEFAULT_TEST_DB_CONFIG) {
    this.config = {
      ...DEFAULT_TEST_DB_CONFIG,
      ...config
    };
    
    this.logger = new Logger('TestDatabaseManager', {
      defaultMetadata: { context: 'database-testing' }
    });
    
    this.preparedStatements = new Map();
    
    // Initialize Knex with enhanced configuration
    this.knexInstance = Knex({
      client: 'pg',
      connection: this.config,
      pool: {
        min: this.config.pool.min,
        max: this.config.pool.max,
        afterCreate: (conn: any, done: Function) => {
          // Set session configuration for test isolation
          conn.query('SET session_replication_role = replica;', (err: Error) => {
            done(err, conn);
          });
        }
      }
    });

    // Initialize connection pool with enhanced settings
    this.connectionPool = new Pool({
      ...this.config,
      statement_timeout: 10000, // 10s statement timeout
      query_timeout: 20000 // 20s query timeout
    });
  }

  /**
   * Initializes database connection with enhanced error handling
   */
  public async init(): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Verify database connection
      await this.connectionPool.query('SELECT 1');
      
      // Initialize schema within transaction
      await this.executeTransaction(async (trx) => {
        await trx.raw('DROP SCHEMA IF EXISTS public CASCADE');
        await trx.raw('CREATE SCHEMA public');
        
        // Run migrations
        await this.knexInstance.migrate.latest();
        
        // Verify schema integrity
        await this.verifySchemaIntegrity(trx);
      });

      const duration = Date.now() - startTime;
      this.logger.info('Database initialization completed', { duration });
      
    } catch (error) {
      this.logger.error('Failed to initialize test database', error);
      throw error;
    }
  }

  /**
   * Enhanced cleanup with resource management
   */
  public async cleanup(): Promise<void> {
    try {
      const startTime = Date.now();
      
      await this.executeTransaction(async (trx) => {
        // Get all tables
        const tables = await trx.raw(`
          SELECT tablename FROM pg_tables 
          WHERE schemaname = 'public'
        `);
        
        // Disable triggers temporarily
        await trx.raw('SET session_replication_role = replica');
        
        // Truncate all tables in reverse dependency order
        for (const { tablename } of tables.rows) {
          await trx.raw(`TRUNCATE TABLE "${tablename}" CASCADE`);
        }
        
        // Reset sequences
        const sequences = await trx.raw(`
          SELECT sequence_name FROM information_schema.sequences 
          WHERE sequence_schema = 'public'
        `);
        
        for (const { sequence_name } of sequences.rows) {
          await trx.raw(`ALTER SEQUENCE "${sequence_name}" RESTART WITH 1`);
        }
        
        // Re-enable triggers
        await trx.raw('SET session_replication_role = origin');
      });

      // Clear prepared statement cache
      this.preparedStatements.clear();
      
      // Release connection pool
      await this.connectionPool.end();
      await this.knexInstance.destroy();

      const duration = Date.now() - startTime;
      this.logger.info('Database cleanup completed', { duration });
      
    } catch (error) {
      this.logger.error('Failed to cleanup test database', error);
      throw error;
    }
  }

  /**
   * Executes database operations with enhanced transaction support
   * @param transactionCallback - Callback function to execute within transaction
   */
  public async executeTransaction<T>(
    transactionCallback: (trx: Knex.Transaction) => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      // Execute transaction with isolation level
      const result = await this.knexInstance.transaction(async (trx) => {
        await trx.raw('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
        return await transactionCallback(trx);
      });

      const duration = Date.now() - startTime;
      this.logger.info('Transaction completed successfully', { duration });
      
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Transaction failed', error, { duration });
      throw error;
    }
  }

  /**
   * Verifies schema integrity after initialization
   * @param trx - Transaction instance
   */
  private async verifySchemaIntegrity(trx: Knex.Transaction): Promise<void> {
    const constraints = await trx.raw(`
      SELECT conname, contype, conrelid::regclass AS table_name
      FROM pg_constraint
      WHERE connamespace = 'public'::regnamespace
    `);
    
    if (constraints.rows.length === 0) {
      throw new Error('Schema integrity check failed: No constraints found');
    }
  }
}

/**
 * Initializes a clean test database instance with required schema
 * @param config - Database configuration
 */
export async function initializeTestDatabase(
  config: typeof DEFAULT_TEST_DB_CONFIG = DEFAULT_TEST_DB_CONFIG
): Promise<void> {
  const dbManager = new TestDatabaseManager(config);
  await dbManager.init();
}

/**
 * Cleans up test database with enhanced transaction support
 */
export async function cleanupTestDatabase(): Promise<void> {
  const dbManager = new TestDatabaseManager(DEFAULT_TEST_DB_CONFIG);
  await dbManager.cleanup();
}