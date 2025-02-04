/**
 * @fileoverview Mock data generation utility for Task Management System testing
 * Provides comprehensive test data generation with enhanced security features
 * Version: 1.0.0
 */

import { faker } from '@faker-js/faker'; // ^8.0.0
import { randomBytes, createHash } from 'crypto';
import { 
  IUser, 
  UserRole, 
  ISecurityQuestion 
} from '../../backend/auth-service/src/interfaces/auth.interface';
import { 
  VALIDATION_RULES, 
  AUDIT_EVENTS 
} from '../../backend/shared/constants';

/**
 * Security clearance levels for enhanced testing
 */
export enum SecurityClearance {
  TOP_SECRET = 'TOP_SECRET',
  SECRET = 'SECRET',
  CONFIDENTIAL = 'CONFIDENTIAL',
  UNCLASSIFIED = 'UNCLASSIFIED'
}

/**
 * Interface for security test configurations
 */
interface SecurityTestConfig {
  includeVulnerabilities: boolean;
  testAuthBypass: boolean;
  testInjection: boolean;
  testXSS: boolean;
}

/**
 * Generates a cryptographically secure random ID
 */
const generateSecureId = (): string => {
  return randomBytes(16).toString('hex');
};

/**
 * Generates a secure password hash
 */
const generatePasswordHash = (password: string): string => {
  return createHash('sha256').update(password).digest('hex');
};

/**
 * Generates mock security questions
 */
const generateSecurityQuestions = (): ISecurityQuestion[] => {
  return Array(3).fill(null).map(() => ({
    question: faker.lorem.sentence(),
    answer: generatePasswordHash(faker.lorem.word()),
    lastUpdated: faker.date.past()
  }));
};

/**
 * Generates audit trail data
 */
const generateAuditData = (userId: string) => ({
  createdAt: faker.date.past(),
  updatedAt: faker.date.recent(),
  createdBy: userId,
  updatedBy: userId,
  version: faker.number.int({ min: 1, max: 10 }),
  deletedAt: null,
  deletedBy: null
});

/**
 * Generates a mock user with enhanced security features
 */
export const generateMockUser = (
  role: UserRole = UserRole.MEMBER,
  clearance: SecurityClearance = SecurityClearance.UNCLASSIFIED,
  rules: typeof VALIDATION_RULES = VALIDATION_RULES,
  overrides: Partial<IUser> = {}
): IUser => {
  const userId = generateSecureId();
  const password = faker.internet.password({
    length: rules.MIN_PASSWORD_LENGTH,
    memorable: true
  });

  const mockUser: IUser = {
    email: faker.internet.email({ provider: 'company.com' }),
    password: generatePasswordHash(password),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    role,
    mfaEnabled: faker.datatype.boolean(),
    mfaSecret: generateSecureId(),
    lastLogin: faker.date.recent(),
    passwordLastChanged: faker.date.past(),
    failedLoginAttempts: faker.number.int({ min: 0, max: 5 }),
    accountLocked: false,
    passwordHistory: Array(3).fill(null).map(() => generatePasswordHash(faker.internet.password())),
    securityQuestions: generateSecurityQuestions(),
    sessionTimeout: 30,
    ...generateAuditData(userId),
    ...overrides
  };

  return mockUser;
};

/**
 * Generates security-focused test data
 */
export const generateSecurityTestData = (
  testType: AUDIT_EVENTS,
  config: SecurityTestConfig
): Record<string, unknown> => {
  const testData: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    testId: generateSecureId(),
    testType,
    securityContext: {
      ipAddress: faker.internet.ip(),
      userAgent: faker.internet.userAgent(),
      geoLocation: {
        latitude: faker.location.latitude(),
        longitude: faker.location.longitude()
      }
    }
  };

  if (config.includeVulnerabilities) {
    testData.vulnerabilityTests = {
      sqlInjection: "'; DROP TABLE users; --",
      xssPayload: "<script>alert('xss')</script>",
      authBypass: "' OR '1'='1",
    };
  }

  return testData;
};

/**
 * Comprehensive mock data generator class
 */
export class MockDataGenerator {
  private readonly securityConfig: SecurityTestConfig;

  constructor(config: SecurityTestConfig) {
    this.securityConfig = config;
  }

  /**
   * Generates a complete test dataset
   */
  public generateTestDataSet(count: number): Record<string, unknown> {
    return {
      users: Array(count).fill(null).map(() => generateMockUser()),
      securityTests: Object.values(AUDIT_EVENTS).map(event => 
        generateSecurityTestData(event, this.securityConfig)
      ),
      metadata: {
        generatedAt: new Date().toISOString(),
        generatedBy: 'MockDataGenerator',
        version: '1.0.0'
      }
    };
  }

  /**
   * Validates generated test data
   */
  public validateTestData(data: Record<string, unknown>): boolean {
    try {
      // Validate user data
      if (Array.isArray(data.users)) {
        for (const user of data.users) {
          if (!user.email || !user.password) {
            return false;
          }
        }
      }

      // Validate security tests
      if (Array.isArray(data.securityTests)) {
        for (const test of data.securityTests) {
          if (!test.testId || !test.testType) {
            return false;
          }
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }
}