import { login, checkAccessibility } from '../support/commands';
import '@testing-library/cypress'; // v9.0.0
import 'cypress'; // v13.0.0

/**
 * Comprehensive test suite for responsive design verification
 * including performance, accessibility, and layout adaptation tests
 */
class ResponsiveTests {
  // Viewport size constants based on design specifications
  private readonly viewportSizes = {
    mobile: { width: 320, height: 568 },
    tablet: { width: 768, height: 1024 },
    desktop: { width: 1024, height: 768 },
    largeDesktop: { width: 1440, height: 900 }
  };

  // Performance thresholds from technical specifications
  private readonly performanceThresholds = {
    pageLoad: 2000,      // 2 seconds max page load
    apiResponse: 500,    // 500ms max API response
    layoutTransition: 300,
    componentReflow: 150
  };

  // Accessibility configuration based on WCAG 2.1 Level AA
  private readonly accessibilityConfig = {
    standard: 'WCAG2AA',
    contrastRatio: 4.5,
    focusIndicators: true,
    ariaRequired: true,
    keyboardNav: true
  };

  beforeEach(() => {
    // Login before each test using test user credentials
    cy.login('member@taskmanager.com', 'test_hashed_password_3');
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  /**
   * Tests mobile viewport (320px-767px) layout and interactions
   */
  testMobileLayout() {
    describe('Mobile Viewport Tests', () => {
      beforeEach(() => {
        cy.viewport(this.viewportSizes.mobile.width, this.viewportSizes.mobile.height);
      });

      it('should properly display mobile navigation', () => {
        cy.get('[data-testid="hamburger-menu"]').should('be.visible');
        cy.get('[data-testid="side-menu"]').should('not.be.visible');
        cy.get('[data-testid="hamburger-menu"]').click();
        cy.get('[data-testid="side-menu"]').should('be.visible');
      });

      it('should adapt content area to single column', () => {
        cy.get('[data-testid="content-area"]')
          .should('have.css', 'grid-template-columns', '1fr');
      });

      it('should support touch interactions', () => {
        cy.get('[data-testid="task-list"]')
          .trigger('touchstart', { touches: [{ clientX: 0, clientY: 0 }] })
          .trigger('touchmove', { touches: [{ clientX: 100, clientY: 0 }] })
          .trigger('touchend');
      });

      it('should meet performance requirements', () => {
        cy.window().its('performance').then((performance) => {
          const navigationStart = performance.timing.navigationStart;
          const loadEventEnd = performance.timing.loadEventEnd;
          expect(loadEventEnd - navigationStart).to.be.lessThan(this.performanceThresholds.pageLoad);
        });
      });

      it('should maintain accessibility standards', () => {
        cy.checkAccessibility({
          standard: this.accessibilityConfig.standard,
          includedImpacts: ['critical', 'serious']
        });
      });
    });
  }

  /**
   * Tests tablet viewport (768px-1023px) layout and interactions
   */
  testTabletLayout() {
    describe('Tablet Viewport Tests', () => {
      beforeEach(() => {
        cy.viewport(this.viewportSizes.tablet.width, this.viewportSizes.tablet.height);
      });

      it('should display collapsed side menu with expand option', () => {
        cy.get('[data-testid="side-menu"]').should('have.class', 'collapsed');
        cy.get('[data-testid="expand-menu"]').click();
        cy.get('[data-testid="side-menu"]').should('have.class', 'expanded');
      });

      it('should use two-column grid layout', () => {
        cy.get('[data-testid="dashboard-grid"]')
          .should('have.css', 'grid-template-columns')
          .and('match', /repeat\(2, 1fr\)/);
      });

      it('should properly scale components', () => {
        cy.get('[data-testid="task-card"]')
          .should('have.css', 'width')
          .and('match', /^((?!0px).)*$/);
      });
    });
  }

  /**
   * Tests desktop viewport (1024px-1439px) layout and interactions
   */
  testDesktopLayout() {
    describe('Desktop Viewport Tests', () => {
      beforeEach(() => {
        cy.viewport(this.viewportSizes.desktop.width, this.viewportSizes.desktop.height);
      });

      it('should display full navigation', () => {
        cy.get('[data-testid="side-menu"]').should('be.visible');
        cy.get('[data-testid="top-nav"]').should('be.visible');
      });

      it('should implement F-pattern layout', () => {
        cy.get('[data-testid="header"]').should('be.visible');
        cy.get('[data-testid="main-content"]')
          .should('have.css', 'grid-template-areas')
          .and('include', '"header header"');
      });

      it('should handle keyboard navigation', () => {
        cy.get('body').tab();
        cy.focused().should('have.class', 'focus-visible');
      });
    });
  }

  /**
   * Tests large desktop viewport (1440px+) layout and interactions
   */
  testLargeDesktopLayout() {
    describe('Large Desktop Viewport Tests', () => {
      beforeEach(() => {
        cy.viewport(this.viewportSizes.largeDesktop.width, this.viewportSizes.largeDesktop.height);
      });

      it('should maintain maximum content width', () => {
        cy.get('[data-testid="content-container"]')
          .should('have.css', 'max-width', '1440px');
      });

      it('should implement multi-column dashboard', () => {
        cy.get('[data-testid="dashboard-grid"]')
          .should('have.css', 'grid-template-columns')
          .and('match', /repeat\(3, 1fr\)/);
      });
    });
  }

  /**
   * Tests responsive behavior across all breakpoints
   */
  testResponsiveTransitions() {
    describe('Responsive Transition Tests', () => {
      it('should handle viewport transitions smoothly', () => {
        // Test each breakpoint transition
        Object.values(this.viewportSizes).forEach((size) => {
          cy.viewport(size.width, size.height);
          cy.get('[data-testid="layout-container"]').should('be.visible');
          
          // Verify layout transition performance
          cy.window().then((win) => {
            const transitionStart = performance.now();
            cy.get('[data-testid="layout-container"]')
              .should('have.attr', 'data-viewport')
              .then(() => {
                const transitionEnd = performance.now();
                expect(transitionEnd - transitionStart).to.be.lessThan(
                  this.performanceThresholds.layoutTransition
                );
              });
          });
        });
      });

      it('should maintain accessibility across viewports', () => {
        Object.values(this.viewportSizes).forEach((size) => {
          cy.viewport(size.width, size.height);
          cy.checkAccessibility();
        });
      });
    });
  }
}

// Export the test suite
export const responsiveTests = new ResponsiveTests();

// Execute all responsive tests
describe('Responsive Design E2E Tests', () => {
  responsiveTests.testMobileLayout();
  responsiveTests.testTabletLayout();
  responsiveTests.testDesktopLayout();
  responsiveTests.testLargeDesktopLayout();
  responsiveTests.testResponsiveTransitions();
});