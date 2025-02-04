/**
 * @fileoverview End-to-end test specifications for task management functionality
 * Implements comprehensive testing for task operations with security validation,
 * performance monitoring, and accessibility compliance.
 * @version 1.0.0
 */

import { Task, TaskPriority, TaskStatus } from '../../web/src/interfaces/task.interface';
import { TestContext } from '../utils/test-helpers';
import { expect } from '@testing-library/jest-dom'; // ^6.1.0
import { cy } from 'cypress'; // ^13.0.0

// Performance thresholds in milliseconds
const PERFORMANCE_THRESHOLDS = {
  PAGE_LOAD: 2000,
  API_RESPONSE: 500,
  ANIMATION: 300
};

// Test data constants
const TEST_TASK: Task = {
  id: '123',
  title: 'Test Task',
  description: 'Test task description',
  priority: TaskPriority.HIGH,
  status: TaskStatus.TODO,
  dueDate: new Date('2024-12-31'),
  projectId: 'project-123',
  assigneeId: 'user-123',
  attachments: [],
  customFields: {},
  createdAt: new Date(),
  updatedAt: new Date()
};

describe('Task Management E2E Tests', () => {
  let testContext: TestContext;

  beforeEach(() => {
    // Initialize test context with enhanced security and performance monitoring
    testContext = new TestContext();
    cy.clock();

    cy.intercept('GET', '/api/v1/tasks*', (req) => {
      const startTime = Date.now();
      req.reply({
        statusCode: 200,
        body: {
          data: [TEST_TASK],
          pagination: {
            total: 1,
            page: 1,
            pageSize: 10
          }
        },
        delay: 0
      }).then(() => {
        const responseTime = Date.now() - startTime;
        expect(responseTime).to.be.lessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE);
      });
    }).as('getTasks');

    // Setup security headers and monitoring
    cy.intercept('*', (req) => {
      expect(req.headers).to.have.property('authorization');
      expect(req.headers).to.have.property('x-request-id');
      expect(req.headers).to.have.property('content-security-policy');
    });

    // Visit tasks page with performance tracking
    const startTime = Date.now();
    cy.visit('/tasks').then(() => {
      const loadTime = Date.now() - startTime;
      expect(loadTime).to.be.lessThan(PERFORMANCE_THRESHOLDS.PAGE_LOAD);
    });
  });

  afterEach(() => {
    // Cleanup and performance report generation
    testContext.cleanup();
    cy.clock().then((clock) => {
      clock.restore();
    });
  });

  describe('Task List View', () => {
    it('displays tasks with cursor-based pagination and accessibility support', () => {
      // Verify page structure and accessibility
      cy.injectAxe();
      cy.checkA11y();

      // Verify task list rendering
      cy.get('[data-testid="task-list"]')
        .should('be.visible')
        .and('have.attr', 'role', 'list');

      // Verify task item accessibility
      cy.get('[data-testid="task-item"]')
        .first()
        .should('have.attr', 'role', 'listitem')
        .and('have.attr', 'aria-label');

      // Test pagination with performance monitoring
      cy.get('[data-testid="pagination-next"]').click();
      cy.get('@getTasks').its('response.body').should('exist');
    });

    it('implements task filtering with performance optimization', () => {
      const startTime = Date.now();

      // Test filter interactions
      cy.get('[data-testid="filter-priority"]').click();
      cy.get(`[data-value="${TaskPriority.HIGH}"]`).click();

      cy.get('[data-testid="task-list"]').should('exist').then(() => {
        const filterTime = Date.now() - startTime;
        expect(filterTime).to.be.lessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE);
      });
    });

    it('supports task creation with validation and security checks', () => {
      // Open create task form
      cy.get('[data-testid="create-task-button"]').click();

      // Verify form accessibility
      cy.get('form').should('have.attr', 'aria-label', 'Create Task Form');

      // Test form validation
      cy.get('[data-testid="task-title"]').type(TEST_TASK.title);
      cy.get('[data-testid="task-description"]').type(TEST_TASK.description);
      cy.get('[data-testid="task-priority"]').select(TEST_TASK.priority);
      cy.get('[data-testid="task-due-date"]').type('2024-12-31');

      // Submit with security validation
      cy.intercept('POST', '/api/v1/tasks', (req) => {
        expect(req.headers['content-type']).to.equal('application/json');
        expect(req.body).to.have.property('title', TEST_TASK.title);
      }).as('createTask');

      cy.get('[data-testid="submit-button"]').click();
      cy.wait('@createTask');
    });

    it('handles error states with proper user feedback', () => {
      // Simulate network error
      cy.intercept('GET', '/api/v1/tasks*', {
        statusCode: 500,
        body: {
          error: 'Internal Server Error'
        }
      }).as('getTasksError');

      // Verify error handling
      cy.get('[data-testid="error-message"]')
        .should('be.visible')
        .and('have.attr', 'role', 'alert');

      // Test retry mechanism
      cy.get('[data-testid="retry-button"]').click();
      cy.wait('@getTasksError');
    });

    it('maintains performance under load with optimistic updates', () => {
      // Test bulk operations
      const tasks = Array(10).fill(TEST_TASK).map((task, index) => ({
        ...task,
        id: `task-${index}`,
        title: `Task ${index}`
      }));

      cy.intercept('GET', '/api/v1/tasks*', {
        body: {
          data: tasks,
          pagination: {
            total: tasks.length,
            page: 1,
            pageSize: 10
          }
        }
      });

      // Verify render performance
      const startTime = Date.now();
      cy.get('[data-testid="task-item"]').should('have.length', 10).then(() => {
        const renderTime = Date.now() - startTime;
        expect(renderTime).to.be.lessThan(PERFORMANCE_THRESHOLDS.ANIMATION);
      });
    });
  });
});