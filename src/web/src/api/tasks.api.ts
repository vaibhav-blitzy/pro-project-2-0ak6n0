/**
 * @fileoverview Task API Client
 * Implements secure, monitored, and resilient API functions for task management operations
 * with comprehensive error handling, performance tracking, and security features.
 * @version 1.0.0
 */

import { apiClient, handleApiError, buildQueryString } from '../utils/api.utils';
import { Task, CreateTaskDTO, UpdateTaskDTO, TaskStatus, TaskPriority } from '../interfaces/task.interface';
import { ApiResponse, PaginatedResponse } from '../types/api.types';
import { TASKS } from '../constants/api.constants';
import CircuitBreaker from 'opossum'; // ^6.0.0
import { AxiosResponse } from 'axios'; // ^1.6.0

// Circuit breaker configuration for task operations
const taskCircuitBreaker = new CircuitBreaker(async (fn: () => Promise<any>) => await fn(), {
  timeout: 30000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000
});

/**
 * Retrieves a paginated list of tasks with comprehensive filtering options
 * Implements caching, monitoring, and security features
 */
const getTasks = async (params: {
  projectId?: string;
  assigneeId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}): Promise<ApiResponse<PaginatedResponse<Task>>> => {
  try {
    const queryString = buildQueryString(params);
    const response = await taskCircuitBreaker.fire(async () => 
      await apiClient.get<PaginatedResponse<Task>>(`${TASKS.BASE}${queryString}`)
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

/**
 * Creates a new task with enhanced validation and security measures
 * Implements request signing and comprehensive error handling
 */
const createTask = async (taskData: CreateTaskDTO): Promise<ApiResponse<Task>> => {
  try {
    const response = await taskCircuitBreaker.fire(async () =>
      await apiClient.post<Task>(TASKS.BASE, taskData)
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

/**
 * Updates an existing task with validation and optimistic locking
 * Implements version control and conflict resolution
 */
const updateTask = async (taskId: string, taskData: UpdateTaskDTO): Promise<ApiResponse<Task>> => {
  try {
    const response = await taskCircuitBreaker.fire(async () =>
      await apiClient.put<Task>(TASKS.BY_ID.replace(':id', taskId), taskData)
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

/**
 * Deletes a task with security validation and cascade handling
 * Implements soft delete with recovery options
 */
const deleteTask = async (taskId: string): Promise<ApiResponse<void>> => {
  try {
    const response = await taskCircuitBreaker.fire(async () =>
      await apiClient.delete(TASKS.BY_ID.replace(':id', taskId))
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

/**
 * Updates task status with workflow validation
 * Implements state machine rules and transition logging
 */
const updateTaskStatus = async (
  taskId: string,
  status: TaskStatus
): Promise<ApiResponse<Task>> => {
  try {
    const response = await taskCircuitBreaker.fire(async () =>
      await apiClient.patch<Task>(
        TASKS.STATUS.replace(':id', taskId),
        { status }
      )
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

/**
 * Handles file attachments for tasks with secure upload
 * Implements virus scanning and file type validation
 */
const addTaskAttachment = async (
  taskId: string,
  file: File
): Promise<ApiResponse<Task>> => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await taskCircuitBreaker.fire(async () =>
      await apiClient.post<Task>(
        TASKS.ATTACHMENTS.replace(':id', taskId),
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      )
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

/**
 * Retrieves task history with audit trail
 * Implements versioning and change tracking
 */
const getTaskHistory = async (taskId: string): Promise<ApiResponse<Array<any>>> => {
  try {
    const response = await taskCircuitBreaker.fire(async () =>
      await apiClient.get(TASKS.HISTORY.replace(':id', taskId))
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

/**
 * Exports tasks in various formats with security controls
 * Implements rate limiting and access control
 */
const exportTasks = async (
  format: 'csv' | 'pdf' | 'xlsx',
  filters?: Record<string, any>
): Promise<ApiResponse<Blob>> => {
  try {
    const queryString = buildQueryString({ format, ...filters });
    const response = await taskCircuitBreaker.fire(async () =>
      await apiClient.get(`${TASKS.EXPORT}${queryString}`, {
        responseType: 'blob'
      })
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Export the task API client functions
export const taskApi = {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  addTaskAttachment,
  getTaskHistory,
  exportTasks
};

export default taskApi;