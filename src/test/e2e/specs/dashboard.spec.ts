import { adminUser, memberUser } from '../fixtures/users.json';
import { tasks } from '../fixtures/tasks.json';
import { projects } from '../fixtures/projects.json';
import '@testing-library/cypress'; // v9.0.0
import '@cypress/code-coverage'; // v3.10.0
import 'cypress-performance'; // v2.0.0

/**
 * End-to-end test specifications for the dashboard page
 * Testing core functionality, real-time updates, performance metrics,
 * and component interactions with comprehensive coverage
 */

describe('Dashboard Page', () => {
  beforeEach(() => {
    // Reset state and setup test environment
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.intercept('GET', '/api/v1/tasks/**').as('getTasks');
    cy.intercept('GET', '/api/v1/projects/**').as('getProjects');
    cy.intercept('GET', '/api/v1/users/me').as('getCurrentUser');
    
    // Initialize WebSocket monitoring
    cy.window().then((win) => {
      cy.spy(win.WebSocket.prototype, 'send').as('wsMessages');
    });

    // Start performance monitoring
    cy.performance.start();

    // Login and visit dashboard
    cy.login(memberUser);
    cy.visit('/dashboard', {
      onBeforeLoad: (win) => {
        win.performance.mark('visit-start');
      },
    });

    // Wait for initial data load
    cy.wait(['@getTasks', '@getProjects', '@getCurrentUser']);
    cy.window().then((win) => {
      win.performance.mark('visit-end');
      win.performance.measure('page-load', 'visit-start', 'visit-end');
    });
  });

  afterEach(() => {
    // Collect performance metrics
    cy.performance.end();
    cy.performance.threshold({
      'page-load': 2000, // 2s max load time
      'api-response': 500, // 500ms max API response
      'animation-frame': 16, // 60fps target
    });

    // Cleanup
    cy.window().then((win) => {
      win.performance.clearMarks();
      win.performance.clearMeasures();
    });
  });

  describe('Layout and Components', () => {
    it('should display all required dashboard sections', () => {
      // Verify metrics section
      cy.findByTestId('metrics-section').within(() => {
        cy.findByText('Task Overview').should('be.visible');
        cy.findByTestId('total-tasks').should('be.visible');
        cy.findByTestId('completed-tasks').should('be.visible');
        cy.findByTestId('overdue-tasks').should('be.visible');
      });

      // Verify project status section
      cy.findByTestId('project-status').within(() => {
        cy.findByText('Project Progress').should('be.visible');
        projects.forEach(project => {
          cy.findByText(project.name).should('be.visible');
        });
      });

      // Verify activity feed
      cy.findByTestId('activity-feed').within(() => {
        cy.findByText('Recent Activity').should('be.visible');
        cy.findAllByTestId('activity-item').should('have.length.at.least', 1);
      });

      // Test accessibility
      cy.injectAxe();
      cy.checkA11y();
    });

    it('should update real-time data through WebSocket', () => {
      // Simulate WebSocket task update
      cy.window().then((win) => {
        const wsMessage = {
          type: 'TASK_UPDATE',
          data: tasks[0]
        };
        win.postMessage(wsMessage, '*');
      });

      // Verify update reflection
      cy.findByTestId('task-card-' + tasks[0].id)
        .should('contain', tasks[0].title)
        .and('contain', tasks[0].status);

      // Verify WebSocket connection
      cy.get('@wsMessages').should('have.been.called');
    });
  });

  describe('Responsive Design', () => {
    const viewports = [
      { width: 1440, height: 900, device: 'Large Desktop' },
      { width: 1024, height: 768, device: 'Desktop' },
      { width: 768, height: 1024, device: 'Tablet' },
      { width: 320, height: 568, device: 'Mobile' }
    ];

    viewports.forEach(viewport => {
      it(`should render correctly on ${viewport.device}`, () => {
        cy.viewport(viewport.width, viewport.height);
        
        // Verify responsive layout
        cy.findByTestId('dashboard-container').should('be.visible');
        
        if (viewport.width <= 768) {
          // Mobile/Tablet layout checks
          cy.findByTestId('mobile-menu-button').should('be.visible');
          cy.findByTestId('side-navigation').should('not.be.visible');
          
          // Test mobile menu interaction
          cy.findByTestId('mobile-menu-button').click();
          cy.findByTestId('side-navigation').should('be.visible');
        } else {
          // Desktop layout checks
          cy.findByTestId('side-navigation').should('be.visible');
          cy.findByTestId('mobile-menu-button').should('not.exist');
        }

        // Verify content reflow
        cy.findByTestId('metrics-section')
          .should('have.css', 'grid-template-columns')
          .and('match', viewport.width <= 768 ? /1fr/ : /repeat/);

        // Take snapshot for visual regression
        cy.screenshot(`dashboard-${viewport.device.toLowerCase()}`);
      });
    });
  });

  describe('Performance Metrics', () => {
    it('should meet performance thresholds', () => {
      // Verify initial load time
      cy.window().then((win) => {
        const loadMetric = win.performance
          .getEntriesByName('page-load')[0];
        expect(loadMetric.duration).to.be.below(2000);
      });

      // Test API response times
      cy.intercept('GET', '/api/v1/tasks/**', (req) => {
        req.on('response', (res) => {
          expect(res.headers['x-response-time']).to.be.below(500);
        });
      });

      // Verify animation performance
      cy.window().then((win) => {
        const fpMetric = win.performance
          .getEntriesByType('paint')
          .find(entry => entry.name === 'first-contentful-paint');
        expect(fpMetric.startTime).to.be.below(1000);
      });
    });

    it('should handle data updates efficiently', () => {
      // Test rapid data updates
      for (let i = 0; i < 10; i++) {
        cy.window().then((win) => {
          win.postMessage({
            type: 'TASK_UPDATE',
            data: { ...tasks[i % tasks.length], updatedAt: new Date() }
          }, '*');
        });
      }

      // Verify UI responsiveness
      cy.findByTestId('activity-feed')
        .should('not.have.class', 'loading')
        .and('be.visible');
    });
  });

  describe('Error Handling', () => {
    it('should handle API failures gracefully', () => {
      // Simulate API error
      cy.intercept('GET', '/api/v1/tasks/**', {
        statusCode: 500,
        body: { error: 'Internal Server Error' }
      }).as('failedRequest');

      // Verify error display
      cy.findByTestId('error-message')
        .should('be.visible')
        .and('contain', 'Unable to load dashboard data');

      // Verify retry mechanism
      cy.findByText('Retry').click();
      cy.wait('@failedRequest');
    });

    it('should handle WebSocket disconnection', () => {
      // Simulate WebSocket disconnection
      cy.window().then((win) => {
        win.postMessage({ type: 'WS_DISCONNECT' }, '*');
      });

      // Verify reconnection attempt
      cy.findByTestId('connection-status')
        .should('contain', 'Reconnecting');

      // Verify fallback to polling
      cy.get('@wsMessages').should('have.been.called');
    });
  });
});