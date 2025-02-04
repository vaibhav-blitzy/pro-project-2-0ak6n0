// External imports with versions
import now from 'performance-now'; // v2.1.0
import { mean, median, quantile, linearRegression } from 'simple-statistics'; // v7.8.0
import { createLogger, format, transports } from 'winston'; // v3.8.0

// Performance thresholds in milliseconds
const PERFORMANCE_THRESHOLDS = {
    API_READ: 100,
    API_WRITE: 200,
    API_BATCH: 500,
    PAGE_FIRST_PAINT: 1000,
    PAGE_FIRST_INTERACTIVE: 2000,
    PAGE_FULL_LOAD: 3000,
    ALERT_THRESHOLD_P95: 450,
    ALERT_THRESHOLD_P99: 490,
    DEGRADATION_THRESHOLD: 1.5
};

// Configure logger for performance metrics
const logger = createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp(),
        format.json()
    ),
    transports: [
        new transports.Console(),
        new transports.File({ filename: 'performance-metrics.log' })
    ]
});

// Types
interface PerformanceMetric {
    timestamp: number;
    duration: number;
    type: string;
    context: object;
    metadata: {
        resourceUsage?: NodeJS.ResourceUsage;
        memoryUsage?: NodeJS.MemoryUsage;
    };
}

interface PageLoadMetrics {
    url: string;
    firstPaint: number;
    firstContentfulPaint: number;
    timeToInteractive: number;
    domComplete: number;
    resourceTiming: ResourceTiming[];
    cumulativeLayoutShift: number;
    largestContentfulPaint: number;
}

interface AnalysisOptions {
    timeRange?: [Date, Date];
    percentiles?: number[];
    detectAnomalies?: boolean;
    trendAnalysis?: boolean;
}

interface PerformanceAnalysis {
    mean: number;
    median: number;
    percentiles: { [key: string]: number };
    trends: TrendAnalysis;
    anomalies: Anomaly[];
    recommendations: string[];
}

interface StorageConfig {
    retentionPeriod: number;
    rotationSize: number;
    storageType: 'memory' | 'persistent';
}

// High-precision API response time measurement
export async function measureApiResponse(
    apiCall: Promise<any>,
    context: object
): Promise<PerformanceMetric> {
    const startTime = now();
    const startResourceUsage = process.resourceUsage();

    try {
        const result = await apiCall;
        const endTime = now();
        const duration = endTime - startTime;

        const metric: PerformanceMetric = {
            timestamp: Date.now(),
            duration,
            type: 'api_call',
            context,
            metadata: {
                resourceUsage: process.resourceUsage(),
                memoryUsage: process.memoryUsage()
            }
        };

        logger.info('API Performance Metric', { metric });
        return metric;
    } catch (error) {
        logger.error('API Call Error', { error, context });
        throw error;
    }
}

// Comprehensive page load performance measurement
export async function measurePageLoad(
    page: any,
    url: string,
    options: object = {}
): Promise<PageLoadMetrics> {
    const metrics: PageLoadMetrics = {
        url,
        firstPaint: 0,
        firstContentfulPaint: 0,
        timeToInteractive: 0,
        domComplete: 0,
        resourceTiming: [],
        cumulativeLayoutShift: 0,
        largestContentfulPaint: 0
    };

    try {
        await page.evaluateOnNewDocument(() => {
            performance.mark('navigation-start');
        });

        const performanceEntries = await page.evaluate(() => {
            return {
                paint: performance.getEntriesByType('paint'),
                navigation: performance.getEntriesByType('navigation'),
                resource: performance.getEntriesByType('resource')
            };
        });

        metrics.firstPaint = performanceEntries.paint[0]?.startTime || 0;
        metrics.firstContentfulPaint = performanceEntries.paint[1]?.startTime || 0;
        metrics.domComplete = performanceEntries.navigation[0]?.domComplete || 0;

        logger.info('Page Load Metrics', { metrics });
        return metrics;
    } catch (error) {
        logger.error('Page Load Measurement Error', { error, url });
        throw error;
    }
}

// Advanced performance metric analysis
export function analyzePerformanceMetrics(
    metrics: PerformanceMetric[],
    options: AnalysisOptions = {}
): PerformanceAnalysis {
    if (!metrics.length) {
        throw new Error('No metrics provided for analysis');
    }

    const durations = metrics.map(m => m.duration);
    const analysis: PerformanceAnalysis = {
        mean: mean(durations),
        median: median(durations),
        percentiles: {
            p95: quantile(durations, 0.95),
            p99: quantile(durations, 0.99)
        },
        trends: analyzeTrends(metrics),
        anomalies: detectAnomalies(metrics),
        recommendations: generateRecommendations(metrics)
    };

    logger.info('Performance Analysis', { analysis });
    return analysis;
}

// Performance Metrics Collector class
export class PerformanceMetricsCollector {
    private metrics: PerformanceMetric[] = [];
    private thresholds: typeof PERFORMANCE_THRESHOLDS;
    private storage: any;
    private alertManager: any;

    constructor(
        customThresholds: Partial<typeof PERFORMANCE_THRESHOLDS> = {},
        storageConfig: StorageConfig
    ) {
        this.thresholds = { ...PERFORMANCE_THRESHOLDS, ...customThresholds };
        this.initializeStorage(storageConfig);
        this.initializeAlertManager();
    }

    private initializeStorage(config: StorageConfig): void {
        // Initialize storage system based on configuration
        this.storage = {
            save: async (metric: PerformanceMetric) => {
                this.metrics.push(metric);
                this.rotateMetricsIfNeeded(config.rotationSize);
            }
        };
    }

    private initializeAlertManager(): void {
        this.alertManager = {
            checkThresholds: (metric: PerformanceMetric) => {
                if (metric.duration > this.thresholds.ALERT_THRESHOLD_P95) {
                    logger.warn('Performance threshold exceeded', { metric });
                }
            }
        };
    }

    private rotateMetricsIfNeeded(maxSize: number): void {
        if (this.metrics.length > maxSize) {
            this.metrics = this.metrics.slice(-maxSize);
        }
    }

    async addMetric(metric: PerformanceMetric): Promise<void> {
        try {
            await this.storage.save(metric);
            this.alertManager.checkThresholds(metric);
            this.updateTrends(metric);
        } catch (error) {
            logger.error('Error adding metric', { error, metric });
            throw error;
        }
    }

    async generateReport(options: any = {}): Promise<PerformanceAnalysis> {
        try {
            const analysis = analyzePerformanceMetrics(this.metrics, options);
            logger.info('Generated performance report', { 
                metricsCount: this.metrics.length,
                analysisOverview: {
                    mean: analysis.mean,
                    p95: analysis.percentiles.p95
                }
            });
            return analysis;
        } catch (error) {
            logger.error('Error generating report', { error });
            throw error;
        }
    }

    private updateTrends(metric: PerformanceMetric): void {
        // Update running performance trends
        const recentMetrics = this.metrics.slice(-100);
        const trend = analyzeTrends(recentMetrics);
        
        if (trend.degradation > this.thresholds.DEGRADATION_THRESHOLD) {
            logger.warn('Performance degradation detected', { trend });
        }
    }
}

// Helper functions
function analyzeTrends(metrics: PerformanceMetric[]): any {
    const points = metrics.map((m, i) => [i, m.duration]);
    return linearRegression(points);
}

function detectAnomalies(metrics: PerformanceMetric[]): Anomaly[] {
    const durations = metrics.map(m => m.duration);
    const meanDuration = mean(durations);
    const stdDev = Math.sqrt(mean(durations.map(d => Math.pow(d - meanDuration, 2))));
    
    return metrics
        .filter(m => Math.abs(m.duration - meanDuration) > 2 * stdDev)
        .map(m => ({
            metric: m,
            deviation: Math.abs(m.duration - meanDuration) / stdDev
        }));
}

function generateRecommendations(metrics: PerformanceMetric[]): string[] {
    const recommendations: string[] = [];
    const analysis = analyzePerformanceMetrics(metrics);

    if (analysis.percentiles.p95 > PERFORMANCE_THRESHOLDS.ALERT_THRESHOLD_P95) {
        recommendations.push('Consider implementing caching to improve p95 response times');
    }

    if (analysis.percentiles.p99 > PERFORMANCE_THRESHOLDS.ALERT_THRESHOLD_P99) {
        recommendations.push('Investigate and optimize outlier cases affecting p99 performance');
    }

    return recommendations;
}

interface Anomaly {
    metric: PerformanceMetric;
    deviation: number;
}

interface TrendAnalysis {
    slope: number;
    degradation: number;
}

interface ResourceTiming {
    name: string;
    duration: number;
    startTime: number;
    responseEnd: number;
}