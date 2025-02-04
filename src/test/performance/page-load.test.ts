/**
 * @fileoverview Performance test suite for measuring and validating page load times
 * across critical pages in the Task Management System. Implements comprehensive
 * performance metrics collection and validation against defined SLAs.
 * @version 1.0.0
 */

import { 
  measurePageLoad, 
  analyzePerformanceMetrics, 
  PerformanceMetricsCollector 
} from '../utils/performance-metrics';
import { 
  setupTestEnvironment, 
  teardownTestEnvironment 
} from '../utils/test-helpers';
import { createAuthenticatedUser } from '../utils/test-helpers';
import puppeteer, { Browser, Page } from 'puppeteer'; // ^19.7.0

// Critical pages to test based on technical specification
const TEST_PAGES = ['/dashboard', '/projects', '/tasks', '/search'];

// Number of iterations per page for statistical significance
const ITERATIONS_PER_PAGE = 5;

// Performance thresholds from technical specification
const PERFORMANCE_THRESHOLDS = {
  FIRST_PAINT: 1000,        // 1s
  TIME_TO_INTERACTIVE: 2000, // 2s
  FULL_LOAD: 3000,          // 3s
  API_RESPONSE: 500         // 500ms
};

// Network condition presets for testing
const NETWORK_CONDITIONS = {
  FAST_3G: {
    latency: 100,
    downloadSpeed: 1.6 * 1024 * 1024 / 8, // 1.6 Mbps
    uploadSpeed: 0.75 * 1024 * 1024 / 8   // 0.75 Mbps
  },
  SLOW_3G: {
    latency: 200,
    downloadSpeed: 0.8 * 1024 * 1024 / 8,  // 0.8 Mbps
    uploadSpeed: 0.4 * 1024 * 1024 / 8     // 0.4 Mbps
  }
};

/**
 * Sets up the test environment and browser for page load testing
 */
async function setupPageLoadTest(networkConditions?: typeof NETWORK_CONDITIONS.FAST_3G) {
  const testEnv = await setupTestEnvironment({
    performanceMonitoring: true
  });

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  if (networkConditions) {
    await page.emulateNetworkConditions(networkConditions);
  }

  // Enable performance monitoring
  await page.setRequestInterception(true);
  await page.coverage.startJSCoverage();
  await page.coverage.startCSSCoverage();

  // Configure browser caching
  await page.setCacheEnabled(false);

  return { browser, page, testEnv };
}

/**
 * Measures comprehensive performance metrics for a specific page
 */
async function measurePagePerformance(
  page: Page,
  url: string,
  retryAttempts: number = 3
): Promise<PageLoadMetrics> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retryAttempts; attempt++) {
    try {
      await page.setCacheEnabled(false);
      await page.reload({ waitUntil: 'networkidle0' });

      const metrics = await measurePageLoad(page, url, {
        waitUntil: 'networkidle0',
        timeout: PERFORMANCE_THRESHOLDS.FULL_LOAD
      });

      return metrics;
    } catch (error) {
      lastError = error as Error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  throw new Error(`Failed to measure page performance after ${retryAttempts} attempts: ${lastError?.message}`);
}

/**
 * Main test suite class for page load performance testing
 */
export class PageLoadTestSuite {
  private metricsCollector: PerformanceMetricsCollector;
  private browser: Browser;
  private page: Page;
  private performanceBaselines: Map<string, PerformanceBaseline>;
  private networkConditions?: typeof NETWORK_CONDITIONS.FAST_3G;

  constructor(
    browser: Browser,
    page: Page,
    options: {
      networkConditions?: typeof NETWORK_CONDITIONS.FAST_3G;
      baselineThresholds?: typeof PERFORMANCE_THRESHOLDS;
    } = {}
  ) {
    this.browser = browser;
    this.page = page;
    this.networkConditions = options.networkConditions;
    this.performanceBaselines = new Map();
    this.metricsCollector = new PerformanceMetricsCollector(
      options.baselineThresholds || PERFORMANCE_THRESHOLDS,
      {
        retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
        rotationSize: 1000,
        storageType: 'persistent'
      }
    );
  }

  /**
   * Runs performance tests for specified pages with comprehensive analysis
   */
  async runPageLoadTests(
    pages: string[] = TEST_PAGES,
    config: {
      iterations?: number;
      validateThresholds?: boolean;
    } = {}
  ): Promise<PerformanceReport> {
    const iterations = config.iterations || ITERATIONS_PER_PAGE;
    const results: PageLoadMetrics[][] = [];

    try {
      // Create authenticated user session
      await createAuthenticatedUser();

      for (const page of pages) {
        const pageMetrics: PageLoadMetrics[] = [];

        for (let i = 0; i < iterations; i++) {
          const metrics = await measurePagePerformance(this.page, page);
          pageMetrics.push(metrics);
          await this.metricsCollector.addMetric({
            timestamp: Date.now(),
            duration: metrics.domComplete,
            type: 'page_load',
            context: { page, iteration: i },
            metadata: {}
          });
        }

        results.push(pageMetrics);
        await this.validateMetrics(pageMetrics);
      }

      return await this.generateReport(results, pages);
    } catch (error) {
      throw new Error(`Performance test suite failed: ${(error as Error).message}`);
    }
  }

  /**
   * Validates performance metrics against thresholds with statistical significance
   */
  async validateMetrics(
    metrics: PageLoadMetrics[],
    options: {
      thresholds?: typeof PERFORMANCE_THRESHOLDS;
      confidence?: number;
    } = {}
  ): Promise<ValidationResult> {
    const thresholds = options.thresholds || PERFORMANCE_THRESHOLDS;
    const analysis = analyzePerformanceMetrics(
      metrics.map(m => ({
        timestamp: Date.now(),
        duration: m.domComplete,
        type: 'page_load',
        context: {},
        metadata: {}
      }))
    );

    const validationResult: ValidationResult = {
      passed: true,
      violations: [],
      analysis
    };

    if (analysis.percentiles.p95 > thresholds.FULL_LOAD) {
      validationResult.passed = false;
      validationResult.violations.push({
        metric: 'full_load',
        threshold: thresholds.FULL_LOAD,
        actual: analysis.percentiles.p95
      });
    }

    return validationResult;
  }

  private async generateReport(
    results: PageLoadMetrics[][],
    pages: string[]
  ): Promise<PerformanceReport> {
    const report = await this.metricsCollector.generateReport();
    return {
      summary: report,
      pageResults: pages.map((page, index) => ({
        page,
        metrics: results[index],
        analysis: report
      })),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'test',
      networkConditions: this.networkConditions
    };
  }
}

interface PageLoadMetrics {
  url: string;
  firstPaint: number;
  firstContentfulPaint: number;
  timeToInteractive: number;
  domComplete: number;
  resourceTiming: any[];
  cumulativeLayoutShift: number;
  largestContentfulPaint: number;
}

interface ValidationResult {
  passed: boolean;
  violations: Array<{
    metric: string;
    threshold: number;
    actual: number;
  }>;
  analysis: any;
}

interface PerformanceBaseline {
  p50: number;
  p95: number;
  mean: number;
}

interface PerformanceReport {
  summary: any;
  pageResults: Array<{
    page: string;
    metrics: PageLoadMetrics[];
    analysis: any;
  }>;
  timestamp: string;
  environment: string;
  networkConditions?: typeof NETWORK_CONDITIONS.FAST_3G;
}