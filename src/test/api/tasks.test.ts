/**
 * @fileoverview Comprehensive API integration tests for task management functionality
 * Implements thorough testing of CRUD operations, security, performance, and error handling
 * @version 1.0.0
 */

import { tasksApi } from '../../web/src/api/tasks.api';
import { Task, TaskStatus } from '../../web/src/interfaces/task.interface';
import { setupTestEnvironment, teardownTestEnvironment } from '../utils/test-helpers';
import { generateMockTask } from '../utils/mock-data';
import now from 'performance-now'; // ^2.1.0
import supertest from 'supertest'; // ^6.3.3
import { jest } from '@types/jest'; // ^29.5.0

// Test environment configuration
const TEST_TIMEOUT = 30000;
const PERFORMANCE_THRESHOLD = 500; // 500ms SLA requirement
const BATCH_SIZE = 10;

describe('Task API Integration Tests', () => {
  let testEnv: any;
  let mockTask: Task;

  // Setup test environment before all tests
  beforeAll(async () => {
    testEnv = await setupTestEnvironment({
      securityValidation: true,
      performanceMonitoring: true
    });

    // Configure test timeouts
    jest.setTimeout(TEST_TIMEOUT);
  });

  // Cleanup test environment after all tests
  afterAll(async () => {
    await teardownTestEnvironment(testEnv);
  });

  // Reset test state before each test
  beforeEach(async () => {
    mockTask = generateMockTask();
    await testEnv.db?.cleanup();
    await testEnv.cache?.cleanup();
  });

  describe('Task CRUD Operations', () => {
    test('should create a new task with valid data', async () => {
      const startTime = now();

      const response = await tasksApi.createTask({
        title: mockTask.title,
        description: mockTask.description,
        projectId: mockTask.projectId,
        assigneeId: mockTask.assigneeId,
        priority: mockTask.priority,
        dueDate: mockTask.dueDate
      });

      const duration = now() - startTime;

      // Validate response structure
      expect(response.data).toBeDefined();
      expect(response.data.id).toBeDefined();
      expect(response.data.title).toBe(mockTask.title);

      // Validate performance
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD);

      // Validate security headers
      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['x-request-id']).toBeDefined();
    });

    test('should retrieve tasks with pagination and filtering', async () => {
      // Create test tasks
      const tasks = await Promise.all(
        Array(BATCH_SIZE).fill(null).map(() => tasksApi.createTask(generateMockTask()))
      );

      const response = await tasksApi.getTasks({
        page: 1,
        pageSize: 5,
        status: TaskStatus.NEW,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });

      expect(response.data.items).toHaveLength(5);
      expect(response.data.total).toBeGreaterThanOrEqual(BATCH_SIZE);
      expect(response.data.hasNext).toBe(true);
    });

    test('should update task with valid data', async () => {
      const createdTask = await tasksApi.createTask(mockTask);
      const updateData = {
        title: 'Updated Title',
        status: TaskStatus.IN_PROGRESS
      };

      const response = await tasksApi.updateTask(createdTask.data.id, updateData);

      expect(response.data.title).toBe(updateData.title);
      expect(response.data.status).toBe(updateData.status);
      expect(response.data.updatedAt).not.toBe(response.data.createdAt);
    });

    test('should delete task and verify deletion', async () => {
      const createdTask = await tasksApi.createTask(mockTask);
      await tasksApi.deleteTask(createdTask.data.id);

      await expect(
        tasksApi.getTaskById(createdTask.data.id)
      ).rejects.toThrow('Task not found');
    });
  });

  describe('Task Security Tests', () => {
    test('should reject unauthorized access', async () => {
      // Remove auth token
      testEnv.api.removeAuthToken();

      await expect(
        tasksApi.getTasks({})
      ).rejects.toThrow('Unauthorized');
    });

    test('should validate input against XSS attacks', async () => {
      const maliciousTask = {
        ...mockTask,
        title: '<script>alert("xss")</script>'
      };

      await expect(
        tasksApi.createTask(maliciousTask)
      ).rejects.toThrow('Invalid input');
    });

    test('should enforce rate limiting', async () => {
      const requests = Array(1001).fill(null).map(() => tasksApi.getTasks({}));

      await expect(
        Promise.all(requests)
      ).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('Task Performance Tests', () => {
    test('should meet response time SLA for bulk operations', async () => {
      const startTime = now();

      const tasks = await Promise.all(
        Array(100).fill(null).map(() => tasksApi.createTask(generateMockTask()))
      );

      const duration = now() - startTime;
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD * 2);
    });

    test('should handle concurrent updates efficiently', async () => {
      const task = await tasksApi.createTask(mockTask);
      const updates = Array(10).fill(null).map((_, index) => ({
        title: `Concurrent Update ${index}`,
        status: TaskStatus.IN_PROGRESS
      }));

      const startTime = now();
      await Promise.all(
        updates.map(update => tasksApi.updateTask(task.data.id, update))
      );
      const duration = now() - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD * updates.length);
    });
  });

  describe('Task Attachment Tests', () => {
    test('should handle file uploads securely', async () => {
      const task = await tasksApi.createTask(mockTask);
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' });

      const response = await tasksApi.uploadTaskAttachment(task.data.id, file);

      expect(response.data.attachments).toHaveLength(1);
      expect(response.headers['content-security-policy']).toBeDefined();
    });

    test('should reject invalid file types', async () => {
      const task = await tasksApi.createTask(mockTask);
      const file = new File(['test'], 'malicious.exe', { type: 'application/x-msdownload' });

      await expect(
        tasksApi.uploadTaskAttachment(task.data.id, file)
      ).rejects.toThrow('Invalid file type');
    });
  });

  describe('Error Handling Tests', () => {
    test('should handle network errors gracefully', async () => {
      // Simulate network failure
      testEnv.api.simulateNetworkError();

      await expect(
        tasksApi.getTasks({})
      ).rejects.toThrow('Network Error');
    });

    test('should handle validation errors with details', async () => {
      const invalidTask = {
        ...mockTask,
        title: '', // Required field
      };

      try {
        await tasksApi.createTask(invalidTask);
      } catch (error: any) {
        expect(error.code).toBe('VALIDATION_ERROR');
        expect(error.details.field).toBe('title');
      }
    });
  });
});