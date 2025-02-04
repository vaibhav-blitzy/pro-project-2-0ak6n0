/**
 * @fileoverview Project Management API Integration Tests
 * Comprehensive test suite for project-related API endpoints validating
 * functionality, security, performance, and data integrity.
 * @version 1.0.0
 */

import { testApiClient } from '../utils/api-client';
import { API_ENDPOINTS, HTTP_STATUS } from '../../web/src/constants/api.constants';
import { ApiResponse, ApiError, ApiErrorCode } from '../../web/src/types/api.types';
import { UUID, BaseEntity } from '../../web/src/types/common.types';
import supertest from 'supertest'; // ^6.3.0
import performanceNow from 'performance-now'; // ^2.1.0
import { SecurityTestUtils } from '@testing-library/security-utils'; // ^1.2.0
import { DataValidator } from '@testing-library/data-validation'; // ^1.0.0

// Test data interfaces
interface ProjectData extends BaseEntity {
  name: string;
  description: string;
  ownerId: UUID;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  metadata: Record<string, unknown>;
}

enum ProjectStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
  COMPLETED = 'COMPLETED',
  DRAFT = 'DRAFT'
}

describe('Project Management API Integration Tests', () => {
  const { apiClient, metrics } = testApiClient.createTestApiClient({
    validateSecurity: true,
    timeout: 5000
  });

  let adminToken: string;
  let userToken: string;
  let testProject: ProjectData;
  const securityUtils = new SecurityTestUtils();
  const dataValidator = new DataValidator();

  beforeAll(async () => {
    // Setup test environment
    adminToken = await setupAdminUser();
    userToken = await setupRegularUser();
    await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await generateTestReport();
  });

  beforeEach(() => {
    // Reset metrics and security context for each test
    metrics.responseTimes = [];
    securityUtils.resetContext();
  });

  describe('Project Creation', () => {
    it('should create a project with valid data and proper authorization', async () => {
      testApiClient.setupAuthToken(adminToken);
      
      const projectData = {
        name: 'Test Project',
        description: 'Integration test project',
        status: ProjectStatus.ACTIVE,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
        metadata: { priority: 'high' }
      };

      const startTime = performanceNow();
      const response = await apiClient.post<ApiResponse<ProjectData>>(
        API_ENDPOINTS.PROJECTS.BASE,
        projectData
      );
      const endTime = performanceNow();

      // Validate response time SLA
      expect(endTime - startTime).toBeLessThan(500);

      // Validate response structure and data
      expect(response.status).toBe(HTTP_STATUS.CREATED);
      expect(response.data.data).toMatchObject(projectData);

      // Validate security headers
      securityUtils.validateResponseHeaders(response.headers);

      // Validate data integrity
      await dataValidator.validateEntityCreation(response.data.data);

      testProject = response.data.data;
    });

    it('should prevent XSS attacks in project data', async () => {
      testApiClient.setupAuthToken(adminToken);
      
      const maliciousData = {
        name: '<script>alert("xss")</script>Test Project',
        description: 'Test <img src="x" onerror="alert(1)">',
        status: ProjectStatus.ACTIVE
      };

      const response = await apiClient.post<ApiResponse<ProjectData>>(
        API_ENDPOINTS.PROJECTS.BASE,
        maliciousData
      );

      expect(response.data.data.name).not.toContain('<script>');
      expect(response.data.data.description).not.toContain('onerror');
      securityUtils.validateXSSPrevention(response.data.data);
    });
  });

  describe('Project Retrieval', () => {
    it('should retrieve project details with proper authorization', async () => {
      testApiClient.setupAuthToken(userToken);
      
      const startTime = performanceNow();
      const response = await apiClient.get<ApiResponse<ProjectData>>(
        `${API_ENDPOINTS.PROJECTS.BY_ID.replace(':id', testProject.id)}`
      );
      const endTime = performanceNow();

      expect(endTime - startTime).toBeLessThan(500);
      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.data.data).toEqual(testProject);
    });

    it('should handle pagination and filtering correctly', async () => {
      testApiClient.setupAuthToken(userToken);
      
      const response = await apiClient.get<ApiResponse<ProjectData[]>>(
        API_ENDPOINTS.PROJECTS.BASE,
        {
          params: {
            page: 1,
            pageSize: 10,
            status: ProjectStatus.ACTIVE
          }
        }
      );

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(Array.isArray(response.data.data)).toBe(true);
      expect(response.headers['x-total-count']).toBeDefined();
    });
  });

  describe('Project Updates', () => {
    it('should update project with valid data and maintain history', async () => {
      testApiClient.setupAuthToken(adminToken);
      
      const updateData = {
        name: 'Updated Project Name',
        description: 'Updated description'
      };

      const response = await apiClient.put<ApiResponse<ProjectData>>(
        `${API_ENDPOINTS.PROJECTS.BY_ID.replace(':id', testProject.id)}`,
        updateData
      );

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.data.data.name).toBe(updateData.name);
      expect(response.data.data.version).not.toBe(testProject.version);

      // Validate audit trail
      const historyResponse = await apiClient.get(
        `${API_ENDPOINTS.PROJECTS.ACTIVITY.replace(':id', testProject.id)}`
      );
      expect(historyResponse.data.data).toContainEqual(
        expect.objectContaining({ type: 'UPDATE' })
      );
    });
  });

  describe('Project Permissions', () => {
    it('should enforce role-based access control', async () => {
      testApiClient.setupAuthToken(userToken);
      
      const deleteResponse = await apiClient.delete(
        `${API_ENDPOINTS.PROJECTS.BY_ID.replace(':id', testProject.id)}`
      );

      expect(deleteResponse.status).toBe(HTTP_STATUS.FORBIDDEN);
      expect(deleteResponse.data.error?.code).toBe(ApiErrorCode.FORBIDDEN);
    });

    it('should handle project member management securely', async () => {
      testApiClient.setupAuthToken(adminToken);
      
      const memberResponse = await apiClient.post(
        `${API_ENDPOINTS.PROJECTS.MEMBERS.replace(':id', testProject.id)}`,
        { userId: 'test-user-id', role: 'VIEWER' }
      );

      expect(memberResponse.status).toBe(HTTP_STATUS.OK);
      securityUtils.validatePermissionAssignment(memberResponse.data);
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle concurrent requests within SLA', async () => {
      const requests = Array(10).fill(null).map(() => 
        apiClient.get(API_ENDPOINTS.PROJECTS.BASE)
      );

      const startTime = performanceNow();
      const responses = await Promise.all(requests);
      const endTime = performanceNow();

      const avgResponseTime = (endTime - startTime) / requests.length;
      expect(avgResponseTime).toBeLessThan(500);

      responses.forEach(response => {
        expect(response.status).toBe(HTTP_STATUS.OK);
      });
    });
  });
});

// Helper Functions
async function setupAdminUser(): Promise<string> {
  // Implementation for creating admin user and getting token
  return 'admin-token';
}

async function setupRegularUser(): Promise<string> {
  // Implementation for creating regular user and getting token
  return 'user-token';
}

async function setupTestData(): Promise<void> {
  // Implementation for setting up test data
}

async function cleanupTestData(): Promise<void> {
  // Implementation for cleaning up test data
}

async function generateTestReport(): Promise<void> {
  // Implementation for generating test report with metrics
}