import { defineConfig } from 'cypress'; // v13.0.0
import { baseConfig } from './e2e/support/index';
import '@cypress/code-coverage'; // v3.12.0
import 'cypress-axe'; // v1.5.0
import 'cypress-websocket-testing'; // v1.2.0

// Environment variables with defaults
const BASE_URL = process.env.CYPRESS_BASE_URL || 'http://localhost:3000';
const VIDEO_RECORDING = process.env.CYPRESS_VIDEO || false;
const PERFORMANCE_THRESHOLD = process.env.CYPRESS_PERFORMANCE_THRESHOLD || 2000;

export default defineConfig({
  e2e: {
    baseUrl: BASE_URL,
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    viewportWidth: baseConfig.viewportWidth,
    viewportHeight: baseConfig.viewportHeight,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 30000,
    pageLoadTimeout: 60000,
    video: VIDEO_RECORDING,
    screenshotOnRunFailure: true,
    chromeWebSecurity: false,
    retries: {
      runMode: 2,
      openMode: 0
    },
    env: {
      // Code coverage configuration
      coverage: true,
      codeCoverage: {
        url: '/api/__coverage__',
        exclude: [
          'cypress/**/*.*',
          'public/**/*.*',
          'src/test/**/*.*'
        ]
      },
      
      // Accessibility testing configuration
      axe: {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa']
        },
        rules: {
          'color-contrast': { enabled: true },
          'html-has-lang': { enabled: true },
          'valid-aria-roles': { enabled: true }
        }
      },
      
      // Performance testing thresholds
      performance: {
        timeouts: {
          pageLoad: PERFORMANCE_THRESHOLD,
          apiResponse: 500
        },
        metrics: {
          firstPaint: 1000,
          firstContentfulPaint: 1500,
          firstMeaningfulPaint: 2000
        }
      },
      
      // Browser compatibility testing
      browsers: {
        chrome: {
          minVersion: 90
        },
        firefox: {
          minVersion: 88
        },
        safari: {
          minVersion: 14
        },
        edge: {
          minVersion: 90
        }
      },
      
      // WebSocket testing configuration
      websocket: {
        url: `ws://${BASE_URL.replace('http://', '')}`,
        timeout: 5000
      }
    },
    setupNodeEvents(on, config) {
      // Code coverage plugin
      require('@cypress/code-coverage/task')(on, config);
      
      // Accessibility testing plugin
      on('task', {
        log(message) {
          console.log(message);
          return null;
        },
        table(message) {
          console.table(message);
          return null;
        }
      });
      
      // WebSocket testing plugin
      require('cypress-websocket-testing/plugins')(on, config);
      
      // Performance monitoring
      on('before:browser:launch', (browser, launchOptions) => {
        if (browser.name === 'chrome' && browser.isHeadless) {
          launchOptions.args.push('--disable-gpu');
          launchOptions.args.push('--disable-dev-shm-usage');
          launchOptions.args.push('--no-sandbox');
        }
        return launchOptions;
      });
      
      return config;
    }
  },
  
  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite'
    },
    supportFile: 'cypress/support/component.ts',
    specPattern: 'cypress/component/**/*.cy.{js,jsx,ts,tsx}',
    setupNodeEvents(on, config) {
      require('@cypress/code-coverage/task')(on, config);
      return config;
    }
  },
  
  // Global configuration
  watchForFileChanges: false,
  trashAssetsBeforeRuns: true,
  reporter: 'mochawesome',
  reporterOptions: {
    reportDir: 'cypress/reports',
    overwrite: false,
    html: true,
    json: true
  }
});