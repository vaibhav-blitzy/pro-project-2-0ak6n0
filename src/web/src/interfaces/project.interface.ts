import { ID, BaseEntity } from '../types/common.types';
import { Task } from './task.interface';

/**
 * Enumeration of project status states
 * Defines all possible project lifecycle states with strict type checking
 */
export enum ProjectStatus {
  PLANNING = 'PLANNING',
  ACTIVE = 'ACTIVE',
  ON_HOLD = 'ON_HOLD',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED'
}

/**
 * Comprehensive project interface extending BaseEntity
 * Provides complete type safety and structure for project management
 * Implements project organization requirements with enhanced metadata support
 */
export interface Project extends BaseEntity {
  id: ID;
  name: string;
  description: string;
  ownerId: ID;
  status: ProjectStatus;
  startDate: Date;
  endDate: Date;
  tasks: Task[];
  metadata: Record<string, any>;  // Extensible metadata for custom project attributes
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Data transfer object for project creation
 * Defines required fields and validation structure for new projects
 * Supports project hierarchy management and timeline tracking
 */
export interface CreateProjectDTO {
  name: string;
  description: string;
  ownerId: ID;
  startDate: Date;
  endDate: Date;
  metadata?: Record<string, any>;  // Optional metadata for project creation
}

/**
 * Data transfer object for project updates
 * Supports partial updates with optional fields
 * Enables project status transitions and metadata modifications
 */
export interface UpdateProjectDTO {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  startDate?: Date;
  endDate?: Date;
  metadata?: Record<string, any>;  // Optional metadata updates
}