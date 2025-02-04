// @ts-check
import { login, createTask, createProject, measurePerformance, checkAccessibility, validateSecurity } from './commands';
import '@testing-library/cypress'; // v9.0.0
import 'cypress-axe'; // v1.5.0
import 'cypress-audit'; // v1.1.0

// Configure viewport for responsive testing
Cypress.config('viewportWidth', 1280);
Cypress.config('viewportHeight', 720);

// Configure screenshot behavior
Cypress.Screenshot.defaults({
  capture: 'viewport',
  scale: false,
  overwrite: true,
  disableTimersAndAnimations: true
});

// Configure global Cypress behavior
Cypress.config({
  defaultCommandTimeout: 10000,
  requestTimeout: 10000,
  responseTimeout: 30000,
  pageLoadTimeout: 60000,
  retries: {
    runMode: 2,
    openMode: 0
  },
  experimentalMemoryManagement: true,
  numTestsKeptInMemory: 0
});

// Performance thresholds based on technical specifications
export const performanceThresholds = {
  pageLoad: {
    firstPaint: 1000, // 1s
    firstInteractive: 2000, // 2s
    fullyLoaded: 3000 // 3s
  },
  apiResponse: {
    read: 100, // 100ms
    write: 200, // 200ms
    batch: 500 // 500ms
  },
  search: {
    simple: 200, // 200ms
    complex: 500 // 500ms
  },
  fileOperations: {
    upload: 5000, // 5s per MB
    download: 3000 // 3s per MB
  }
};

// Accessibility testing configuration
export const accessibilityRules = {
  standard: 'WCAG2AA',
  includedImpacts: ['critical', 'serious'],
  rules: {
    'color-contrast': { enabled: true },
    'html-has-lang': { enabled: true },
    'valid-aria-roles': { enabled: true },
    'aria-required-attr': { enabled: true },
    'aria-required-children': { enabled: true },
    'aria-required-parent': { enabled: true },
    'aria-roles': { enabled: true },
    'aria-valid-attr-value': { enabled: true },
    'aria-valid-attr': { enabled: true }
  }
};

// Security testing configuration
export const securityChecks = {
  headers: {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'",
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block'
  },
  rateLimiting: {
    maxRequests: 1000,
    windowMs: 3600000 // 1 hour
  }
};

// Global test configuration
export const testConfig = {
  viewportConfig: {
    mobile: { width: 320, height: 568 },
    tablet: { width: 768, height: 1024 },
    desktop: { width: 1280, height: 720 },
    largeDesktop: { width: 1440, height: 900 }
  },
  performanceThresholds,
  accessibilityRules,
  securityChecks
};

// Global test setup
beforeEach(() => {
  // Reset browser state
  cy.clearCookies();
  cy.clearLocalStorage();
  cy.window().then((win) => {
    win.sessionStorage.clear();
  });

  // Configure network conditions
  cy.intercept('**', (req) => {
    req.on('response', (res) => {
      // Verify response times
      expect(res.duration).to.be.lessThan(performanceThresholds.apiResponse.read);
    });
  });

  // Initialize accessibility testing
  cy.injectAxe();
  cy.configureAxe(accessibilityRules);

  // Set up security context
  cy.validateSecurity(securityChecks);
});

// Global test cleanup
afterEach(() => {
  // Check for console errors
  cy.window().then((win) => {
    expect(win.console.error).to.have.callCount(0);
  });

  // Verify accessibility
  cy.checkA11y(null, {
    includedImpacts: accessibilityRules.includedImpacts,
    rules: accessibilityRules.rules
  });

  // Verify performance metrics
  cy.window().then((win) => {
    const performance = win.performance;
    const timing = performance.timing;
    
    const firstPaint = timing.domContentLoadedEventEnd - timing.navigationStart;
    expect(firstPaint).to.be.lessThan(performanceThresholds.pageLoad.firstPaint);

    const fullyLoaded = timing.loadEventEnd - timing.navigationStart;
    expect(fullyLoaded).to.be.lessThan(performanceThresholds.pageLoad.fullyLoaded);
  });

  // Generate test artifacts if needed
  if (Cypress.config('isInteractive')) {
    cy.screenshot({ capture: 'fullPage' });
  }
});