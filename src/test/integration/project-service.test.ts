/**
 * @fileoverview Integration tests for Project Service verifying project management operations,
 * security, performance, and data integrity.
 * @version 1.0.0
 */

import { TestDatabaseManager } from '../utils/test-database';
import supertest from 'supertest'; // ^6.3.0
import { performance } from '@testing-library/performance-monitor'; // ^1.0.0
import { SecurityValidator } from '@testing-library/security-validator'; // ^1.0.0
import { HTTP_STATUS, ERROR_CODES } from '../../backend/shared/constants';
import type { IBaseResponse, IErrorResponse } from '../../backend/shared/interfaces/base.interface';

// Global test configuration
jest.setTimeout(TEST_TIMEOUT);
const API_BASE_URL = '/api/v1/projects';

describe('Project Service Integration Tests', () => {
  let dbManager: TestDatabaseManager;
  let request: supertest.SuperTest<supertest.Test>;
  let perfMonitor: typeof performance;
  let securityValidator: SecurityValidator;
  let authToken: string;
  let testUser: {
    id: string;
    email: string;
    role: string;
  };

  beforeAll(async () => {
    // Initialize test environment
    dbManager = new TestDatabaseManager({
      database: 'task_manager_test_projects'
    });
    await dbManager.init();

    // Setup test application and supertest instance
    const app = require('../../backend/app').default;
    request = supertest(app);

    // Initialize performance monitoring
    perfMonitor = performance.createMonitor({
      threshold: API_RESPONSE_THRESHOLD,
      logSlowRequests: true
    });

    // Setup security validation
    securityValidator = new SecurityValidator({
      validateHeaders: true,
      validatePayloads: true,
      validateResponses: true
    });

    // Create test user and get auth token
    testUser = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'test.admin@example.com',
      role: 'ADMIN'
    };
    const loginResponse = await request
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
        password: 'Test@123456'
      });
    authToken = loginResponse.body.data.token;
  });

  afterAll(async () => {
    await dbManager.cleanup();
    perfMonitor.destroy();
  });

  describe('Project Hierarchy Management', () => {
    let parentProjectId: string;
    let childProjectId: string;

    test('should create parent project with valid data', async () => {
      const startTime = performance.now();
      
      const response = await request
        .post(API_BASE_URL)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Parent Project',
          description: 'Main project container',
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        });

      const duration = performance.now() - startTime;
      perfMonitor.recordMetric('createProject', duration);

      expect(response.status).toBe(HTTP_STATUS.CREATED);
      expect(response.body.success).toBe(true);
      securityValidator.validateResponse(response);
      
      parentProjectId = response.body.data.id;
    });

    test('should create child project with valid parent reference', async () => {
      const startTime = performance.now();
      
      const response = await request
        .post(API_BASE_URL)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Child Project',
          description: 'Sub-project',
          parentId: parentProjectId,
          startDate: '2024-02-01',
          endDate: '2024-06-30'
        });

      const duration = performance.now() - startTime;
      perfMonitor.recordMetric('createChildProject', duration);

      expect(response.status).toBe(HTTP_STATUS.CREATED);
      expect(response.body.data.parentId).toBe(parentProjectId);
      securityValidator.validateResponse(response);
      
      childProjectId = response.body.data.id;
    });

    test('should retrieve project hierarchy', async () => {
      const response = await request
        .get(`${API_BASE_URL}/${parentProjectId}/hierarchy`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.body.data.children).toHaveLength(1);
      expect(response.body.data.children[0].id).toBe(childProjectId);
      securityValidator.validateResponse(response);
    });
  });

  describe('Timeline Visualization', () => {
    test('should calculate and return project timeline data', async () => {
      const projectId = await createTestProject();
      
      const response = await request
        .get(`${API_BASE_URL}/${projectId}/timeline`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.body.data).toHaveProperty('milestones');
      expect(response.body.data).toHaveProperty('dependencies');
      securityValidator.validateResponse(response);
    });

    test('should update project timeline with valid data', async () => {
      const projectId = await createTestProject();
      
      const response = await request
        .patch(`${API_BASE_URL}/${projectId}/timeline`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          startDate: '2024-03-01',
          endDate: '2024-08-31',
          milestones: [
            {
              name: 'Phase 1',
              date: '2024-04-01'
            }
          ]
        });

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.body.data.milestones).toHaveLength(1);
      securityValidator.validateResponse(response);
    });
  });

  describe('Resource Allocation', () => {
    test('should allocate resources to project', async () => {
      const projectId = await createTestProject();
      
      const response = await request
        .post(`${API_BASE_URL}/${projectId}/resources`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          resources: [
            {
              userId: testUser.id,
              role: 'PROJECT_MANAGER',
              allocation: 100
            }
          ]
        });

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.body.data.resources).toHaveLength(1);
      securityValidator.validateResponse(response);
    });

    test('should validate resource allocation constraints', async () => {
      const projectId = await createTestProject();
      
      const response = await request
        .post(`${API_BASE_URL}/${projectId}/resources`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          resources: [
            {
              userId: testUser.id,
              role: 'PROJECT_MANAGER',
              allocation: 150 // Invalid allocation percentage
            }
          ]
        });

      expect(response.status).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(response.body.errorCode).toBe(ERROR_CODES.VALIDATION_ERROR);
      securityValidator.validateResponse(response);
    });
  });

  // Helper function to create test project
  async function createTestProject(): Promise<string> {
    const response = await request
      .post(API_BASE_URL)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Project',
        description: 'Project for testing',
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      });

    return response.body.data.id;
  }
});