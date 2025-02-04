#!/bin/bash

# Test Report Generation Script
# Version: 1.0.0
# Generates comprehensive test reports by aggregating results from Jest, Cypress, and k6 tests
# Dependencies:
# - nyc v15.1.0
# - mochawesome v7.1.3
# - axe-core v4.7.0
# - lighthouse v10.0.0

set -e

# Import configurations from test config files
JEST_CONFIG_PATH="../jest.config.ts"
CYPRESS_CONFIG_PATH="../cypress.config.ts"
K6_CONFIG_PATH="../k6.config.ts"

# Global constants
REPORT_DIR="./reports"
COVERAGE_DIR="./coverage"
MIN_COVERAGE=80
MAX_PARALLEL_TESTS=4
REPORT_RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Setup directories and cleanup old reports
setup_directories() {
    echo "Setting up report directories..."
    
    # Create main directories if they don't exist
    mkdir -p "${REPORT_DIR}"
    mkdir -p "${COVERAGE_DIR}"
    
    # Create subdirectories for different report types
    mkdir -p "${REPORT_DIR}/jest"
    mkdir -p "${REPORT_DIR}/cypress"
    mkdir -p "${REPORT_DIR}/k6"
    mkdir -p "${REPORT_DIR}/accessibility"
    mkdir -p "${REPORT_DIR}/unified"
    
    # Cleanup old reports
    find "${REPORT_DIR}" -type f -mtime +${REPORT_RETENTION_DAYS} -delete
    
    # Create temporary directories for parallel processing
    mkdir -p "${REPORT_DIR}/temp"
    
    # Initialize report metadata
    cat > "${REPORT_DIR}/metadata.json" <<EOF
{
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "version": "1.0.0",
    "environment": "${NODE_ENV:-development}"
}
EOF
}

# Generate Jest unit test reports
generate_jest_report() {
    echo "Generating Jest test reports..."
    
    # Run Jest tests with coverage
    npx jest --config="${JEST_CONFIG_PATH}" \
        --coverage \
        --coverageDirectory="${COVERAGE_DIR}" \
        --maxWorkers=${MAX_PARALLEL_TESTS} \
        --json --outputFile="${REPORT_DIR}/jest/results.json" \
        --testLocationInResults
    
    # Generate HTML coverage report
    npx nyc report --reporter=html --reporter=text-summary \
        --report-dir="${REPORT_DIR}/jest/coverage"
    
    # Validate coverage thresholds
    if ! npx nyc check-coverage --lines ${MIN_COVERAGE} --functions ${MIN_COVERAGE} \
        --branches ${MIN_COVERAGE} --statements ${MIN_COVERAGE}; then
        echo "Error: Code coverage is below minimum threshold of ${MIN_COVERAGE}%"
        return 1
    fi
    
    # Generate bundle size analysis
    npx source-map-explorer 'dist/**/*.js' \
        --html "${REPORT_DIR}/jest/bundle-analysis.html"
    
    return 0
}

# Generate Cypress E2E test reports
generate_cypress_report() {
    echo "Generating Cypress test reports..."
    
    # Run Cypress tests with parallel execution
    npx cypress run \
        --config-file="${CYPRESS_CONFIG_PATH}" \
        --reporter mochawesome \
        --reporter-options "reportDir=${REPORT_DIR}/cypress,overwrite=false,html=true,json=true" \
        --browser chrome \
        --headless
    
    # Run accessibility tests
    npx cypress run \
        --config-file="${CYPRESS_CONFIG_PATH}" \
        --spec "cypress/e2e/accessibility/**/*.cy.{js,jsx,ts,tsx}" \
        --env "axe=true"
    
    # Generate accessibility report
    npx axe --html-report="${REPORT_DIR}/accessibility/axe-report.html" \
        --exit-zero-always
    
    return 0
}

# Generate k6 performance test reports
generate_k6_report() {
    echo "Generating k6 performance test reports..."
    
    # Run k6 load tests
    k6 run --config "${K6_CONFIG_PATH}" \
        --out json="${REPORT_DIR}/k6/results.json" \
        --summary-export="${REPORT_DIR}/k6/summary.json" \
        performance-tests.js
    
    # Generate performance trending report
    node <<EOF
    const results = require('${REPORT_DIR}/k6/results.json');
    const analysis = require('./utils/performance-metrics').analyzePerformanceMetrics(results);
    require('fs').writeFileSync(
        '${REPORT_DIR}/k6/analysis.json',
        JSON.stringify(analysis, null, 2)
    );
EOF
    
    return 0
}

# Merge all reports into a unified HTML report
merge_reports() {
    echo "Merging test reports..."
    
    # Aggregate all test results
    node <<EOF
    const fs = require('fs');
    const path = require('path');
    
    const jestResults = require('${REPORT_DIR}/jest/results.json');
    const cypressResults = require('${REPORT_DIR}/cypress/mochawesome.json');
    const k6Results = require('${REPORT_DIR}/k6/summary.json');
    
    const unifiedReport = {
        timestamp: new Date().toISOString(),
        summary: {
            total: {
                tests: jestResults.numTotalTests + cypressResults.stats.tests,
                passed: jestResults.numPassedTests + cypressResults.stats.passes,
                failed: jestResults.numFailedTests + cypressResults.stats.failures,
                duration: jestResults.testResults.reduce((acc, r) => acc + r.perfStats.runtime, 0)
            },
            coverage: {
                statements: jestResults.coverageMap?.total?.statements?.pct || 0,
                branches: jestResults.coverageMap?.total?.branches?.pct || 0,
                functions: jestResults.coverageMap?.total?.functions?.pct || 0,
                lines: jestResults.coverageMap?.total?.lines?.pct || 0
            },
            performance: {
                p95: k6Results.metrics.http_req_duration.values['p(95)'],
                errorRate: k6Results.metrics.http_req_failed.values.rate
            }
        },
        details: {
            jest: jestResults,
            cypress: cypressResults,
            k6: k6Results
        }
    };
    
    fs.writeFileSync(
        path.join('${REPORT_DIR}', 'unified', 'report.json'),
        JSON.stringify(unifiedReport, null, 2)
    );
    
    // Generate HTML report
    const template = fs.readFileSync('templates/report.html', 'utf8');
    const html = template.replace('{{DATA}}', JSON.stringify(unifiedReport));
    fs.writeFileSync(
        path.join('${REPORT_DIR}', 'unified', 'report.html'),
        html
    );
EOF
    
    return 0
}

# Main function to orchestrate report generation
main() {
    echo "Starting test report generation..."
    
    # Initialize
    setup_directories
    
    # Generate individual reports
    generate_jest_report || exit 1
    generate_cypress_report || exit 1
    generate_k6_report || exit 1
    
    # Merge reports
    merge_reports || exit 1
    
    # Archive reports
    tar -czf "${REPORT_DIR}/reports_${TIMESTAMP}.tar.gz" \
        -C "${REPORT_DIR}" \
        --exclude="temp" \
        .
    
    # Cleanup temporary files
    rm -rf "${REPORT_DIR}/temp"
    
    echo "Test report generation completed successfully"
    echo "Reports available at: ${REPORT_DIR}/unified/report.html"
    return 0
}

# Execute main function
main "$@"