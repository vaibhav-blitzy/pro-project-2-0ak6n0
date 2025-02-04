/**
 * @fileoverview Enterprise-grade metrics collection utility providing standardized metric gathering,
 * tracking, and reporting functionality across backend microservices with Prometheus integration.
 * @version 1.0.0
 */

import { Logger } from './logger';
import { IErrorResponse } from '../interfaces/base.interface';
import * as promClient from 'prom-client'; // ^14.2.0
import express from 'express'; // ^4.18.0

// Global constants for metrics configuration
const DEFAULT_METRICS_PREFIX = 'task_manager_';
const DEFAULT_METRICS_PATH = '/metrics';
const METRIC_TYPES = {
  counter: 'Counter',
  gauge: 'Gauge',
  histogram: 'Histogram',
  summary: 'Summary'
} as const;

// Validation constants
const METRIC_NAME_REGEX = /^[a-zA-Z_:][a-zA-Z0-9_:]*$/;
const MAX_LABEL_CARDINALITY = 10;

/**
 * Enhanced metrics management class with advanced features for high-throughput collection,
 * security, and performance optimization
 */
export class MetricsManager {
  private readonly registry: promClient.Registry;
  private readonly serviceName: string;
  private readonly customMetrics: Map<string, promClient.Metric<string>>;
  private readonly logger: Logger;
  private readonly defaultLabels: Record<string, string>;
  private readonly metricsEndpointAuth: boolean;

  /**
   * Creates a new MetricsManager instance with enhanced configuration and security features
   * @param serviceName - Name of the service for metric identification
   * @param options - Configuration options for metrics collection
   */
  constructor(
    serviceName: string,
    options: {
      prefix?: string;
      defaultLabels?: Record<string, string>;
      collectDefaultMetrics?: boolean;
      metricsEndpointAuth?: boolean;
    } = {}
  ) {
    if (!serviceName || !METRIC_NAME_REGEX.test(serviceName)) {
      throw new Error('Invalid service name provided');
    }

    this.serviceName = serviceName;
    this.registry = new promClient.Registry();
    this.customMetrics = new Map();
    this.logger = new Logger(serviceName);
    this.metricsEndpointAuth = options.metricsEndpointAuth ?? true;

    // Configure default labels
    this.defaultLabels = {
      service: serviceName,
      environment: process.env.NODE_ENV || 'development',
      ...options.defaultLabels
    };
    this.registry.setDefaultLabels(this.defaultLabels);

    // Initialize default metrics collection if enabled
    if (options.collectDefaultMetrics !== false) {
      promClient.collectDefaultMetrics({
        prefix: options.prefix || DEFAULT_METRICS_PREFIX,
        registry: this.registry,
        labels: this.defaultLabels
      });
    }
  }

  /**
   * Creates a new counter metric with validation and performance optimization
   * @param name - Metric name
   * @param help - Metric description
   * @param labelNames - Array of label names
   * @returns Prometheus counter instance
   */
  public createCounter(
    name: string,
    help: string,
    labelNames: string[] = []
  ): promClient.Counter<string> {
    this.validateMetricCreation(name, labelNames);

    const counter = new promClient.Counter({
      name: this.getMetricName(name),
      help,
      labelNames,
      registers: [this.registry]
    });

    this.customMetrics.set(name, counter);
    return counter;
  }

  /**
   * Creates a new gauge metric with validation and performance optimization
   * @param name - Metric name
   * @param help - Metric description
   * @param labelNames - Array of label names
   * @returns Prometheus gauge instance
   */
  public createGauge(
    name: string,
    help: string,
    labelNames: string[] = []
  ): promClient.Gauge<string> {
    this.validateMetricCreation(name, labelNames);

    const gauge = new promClient.Gauge({
      name: this.getMetricName(name),
      help,
      labelNames,
      registers: [this.registry]
    });

    this.customMetrics.set(name, gauge);
    return gauge;
  }

  /**
   * Creates a new histogram metric with validation and performance optimization
   * @param name - Metric name
   * @param help - Metric description
   * @param labelNames - Array of label names
   * @param buckets - Custom histogram buckets
   * @returns Prometheus histogram instance
   */
  public createHistogram(
    name: string,
    help: string,
    labelNames: string[] = [],
    buckets?: number[]
  ): promClient.Histogram<string> {
    this.validateMetricCreation(name, labelNames);

    const histogram = new promClient.Histogram({
      name: this.getMetricName(name),
      help,
      labelNames,
      buckets,
      registers: [this.registry]
    });

    this.customMetrics.set(name, histogram);
    return histogram;
  }

  /**
   * Records a metric value with error handling and performance optimization
   * @param metricName - Name of the metric to record
   * @param value - Metric value
   * @param labels - Metric labels
   */
  public async recordMetric(
    metricName: string,
    value: number,
    labels: Record<string, string> = {}
  ): Promise<void> {
    try {
      const metric = this.customMetrics.get(metricName);
      if (!metric) {
        throw new Error(`Metric ${metricName} not found`);
      }

      if (metric instanceof promClient.Counter) {
        metric.inc(labels, value);
      } else if (metric instanceof promClient.Gauge) {
        metric.set(labels, value);
      } else if (metric instanceof promClient.Histogram) {
        metric.observe(labels, value);
      }

      this.logger.debug('Metric recorded', {
        metric: metricName,
        value,
        labels
      });
    } catch (error) {
      const errorResponse = error as IErrorResponse;
      this.logger.error('Failed to record metric', errorResponse, {
        metric: metricName,
        value,
        labels
      });
      throw error;
    }
  }

  /**
   * Creates an Express middleware for exposing metrics endpoint
   * @returns Express middleware function
   */
  public getMetricsMiddleware(): express.RequestHandler {
    return async (req: express.Request, res: express.Response): Promise<void> => {
      try {
        // Check authentication if enabled
        if (this.metricsEndpointAuth && !this.isAuthenticated(req)) {
          res.status(401).json({ error: 'Unauthorized access to metrics endpoint' });
          return;
        }

        const metrics = await this.registry.metrics();
        res.set('Content-Type', this.registry.contentType);
        res.end(metrics);
      } catch (error) {
        const errorResponse = error as IErrorResponse;
        this.logger.error('Failed to serve metrics', errorResponse);
        res.status(500).json({ error: 'Failed to collect metrics' });
      }
    };
  }

  /**
   * Validates metric creation parameters
   * @param name - Metric name
   * @param labelNames - Array of label names
   */
  private validateMetricCreation(name: string, labelNames: string[]): void {
    if (!METRIC_NAME_REGEX.test(name)) {
      throw new Error('Invalid metric name format');
    }

    if (labelNames.length > MAX_LABEL_CARDINALITY) {
      throw new Error(`Label cardinality exceeds maximum of ${MAX_LABEL_CARDINALITY}`);
    }

    if (this.customMetrics.has(name)) {
      throw new Error(`Metric ${name} already exists`);
    }
  }

  /**
   * Generates full metric name with prefix
   * @param name - Base metric name
   * @returns Prefixed metric name
   */
  private getMetricName(name: string): string {
    return `${DEFAULT_METRICS_PREFIX}${name}`;
  }

  /**
   * Checks if the request is authenticated for metrics access
   * @param req - Express request object
   * @returns Boolean indicating if request is authenticated
   */
  private isAuthenticated(req: express.Request): boolean {
    // Implement your authentication logic here
    // This is a placeholder implementation
    const apiKey = req.headers['x-metrics-key'];
    return apiKey === process.env.METRICS_API_KEY;
  }

  /**
   * Removes a metric from collection
   * @param name - Name of the metric to remove
   */
  public removeMetric(name: string): void {
    const metric = this.customMetrics.get(name);
    if (metric) {
      this.registry.removeSingleMetric(this.getMetricName(name));
      this.customMetrics.delete(name);
      this.logger.info(`Metric ${name} removed`);
    }
  }
}

// Export singleton instance for global metrics management
export const globalMetrics = new MetricsManager('global');