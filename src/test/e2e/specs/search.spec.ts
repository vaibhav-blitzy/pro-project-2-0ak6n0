/**
 * @fileoverview End-to-end test specifications for search functionality
 * Implements comprehensive testing of search interface components,
 * performance metrics, accessibility compliance, and security validations.
 * @version 1.0.0
 */

import { setupTestEnvironment, teardownTestEnvironment } from '../../utils/test-helpers';
import { SEARCH } from '../../../web/src/constants/api.constants';
import '@testing-library/cypress/add-commands';
import 'cypress-axe';
import 'cypress-performance';

// Performance thresholds in milliseconds
const PERFORMANCE_THRESHOLDS = {
  SEARCH_RESPONSE: 500,
  RENDER_TIME: 200,
  TOTAL_LOAD: 3000
};

// Test data for search scenarios
const TEST_SEARCH_DATA = {
  validQueries: ['project alpha', 'high priority', 'due:today'],
  invalidQueries: ['<script>alert(1)</script>', '   ', '*'.repeat(1000)],
  expectedResults: {
    'project alpha': 3,
    'high priority': 5,
    'due:today': 2
  }
};

describe('Search Functionality End-to-End Tests', () => {
  beforeEach(() => {
    cy.task('setupTestEnvironment', {
      seedData: true,
      enablePerformanceMonitoring: true
    });

    // Initialize accessibility testing
    cy.injectAxe();
    
    // Set up performance monitoring
    cy.performance();
    
    // Navigate to search page
    cy.visit('/search');
    cy.waitForReact();
  });

  afterEach(() => {
    // Collect performance metrics
    cy.getPerformanceMetrics().then((metrics) => {
      cy.task('logPerformanceMetrics', metrics);
    });

    // Generate accessibility report
    cy.checkA11y(null, {
      includedImpacts: ['critical', 'serious']
    });

    cy.task('teardownTestEnvironment');
  });

  describe('Search Bar Functionality', () => {
    it('should render search bar with proper accessibility attributes', () => {
      cy.findByRole('searchbox')
        .should('be.visible')
        .and('have.attr', 'aria-label', 'Search')
        .and('have.attr', 'aria-expanded', 'false');

      cy.findByRole('button', { name: /search/i })
        .should('be.visible')
        .and('have.attr', 'aria-label', 'Submit search');
    });

    it('should handle input with proper debouncing', () => {
      const searchTerm = 'project alpha';
      
      cy.findByRole('searchbox')
        .type(searchTerm)
        .should('have.value', searchTerm);

      // Verify debounce timing
      cy.clock();
      cy.intercept('GET', `${SEARCH.BASE}*`).as('searchRequest');
      cy.tick(300);
      cy.wait('@searchRequest')
        .its('response.time')
        .should('be.lessThan', PERFORMANCE_THRESHOLDS.SEARCH_RESPONSE);
    });

    it('should sanitize search input and prevent XSS', () => {
      TEST_SEARCH_DATA.invalidQueries.forEach(query => {
        cy.findByRole('searchbox')
          .clear()
          .type(query);

        cy.intercept('GET', `${SEARCH.BASE}*`).as('searchRequest');
        cy.wait('@searchRequest').then(({ request }) => {
          expect(request.url).not.to.include('<script>');
          expect(request.url).not.to.include('alert');
        });
      });
    });
  });

  describe('Search Results Performance', () => {
    it('should load search results within performance threshold', () => {
      cy.intercept('GET', `${SEARCH.BASE}*`).as('searchRequest');

      TEST_SEARCH_DATA.validQueries.forEach(query => {
        cy.findByRole('searchbox')
          .clear()
          .type(query);

        cy.wait('@searchRequest').then(({ response }) => {
          expect(response?.statusCode).to.equal(200);
          expect(response?.time).to.be.lessThan(PERFORMANCE_THRESHOLDS.SEARCH_RESPONSE);
        });

        // Verify render performance
        cy.getPerformanceMetrics().then((metrics) => {
          expect(metrics.firstContentfulPaint).to.be.lessThan(PERFORMANCE_THRESHOLDS.RENDER_TIME);
        });
      });
    });

    it('should implement proper loading states', () => {
      cy.intercept('GET', `${SEARCH.BASE}*`, { delay: 1000 }).as('delayedSearch');

      cy.findByRole('searchbox')
        .type('loading test');

      cy.findByRole('progressbar')
        .should('be.visible');

      cy.wait('@delayedSearch');

      cy.findByRole('progressbar')
        .should('not.exist');
    });
  });

  describe('Search Results Accessibility', () => {
    it('should navigate search results with keyboard', () => {
      const searchTerm = 'project alpha';
      
      cy.findByRole('searchbox')
        .type(searchTerm);

      cy.findByRole('list')
        .should('be.visible')
        .and('have.attr', 'role', 'list');

      cy.findAllByRole('listitem').each(($item) => {
        cy.wrap($item)
          .should('have.attr', 'tabindex', '0')
          .and('have.attr', 'aria-selected');
      });

      // Test keyboard navigation
      cy.findByRole('searchbox').type('{downArrow}');
      cy.findAllByRole('listitem').first()
        .should('have.attr', 'aria-selected', 'true')
        .and('have.focus');
    });

    it('should announce search results to screen readers', () => {
      cy.findByRole('searchbox')
        .type('project alpha');

      cy.findByRole('status')
        .should('have.attr', 'aria-live', 'polite')
        .and('contain', 'Search results available');
    });
  });

  describe('Search Security', () => {
    it('should implement rate limiting', () => {
      // Rapid consecutive searches
      for (let i = 0; i < 20; i++) {
        cy.findByRole('searchbox')
          .clear()
          .type(`test query ${i}`);
      }

      cy.intercept('GET', `${SEARCH.BASE}*`).as('searchRequest');
      cy.wait('@searchRequest').then(({ response }) => {
        expect(response?.statusCode).to.equal(429);
      });
    });

    it('should validate search input length and characters', () => {
      const invalidInputs = [
        '*'.repeat(1000),
        '<script>alert(1)</script>',
        '../../etc/passwd'
      ];

      invalidInputs.forEach(input => {
        cy.findByRole('searchbox')
          .clear()
          .type(input);

        cy.findByText('Invalid search input')
          .should('be.visible');
      });
    });
  });
});