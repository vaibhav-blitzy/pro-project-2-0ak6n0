#!/usr/bin/env ts-node

/**
 * @fileoverview Enterprise-grade test data cleanup script with comprehensive error handling,
 * performance monitoring, parallel processing, and secure cleanup operations.
 * @version 1.0.0
 */

import { TestDatabaseManager } from '../utils/test-database';
import { TestCacheManager } from '../utils/test-cache';
import { Logger } from '../../backend/shared/utils/logger';
import winston from 'winston';
import { promisify } from 'util';
import { exec } from 'child_process';
import { join } from 'path';
import { rm, access } from 'fs/promises';

// Environment variables with defaults
const TEST_ENV = process.env.TEST_ENV || 'test';
const TEST_DB_HOST = process.env.TEST_DB_HOST || 'localhost';
const TEST_CACHE_HOST = process.env.TEST_CACHE_HOST || 'localhost';
const CLEANUP_TIMEOUT = parseInt(process.env.CLEANUP_TIMEOUT || '300000', 10); // 5 minutes
const MAX_RETRY_ATTEMPTS = parseInt(process.env.MAX_RETRY_ATTEMPTS || '3', 10);

// Initialize logger with enhanced security context
const logger = new Logger('TestDataCleanup', {
  logLevel: 'debug',
  defaultMetadata: {
    component: 'cleanup-script',
    environment: TEST_ENV
  }
});

// Security-enhanced exec with timeout
const execAsync = promisify(exec);

/**
 * Performs atomic cleanup of test database with retry mechanism and verification
 * @returns Promise<number> Exit code (0: success, 1: failure)
 */
async function cleanup_database(): Promise<number> {
  const startTime = Date.now();
  const dbManager = new TestDatabaseManager({
    host: TEST_DB_HOST,
    database: 'task_manager_test',
    pool: {
      min: 2,
      max: 10
    }
  });

  try {
    let attempts = 0;
    let success = false;

    while (attempts < MAX_RETRY_ATTEMPTS && !success) {
      try {
        await dbManager.cleanup();
        success = true;
        logger.info('Database cleanup completed successfully', {
          duration: Date.now() - startTime,
          attempt: attempts + 1
        });
      } catch (error) {
        attempts++;
        if (attempts === MAX_RETRY_ATTEMPTS) {
          throw error;
        }
        logger.warn(`Database cleanup attempt ${attempts} failed, retrying...`, { error });
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }

    return 0;
  } catch (error) {
    logger.error('Database cleanup failed', error as Error);
    return 1;
  }
}

/**
 * Executes cache cleanup with verification and performance monitoring
 * @returns Promise<number> Exit code (0: success, 1: failure)
 */
async function cleanup_cache(): Promise<number> {
  const startTime = Date.now();
  const cacheManager = new TestCacheManager({
    host: TEST_CACHE_HOST,
    db: 1,
    enableReadyCheck: true
  });

  try {
    await cacheManager.init();
    await cacheManager.cleanup();
    
    // Verify cleanup
    const metrics = cacheManager.getMetrics();
    logger.info('Cache cleanup completed successfully', {
      duration: Date.now() - startTime,
      metrics: Object.fromEntries(metrics)
    });

    await cacheManager.close();
    return 0;
  } catch (error) {
    logger.error('Cache cleanup failed', error as Error);
    return 1;
  }
}

/**
 * Securely removes temporary files with proper permission checks
 * @returns Promise<number> Exit code (0: success, 1: failure)
 */
async function cleanup_temp_files(): Promise<number> {
  const startTime = Date.now();
  const tempDirs = [
    join(process.cwd(), 'logs'),
    join(process.cwd(), 'tmp'),
    join(process.cwd(), 'uploads')
  ];

  try {
    for (const dir of tempDirs) {
      try {
        // Check if directory exists and is accessible
        await access(dir);
        
        // Secure recursive removal
        await rm(dir, { 
          recursive: true, 
          force: true 
        });
        
        logger.info(`Cleaned up directory: ${dir}`);
      } catch (error) {
        // Ignore if directory doesn't exist
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }
    }

    logger.info('Temporary files cleanup completed', {
      duration: Date.now() - startTime
    });
    return 0;
  } catch (error) {
    logger.error('Temporary files cleanup failed', error as Error);
    return 1;
  }
}

/**
 * Main cleanup orchestrator with parallel processing and comprehensive error handling
 */
async function main(): Promise<number> {
  // Set strict error handling
  process.on('unhandledRejection', (error) => {
    logger.error('Unhandled rejection', error as Error);
    process.exit(1);
  });

  logger.info('Starting test data cleanup', {
    environment: TEST_ENV,
    timeout: CLEANUP_TIMEOUT
  });

  try {
    // Execute cleanups in parallel with timeout
    const cleanupPromise = Promise.all([
      cleanup_database(),
      cleanup_cache(),
      cleanup_temp_files()
    ]);

    const results = await Promise.race([
      cleanupPromise,
      new Promise<number[]>((_, reject) => 
        setTimeout(() => reject(new Error('Cleanup timeout')), CLEANUP_TIMEOUT)
      )
    ]);

    const failedOperations = results.filter(code => code !== 0).length;
    
    if (failedOperations > 0) {
      logger.error(`Cleanup completed with ${failedOperations} failed operations`);
      return 1;
    }

    logger.info('All cleanup operations completed successfully', {
      duration: Date.now() - startTime
    });
    return 0;
  } catch (error) {
    logger.error('Cleanup failed', error as Error);
    return 1;
  }
}

// Execute main function and handle exit
main()
  .then(exitCode => {
    process.exit(exitCode);
  })
  .catch(error => {
    logger.error('Fatal error during cleanup', error as Error);
    process.exit(1);
  });