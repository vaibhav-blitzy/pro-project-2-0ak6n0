import type { Config } from 'jest';
// @ts-jest version: ^29.1.0
import { defaults as tsjPreset } from 'ts-jest/presets';
// @testing-library/jest-dom version: ^5.16.5
import '@testing-library/jest-dom';

/**
 * Comprehensive Jest configuration for the Task Management System test suite
 * Implements testing requirements from Technical Specification sections:
 * - 4.2.2 Supporting Libraries
 * - 7.3.5 Security Testing
 * - A.1.2 Performance Benchmarks
 * - A.1.1 Browser Compatibility Matrix
 */
const config: Config = {
  // TypeScript configuration with ts-jest preset
  preset: 'ts-jest',
  transform: {
    ...tsjPreset.transform,
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: '<rootDir>/src/test/tsconfig.json',
    }],
  },

  // Test environment configuration
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: [
    '@testing-library/jest-dom',
    '<rootDir>/src/test/setup.ts'
  ],

  // Test file patterns
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx)',
    '**/?(*.)+(spec|test).+(ts|tsx)'
  ],

  // Module resolution and path mapping
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@test/(.*)$': '<rootDir>/src/test/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/src/test/__mocks__/fileMock.ts'
  },

  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/test/**/*',
    '!src/**/index.ts',
    '!src/types/**/*',
    '!src/**/*.stories.{ts,tsx}'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html'],

  // Performance and resource configuration
  maxWorkers: '50%',
  testTimeout: 10000,
  slowTestThreshold: 5000,

  // Mock and cleanup behavior
  clearMocks: true,
  restoreMocks: true,
  resetMocks: false,

  // Verbose output for CI/CD integration
  verbose: true,
  bail: 1,

  // Global configuration
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/src/test/tsconfig.json',
      diagnostics: {
        warnOnly: true
      }
    }
  },

  // Error handling
  errorOnDeprecated: true,
  
  // Snapshot configuration
  snapshotFormat: {
    printBasicPrototype: false,
    escapeString: true
  },

  // Watch plugin configuration
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ]
};

export default config;