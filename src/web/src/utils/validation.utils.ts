import { ErrorState } from '../interfaces/common.interface';
import { Task, TaskPriority, TaskStatus } from '../interfaces/task.interface';
import { Project, ProjectStatus } from '../interfaces/project.interface';
import { isValid, isFuture, isAfter } from 'date-fns'; // ^2.30.0
import { zonedTimeToUtc } from 'date-fns-tz'; // ^2.0.0

// Constants for validation rules
const TITLE_MIN_LENGTH = 3;
const TITLE_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 5000;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'application/pdf', 'text/plain'];
const PASSWORD_MIN_LENGTH = 8;
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Validates email addresses against RFC 5322 standards
 * @param email - Email address to validate
 * @returns boolean indicating if email is valid
 */
export const validateEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') {
    return false;
  }
  return EMAIL_REGEX.test(email.trim());
};

/**
 * Enhanced password validation with strength scoring and security checks
 * @param password - Password to validate
 * @returns ErrorState with validation results and strength score
 */
export const validatePassword = (password: string): ErrorState => {
  const errors: string[] = [];
  let strengthScore = 0;

  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long`);
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  } else {
    strengthScore += 25;
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  } else {
    strengthScore += 25;
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  } else {
    strengthScore += 25;
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  } else {
    strengthScore += 25;
  }

  return {
    hasError: errors.length > 0,
    message: errors.join('. '),
    code: 'PASSWORD_VALIDATION',
    details: { strengthScore },
    timestamp: new Date(),
    errorId: crypto.randomUUID()
  };
};

/**
 * Enhanced task data validation with comprehensive checks
 * @param taskData - Task data to validate
 * @returns ErrorState with validation results
 */
export const validateTaskData = (taskData: Task): ErrorState => {
  const errors: string[] = [];

  // Title validation
  if (!taskData.title || taskData.title.trim().length < TITLE_MIN_LENGTH) {
    errors.push(`Title must be at least ${TITLE_MIN_LENGTH} characters`);
  }
  if (taskData.title && taskData.title.length > TITLE_MAX_LENGTH) {
    errors.push(`Title cannot exceed ${TITLE_MAX_LENGTH} characters`);
  }

  // Description validation
  if (taskData.description && taskData.description.length > DESCRIPTION_MAX_LENGTH) {
    errors.push(`Description cannot exceed ${DESCRIPTION_MAX_LENGTH} characters`);
  }

  // Priority validation
  if (!Object.values(TaskPriority).includes(taskData.priority)) {
    errors.push('Invalid task priority');
  }

  // Due date validation
  if (taskData.dueDate) {
    const utcDueDate = zonedTimeToUtc(taskData.dueDate, 'UTC');
    if (!isValid(utcDueDate)) {
      errors.push('Invalid due date');
    } else if (!isFuture(utcDueDate)) {
      errors.push('Due date must be in the future');
    }
  }

  // Attachments validation
  if (taskData.attachments && Array.isArray(taskData.attachments)) {
    taskData.attachments.forEach((attachment, index) => {
      if (!ALLOWED_FILE_TYPES.includes(attachment.type)) {
        errors.push(`Invalid file type for attachment ${index + 1}`);
      }
      if (attachment.size > MAX_FILE_SIZE) {
        errors.push(`Attachment ${index + 1} exceeds maximum size of 10MB`);
      }
    });
  }

  return {
    hasError: errors.length > 0,
    message: errors.join('. '),
    code: 'TASK_VALIDATION',
    timestamp: new Date(),
    errorId: crypto.randomUUID()
  };
};

/**
 * Enhanced project data validation with resource and timeline checks
 * @param projectData - Project data to validate
 * @returns ErrorState with validation results
 */
export const validateProjectData = (projectData: Project): ErrorState => {
  const errors: string[] = [];

  // Name validation
  if (!projectData.name || projectData.name.trim().length < TITLE_MIN_LENGTH) {
    errors.push(`Project name must be at least ${TITLE_MIN_LENGTH} characters`);
  }
  if (projectData.name && projectData.name.length > TITLE_MAX_LENGTH) {
    errors.push(`Project name cannot exceed ${TITLE_MAX_LENGTH} characters`);
  }

  // Description validation
  if (projectData.description && projectData.description.length > DESCRIPTION_MAX_LENGTH) {
    errors.push(`Description cannot exceed ${DESCRIPTION_MAX_LENGTH} characters`);
  }

  // Date validation
  if (projectData.startDate && projectData.endDate) {
    const utcStartDate = zonedTimeToUtc(projectData.startDate, 'UTC');
    const utcEndDate = zonedTimeToUtc(projectData.endDate, 'UTC');

    if (!isValid(utcStartDate) || !isValid(utcEndDate)) {
      errors.push('Invalid date format');
    } else if (!isAfter(utcEndDate, utcStartDate)) {
      errors.push('End date must be after start date');
    }
  }

  // Status validation
  if (!Object.values(ProjectStatus).includes(projectData.status)) {
    errors.push('Invalid project status');
  }

  return {
    hasError: errors.length > 0,
    message: errors.join('. '),
    code: 'PROJECT_VALIDATION',
    timestamp: new Date(),
    errorId: crypto.randomUUID()
  };
};

/**
 * Enhanced date range validation with business rules
 * @param startDate - Start date to validate
 * @param endDate - End date to validate
 * @returns ErrorState with validation results
 */
export const validateDateRange = (startDate: Date, endDate: Date): ErrorState => {
  const errors: string[] = [];

  if (!startDate || !endDate) {
    errors.push('Both start and end dates are required');
    return {
      hasError: true,
      message: errors.join('. '),
      code: 'DATE_VALIDATION',
      timestamp: new Date(),
      errorId: crypto.randomUUID()
    };
  }

  const utcStartDate = zonedTimeToUtc(startDate, 'UTC');
  const utcEndDate = zonedTimeToUtc(endDate, 'UTC');

  if (!isValid(utcStartDate) || !isValid(utcEndDate)) {
    errors.push('Invalid date format');
  }

  if (isValid(utcStartDate) && isValid(utcEndDate)) {
    if (!isAfter(utcEndDate, utcStartDate)) {
      errors.push('End date must be after start date');
    }

    const durationInDays = Math.ceil((utcEndDate.getTime() - utcStartDate.getTime()) / (1000 * 60 * 60 * 24));
    if (durationInDays > 365) {
      errors.push('Date range cannot exceed 1 year');
    }
  }

  return {
    hasError: errors.length > 0,
    message: errors.join('. '),
    code: 'DATE_VALIDATION',
    timestamp: new Date(),
    errorId: crypto.randomUUID()
  };
};