/**
 * @fileoverview Projects API Client
 * Implements secure, performant API client functions for project management operations
 * with comprehensive error handling, response monitoring, and security features.
 * @version 1.0.0
 */

import { apiClient, buildQueryString, processApiResponse } from '../utils/api.utils';
import { Project, CreateProjectDTO } from '../interfaces/project.interface';
import { ApiResponse, PaginatedResponse, ApiQueryParams } from '../types/api.types';
import { PROJECTS } from '../constants/api.constants';
import CircuitBreaker from 'circuit-breaker-ts'; // ^2.0.0

// Initialize circuit breaker for project operations
const projectCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 60000,
  timeout: 30000
});

/**
 * Retrieves all projects with pagination, filtering, and security measures
 * @param params - Query parameters for filtering, pagination, and sorting
 * @returns Promise resolving to paginated project list with security validation
 */
const getAllProjects = async (params?: ApiQueryParams): Promise<PaginatedResponse<Project>> => {
  try {
    const queryString = buildQueryString(params);
    const response = await projectCircuitBreaker.execute(() =>
      apiClient.get<ApiResponse<PaginatedResponse<Project>>>(
        `${PROJECTS.BASE}${queryString}`
      )
    );

    return processApiResponse<PaginatedResponse<Project>>(response).data;
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    throw error;
  }
};

/**
 * Retrieves a specific project by ID with security validation
 * @param projectId - Unique identifier of the project
 * @returns Promise resolving to project details with security checks
 */
const getProjectById = async (projectId: string): Promise<Project> => {
  try {
    const response = await projectCircuitBreaker.execute(() =>
      apiClient.get<ApiResponse<Project>>(
        PROJECTS.BY_ID.replace(':id', projectId)
      )
    );

    return processApiResponse<Project>(response).data;
  } catch (error) {
    console.error(`Failed to fetch project ${projectId}:`, error);
    throw error;
  }
};

/**
 * Creates a new project with security validation and monitoring
 * @param projectData - Validated project creation data
 * @returns Promise resolving to created project with security checks
 */
const createProject = async (projectData: CreateProjectDTO): Promise<Project> => {
  try {
    const response = await projectCircuitBreaker.execute(() =>
      apiClient.post<ApiResponse<Project>>(
        PROJECTS.BASE,
        projectData
      )
    );

    return processApiResponse<Project>(response).data;
  } catch (error) {
    console.error('Failed to create project:', error);
    throw error;
  }
};

/**
 * Updates an existing project with security validation
 * @param projectId - Project identifier
 * @param projectData - Partial project data for update
 * @returns Promise resolving to updated project with security checks
 */
const updateProject = async (
  projectId: string,
  projectData: Partial<CreateProjectDTO>
): Promise<Project> => {
  try {
    const response = await projectCircuitBreaker.execute(() =>
      apiClient.put<ApiResponse<Project>>(
        PROJECTS.BY_ID.replace(':id', projectId),
        projectData
      )
    );

    return processApiResponse<Project>(response).data;
  } catch (error) {
    console.error(`Failed to update project ${projectId}:`, error);
    throw error;
  }
};

/**
 * Retrieves project timeline with security validation
 * @param projectId - Project identifier
 * @returns Promise resolving to project timeline data
 */
const getProjectTimeline = async (projectId: string): Promise<any> => {
  try {
    const response = await projectCircuitBreaker.execute(() =>
      apiClient.get<ApiResponse<any>>(
        PROJECTS.TIMELINE.replace(':id', projectId)
      )
    );

    return processApiResponse<any>(response).data;
  } catch (error) {
    console.error(`Failed to fetch timeline for project ${projectId}:`, error);
    throw error;
  }
};

/**
 * Retrieves project statistics with security validation
 * @param projectId - Project identifier
 * @returns Promise resolving to project statistics
 */
const getProjectStatistics = async (projectId: string): Promise<any> => {
  try {
    const response = await projectCircuitBreaker.execute(() =>
      apiClient.get<ApiResponse<any>>(
        PROJECTS.STATISTICS.replace(':id', projectId)
      )
    );

    return processApiResponse<any>(response).data;
  } catch (error) {
    console.error(`Failed to fetch statistics for project ${projectId}:`, error);
    throw error;
  }
};

/**
 * Manages project members with security validation
 * @param projectId - Project identifier
 * @param memberData - Member management data
 * @returns Promise resolving to updated member list
 */
const manageProjectMembers = async (
  projectId: string,
  memberData: { userIds: string[], role: string }
): Promise<any> => {
  try {
    const response = await projectCircuitBreaker.execute(() =>
      apiClient.post<ApiResponse<any>>(
        PROJECTS.MEMBERS.replace(':id', projectId),
        memberData
      )
    );

    return processApiResponse<any>(response).data;
  } catch (error) {
    console.error(`Failed to manage members for project ${projectId}:`, error);
    throw error;
  }
};

// Export the projects API interface
export const projectsApi = {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  getProjectTimeline,
  getProjectStatistics,
  manageProjectMembers
};

export default projectsApi;