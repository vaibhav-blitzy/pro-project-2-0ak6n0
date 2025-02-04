import { ID, BaseEntity } from '../types/common.types';

/**
 * Enumeration of task priority levels
 * Used for consistent priority assignment across the application
 */
export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH'
}

/**
 * Enumeration of task workflow states
 * Aligns with project board view requirements
 */
export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  REVIEW = 'REVIEW',
  DONE = 'DONE'
}

/**
 * Comprehensive task interface extending BaseEntity
 * Supports all core task management features with extensibility
 */
export interface Task extends BaseEntity {
  id: ID;
  title: string;
  description: string;
  projectId: ID;
  assigneeId: ID;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: Date;
  attachments: string[];  // Array of attachment URLs/identifiers
  customFields: Record<string, any>;  // Flexible custom field support
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Data transfer object for task creation
 * Defines required fields for creating a new task
 */
export interface CreateTaskDTO {
  title: string;
  description: string;
  projectId: ID;
  assigneeId: ID;
  priority: TaskPriority;
  dueDate: Date;
  customFields?: Record<string, any>;
}

/**
 * Data transfer object for task updates
 * Supports partial updates with optional fields
 */
export interface UpdateTaskDTO {
  title?: string;
  description?: string;
  assigneeId?: ID;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueDate?: Date;
  customFields?: Record<string, any>;
}