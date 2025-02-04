// @ts-check
import { adminUser, managerUser, memberUser } from '../fixtures/users.json';
import { tasks } from '../fixtures/tasks.json';
import { projects } from '../fixtures/projects.json';
import '@testing-library/cypress'; // v9.0.0
import 'cypress-axe'; // v4.7.0
import '@cypress/security-tools'; // v2.0.0

// Type definitions for enhanced type safety
interface AuthOptions {
  mfa?: boolean;
  sso?: boolean;
  rememberMe?: boolean;
}

interface AccessibilityOptions {
  standard?: 'WCAG2A' | 'WCAG2AA' | 'WCAG2AAA';
  includedImpacts?: ('minor' | 'moderate' | 'serious' | 'critical')[];
  rules?: Record<string, unknown>;
}

interface SecurityConfig {
  checkXSS?: boolean;
  checkCSRF?: boolean;
  checkHeaders?: boolean;
  checkRateLimiting?: boolean;
}

declare global {
  namespace Cypress {
    interface Chainable {
      login(email: string, password: string, options?: AuthOptions): Chainable<void>;
      checkAccessibility(options?: AccessibilityOptions): Chainable<void>;
      validateSecurity(securityConfig?: SecurityConfig): Chainable<void>;
      createTask(taskData: typeof tasks[0]): Chainable<void>;
      updateTask(taskId: string, updates: Partial<typeof tasks[0]>): Chainable<void>;
      createProject(projectData: typeof projects[0]): Chainable<void>;
      verifyPerformance(): Chainable<void>;
    }
  }
}

/**
 * Enhanced login command supporting multiple authentication flows
 * with comprehensive security validation
 */
Cypress.Commands.add('login', (email: string, password: string, options: AuthOptions = {}) => {
  cy.clearCookies();
  cy.clearLocalStorage();

  // Input validation
  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  // Handle SSO flow
  if (options.sso) {
    cy.visit('/auth/sso');
    cy.get('[data-testid="sso-provider"]').click();
    return;
  }

  cy.visit('/login');
  cy.get('[data-testid="email-input"]').type(email);
  cy.get('[data-testid="password-input"]').type(password);

  if (options.rememberMe) {
    cy.get('[data-testid="remember-me"]').check();
  }

  cy.get('[data-testid="login-button"]').click();

  // Handle MFA flow if enabled
  if (options.mfa) {
    cy.get('[data-testid="mfa-input"]').should('be.visible');
    // Simulate MFA code entry - in real tests, would need to handle actual MFA
    cy.get('[data-testid="mfa-input"]').type('123456');
    cy.get('[data-testid="mfa-submit"]').click();
  }

  // Verify security headers and tokens
  cy.validateSecurity({
    checkHeaders: true,
    checkCSRF: true
  });

  // Verify successful login
  cy.url().should('include', '/dashboard');
  cy.getCookie('session').should('exist');
});

/**
 * Comprehensive accessibility testing command implementing
 * WCAG 2.1 Level AA compliance checks
 */
Cypress.Commands.add('checkAccessibility', (options: AccessibilityOptions = {}) => {
  const defaultOptions = {
    standard: 'WCAG2AA',
    includedImpacts: ['critical', 'serious'],
    rules: {
      'color-contrast': { enabled: true },
      'html-has-lang': { enabled: true },
      'valid-aria-roles': { enabled: true }
    }
  };

  const mergedOptions = { ...defaultOptions, ...options };

  // Inject axe-core
  cy.injectAxe();

  // Configure axe with merged options
  cy.configureAxe(mergedOptions);

  // Run accessibility checks
  cy.checkA11y(null, {
    includedImpacts: mergedOptions.includedImpacts,
    rules: mergedOptions.rules
  });

  // Additional manual checks
  cy.get('*').each(($el) => {
    // Check for proper focus indicators
    if ($el.is(':focusable')) {
      cy.wrap($el).focus()
        .should('have.css', 'outline')
        .and('not.equal', 'none');
    }

    // Verify ARIA attributes
    const ariaLabel = $el.attr('aria-label');
    const role = $el.attr('role');
    if (role && !ariaLabel) {
      cy.wrap($el).should('have.attr', 'aria-label');
    }
  });
});

/**
 * Security validation command implementing comprehensive
 * security testing and vulnerability checks
 */
Cypress.Commands.add('validateSecurity', (config: SecurityConfig = {}) => {
  const defaultConfig = {
    checkXSS: true,
    checkCSRF: true,
    checkHeaders: true,
    checkRateLimiting: true
  };

  const mergedConfig = { ...defaultConfig, ...config };

  // Check security headers
  if (mergedConfig.checkHeaders) {
    cy.request('/')
      .its('headers')
      .then((headers) => {
        expect(headers).to.include({
          'strict-transport-security': 'max-age=31536000; includeSubDomains',
          'content-security-policy': /default-src 'self'/,
          'x-frame-options': 'DENY',
          'x-content-type-options': 'nosniff',
          'x-xss-protection': '1; mode=block'
        });
      });
  }

  // Check CSRF protection
  if (mergedConfig.checkCSRF) {
    cy.getCookie('XSRF-TOKEN').should('exist');
    cy.request({
      method: 'POST',
      url: '/api/tasks',
      failOnStatusCode: false,
      body: {}
    }).its('status').should('equal', 403);
  }

  // Check XSS protection
  if (mergedConfig.checkXSS) {
    const xssPayload = '<script>alert(1)</script>';
    cy.get('input').first().type(xssPayload);
    cy.get('body').should('not.contain.html', xssPayload);
  }

  // Check rate limiting
  if (mergedConfig.checkRateLimiting) {
    Cypress._.times(11, () => {
      cy.request({
        method: 'GET',
        url: '/api/tasks',
        failOnStatusCode: false
      }).then((response) => {
        if (response.status === 429) {
          expect(response.headers).to.have.property('retry-after');
        }
      });
    });
  }
});

/**
 * Performance testing command implementing core performance metrics validation
 */
Cypress.Commands.add('verifyPerformance', () => {
  // Verify page load performance
  cy.window().then((win) => {
    const performance = win.performance;
    const timing = performance.timing;
    
    // First paint should be under 1s
    const firstPaint = timing.domContentLoadedEventEnd - timing.navigationStart;
    expect(firstPaint).to.be.lessThan(1000);

    // Full page load should be under 2s
    const fullLoad = timing.loadEventEnd - timing.navigationStart;
    expect(fullLoad).to.be.lessThan(2000);
  });

  // Verify API response times
  cy.intercept('/api/**').as('apiRequest');
  cy.wait('@apiRequest').its('duration').should('be.lessThan', 500);
});

// Additional task management commands
Cypress.Commands.add('createTask', (taskData) => {
  cy.request({
    method: 'POST',
    url: '/api/tasks',
    body: taskData,
    headers: {
      'X-XSRF-TOKEN': Cypress.$('[name=_csrf]').val()
    }
  }).then((response) => {
    expect(response.status).to.equal(201);
    expect(response.body).to.have.property('id');
  });
});

Cypress.Commands.add('updateTask', (taskId: string, updates) => {
  cy.request({
    method: 'PATCH',
    url: `/api/tasks/${taskId}`,
    body: updates,
    headers: {
      'X-XSRF-TOKEN': Cypress.$('[name=_csrf]').val()
    }
  }).then((response) => {
    expect(response.status).to.equal(200);
    expect(response.body).to.include(updates);
  });
});

// Project management commands
Cypress.Commands.add('createProject', (projectData) => {
  cy.request({
    method: 'POST',
    url: '/api/projects',
    body: projectData,
    headers: {
      'X-XSRF-TOKEN': Cypress.$('[name=_csrf]').val()
    }
  }).then((response) => {
    expect(response.status).to.equal(201);
    expect(response.body).to.have.property('id');
  });
});