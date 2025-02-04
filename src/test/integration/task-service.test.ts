/**
 * @fileoverview Integration tests for Task Service with comprehensive validation
 * of task management operations including CRUD, security, and performance metrics.
 * @version 1.0.0
 */

import { testApiClient } from '../utils/api-client';
import { TestDatabaseManager } from '../utils/test-database';
import { ApiResponse, ApiError, isApiError } from '../../web/src/types/api.types';
import { HTTP_STATUS } from '../../backend/shared/constants';
import { TASKS } from '../../web/src/constants/api.constants';

// Test configuration constants
const TEST_TASK_DATA = {
  title: 'Test Task',
  description: 'Test Description',
  priority: 'HIGH',
  status: 'TODO',
  dueDate: '2024-12-31'
};

const API_BASE_URL = 'http://localhost:8080/api/v1/tasks';
const PERFORMANCE_THRESHOLD_MS = 500;
const SECURITY_HEADERS = {
  contentSecurityPolicy: "default-src 'self'",
  xFrameOptions: 'DENY',
  xContentTypeOptions: 'nosniff'
};

describe('Task Service Integration Tests', () => {
  let dbManager: TestDatabaseManager;
  let apiClient: ReturnType<typeof testApiClient.createTestApiClient>;
  let testTaskId: string;

  beforeAll(async () => {
    // Initialize test environment
    dbManager = new TestDatabaseManager({
      database: 'task_manager_test',
      host: 'localhost',
      port: 5432
    });
    await dbManager.init();

    // Set up API client with security and performance monitoring
    apiClient = testApiClient.createTestApiClient({
      baseURL: API_BASE_URL,
      validateSecurity: true,
      timeout: 5000
    });

    // Set up authentication token
    await testApiClient.setupAuthToken('test-token', { validateToken: true });
  });

  afterAll(async () => {
    await dbManager.cleanup();
  });

  beforeEach(async () => {
    await dbManager.beginTransaction();
  });

  afterEach(async () => {
    await dbManager.rollbackTransaction();
  });

  describe('Task Creation', () => {
    it('should create a task with valid data within performance threshold', async () => {
      const startTime = Date.now();

      const response = await apiClient.apiClient.post(TASKS.BASE, TEST_TASK_DATA);

      // Validate response structure and data
      expect(response.status).toBe(HTTP_STATUS.CREATED);
      expect(response.data).toHaveProperty('id');
      expect(response.data.title).toBe(TEST_TASK_DATA.title);

      // Validate performance
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);

      // Validate security headers
      expect(response.headers).toMatchObject(SECURITY_HEADERS);

      testTaskId = response.data.id;
    });

    it('should reject task creation with invalid data', async () => {
      const invalidTask = { ...TEST_TASK_DATA, title: '' };

      try {
        await apiClient.apiClient.post(TASKS.BASE, invalidTask);
        fail('Should have thrown validation error');
      } catch (error) {
        if (isApiError(error)) {
          expect(error.response?.status).toBe(HTTP_STATUS.BAD_REQUEST);
          expect(error.response?.data).toHaveProperty('errorCode', 'VALIDATION_ERROR');
        }
      }
    });
  });

  describe('Task Retrieval', () => {
    it('should retrieve task by ID with performance validation', async () => {
      const startTime = Date.now();

      const response = await apiClient.apiClient.get(`${TASKS.BASE}/${testTaskId}`);

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.data.id).toBe(testTaskId);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
    });

    it('should handle non-existent task retrieval', async () => {
      try {
        await apiClient.apiClient.get(`${TASKS.BASE}/non-existent-id`);
        fail('Should have thrown not found error');
      } catch (error) {
        if (isApiError(error)) {
          expect(error.response?.status).toBe(HTTP_STATUS.NOT_FOUND);
        }
      }
    });
  });

  describe('Task Update', () => {
    it('should update task with valid data and validate security', async () => {
      const updateData = {
        ...TEST_TASK_DATA,
        title: 'Updated Task Title',
        status: 'IN_PROGRESS'
      };

      const response = await apiClient.apiClient.put(
        `${TASKS.BASE}/${testTaskId}`,
        updateData
      );

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.data.title).toBe(updateData.title);
      expect(response.headers).toMatchObject(SECURITY_HEADERS);
    });

    it('should validate task status transitions', async () => {
      const invalidStatusUpdate = {
        ...TEST_TASK_DATA,
        status: 'INVALID_STATUS'
      };

      try {
        await apiClient.apiClient.put(
          `${TASKS.BASE}/${testTaskId}`,
          invalidStatusUpdate
        );
        fail('Should have thrown validation error');
      } catch (error) {
        if (isApiError(error)) {
          expect(error.response?.status).toBe(HTTP_STATUS.BAD_REQUEST);
        }
      }
    });
  });

  describe('Task Deletion', () => {
    it('should delete task and verify deletion', async () => {
      const response = await apiClient.apiClient.delete(`${TASKS.BASE}/${testTaskId}`);
      expect(response.status).toBe(HTTP_STATUS.NO_CONTENT);

      try {
        await apiClient.apiClient.get(`${TASKS.BASE}/${testTaskId}`);
        fail('Should have thrown not found error');
      } catch (error) {
        if (isApiError(error)) {
          expect(error.response?.status).toBe(HTTP_STATUS.NOT_FOUND);
        }
      }
    });
  });

  describe('Performance Tests', () => {
    it('should handle bulk task creation within performance threshold', async () => {
      const tasks = Array.from({ length: 10 }, (_, i) => ({
        ...TEST_TASK_DATA,
        title: `Bulk Task ${i + 1}`
      }));

      const startTime = Date.now();
      const response = await apiClient.apiClient.post(`${TASKS.BASE}/bulk`, tasks);

      expect(response.status).toBe(HTTP_STATUS.CREATED);
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS * 2);
    });
  });

  describe('Security Validation', () => {
    it('should enforce authentication for protected endpoints', async () => {
      // Remove auth token
      delete apiClient.apiClient.defaults.headers.common['Authorization'];

      try {
        await apiClient.apiClient.get(TASKS.BASE);
        fail('Should have thrown unauthorized error');
      } catch (error) {
        if (isApiError(error)) {
          expect(error.response?.status).toBe(HTTP_STATUS.UNAUTHORIZED);
        }
      }
    });

    it('should validate required security headers in response', async () => {
      const response = await apiClient.apiClient.get(TASKS.BASE);
      
      expect(response.headers).toHaveProperty('content-security-policy');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-content-type-options');
    });
  });
});