#!/bin/bash

# Enterprise-grade test execution script for Task Management System
# Version: 1.0.0
# Orchestrates comprehensive test suite execution including unit, integration,
# E2E, performance, security, and accessibility tests with enhanced error handling
# and resource management.

set -euo pipefail
IFS=$'\n\t'

# Import required scripts
SCRIPT_DIR=$(dirname "${BASH_SOURCE[0]}")
PROJECT_ROOT=$(cd "$SCRIPT_DIR/../../" && pwd)

# Source dependencies
source "${SCRIPT_DIR}/setup-test-env.sh"
source "${SCRIPT_DIR}/cleanup-test-data.sh"
source "${SCRIPT_DIR}/generate-test-report.sh"

# Global constants
declare -r TEST_ENV="test"
declare -r MAX_RETRIES=3
declare -r PARALLEL_JOBS=4
declare -r TEST_TIMEOUT=3600
declare -i EXIT_CODE=0

# Initialize logging
initialize_logging() {
    local log_dir="${PROJECT_ROOT}/logs/test"
    mkdir -p "$log_dir"
    local log_file="${log_dir}/test-execution-$(date +%Y%m%d-%H%M%S).log"
    
    # Rotate logs if they exceed 100MB
    if [[ -f "$log_file" && $(stat -f%z "$log_file" 2>/dev/null || stat -c%s "$log_file") -gt 104857600 ]]; then
        mv "$log_file" "${log_file}.old"
        gzip "${log_file}.old"
    fi
    
    exec 1> >(tee -a "$log_file")
    exec 2>&1
}

# Enhanced logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [$1] $2"
}

# Verify all prerequisites are met
check_prerequisites() {
    log "INFO" "Checking prerequisites..."
    
    # Check required tools
    local required_tools=(
        "node:18.0.0"
        "npm:8.0.0"
        "docker:20.0.0"
        "docker-compose:2.0.0"
        "k6:0.45.0"
        "zap-cli:2.12.0"
    )
    
    for tool in "${required_tools[@]}"; do
        IFS=':' read -r name version <<< "$tool"
        if ! command -v "$name" >/dev/null 2>&1; then
            log "ERROR" "$name is not installed"
            return 1
        fi
        
        if [[ "$name" == "node" ]]; then
            local current_version=$(node -v | cut -d 'v' -f2)
            if ! [[ "$(printf '%s\n' "$version" "$current_version" | sort -V | head -n1)" = "$version" ]]; then
                log "ERROR" "Node.js version must be >= $version"
                return 1
            fi
        fi
    done
    
    # Check system resources
    local required_memory=8000000 # 8GB in KB
    local available_memory=$(awk '/MemAvailable/ {print $2}' /proc/meminfo)
    if [[ $available_memory -lt $required_memory ]]; then
        log "ERROR" "Insufficient memory. Required: 8GB, Available: $((available_memory/1024/1024))GB"
        return 1
    }
    
    # Verify test environment file
    if [[ ! -f "${PROJECT_ROOT}/src/test/.env.test" ]]; then
        log "ERROR" "Test environment file not found"
        return 1
    }
    
    log "INFO" "All prerequisites met"
    return 0
}

# Execute unit tests with retry mechanism
run_unit_tests() {
    log "INFO" "Running unit tests..."
    local attempts=0
    local success=false
    
    while [[ $attempts -lt $MAX_RETRIES && $success == false ]]; do
        if npx jest \
            --config="${PROJECT_ROOT}/src/test/jest.config.ts" \
            --maxWorkers=$PARALLEL_JOBS \
            --coverage \
            --ci \
            --runInBand \
            --detectOpenHandles \
            --forceExit; then
            success=true
            log "INFO" "Unit tests completed successfully"
        else
            attempts=$((attempts + 1))
            if [[ $attempts -lt $MAX_RETRIES ]]; then
                log "WARN" "Unit tests failed, attempt $attempts of $MAX_RETRIES"
                sleep $((attempts * 2))
            else
                log "ERROR" "Unit tests failed after $MAX_RETRIES attempts"
                return 1
            fi
        fi
    done
    
    return 0
}

# Execute integration tests with enhanced error handling
run_integration_tests() {
    log "INFO" "Running integration tests..."
    
    # Start required services
    if ! docker-compose -f "${PROJECT_ROOT}/src/test/docker-compose.test.yml" up -d; then
        log "ERROR" "Failed to start test services"
        return 1
    fi
    
    # Wait for services to be ready
    local timeout=300
    local elapsed=0
    while [[ $elapsed -lt $timeout ]]; do
        if docker-compose -f "${PROJECT_ROOT}/src/test/docker-compose.test.yml" ps | grep -q "healthy"; then
            break
        fi
        sleep 5
        elapsed=$((elapsed + 5))
    done
    
    if [[ $elapsed -ge $timeout ]]; then
        log "ERROR" "Services failed to become healthy within timeout"
        return 1
    fi
    
    # Run integration tests
    if ! npx jest \
        --config="${PROJECT_ROOT}/src/test/jest.config.ts" \
        --testMatch="**/*.integration.test.ts" \
        --maxWorkers=$PARALLEL_JOBS \
        --forceExit; then
        log "ERROR" "Integration tests failed"
        return 1
    fi
    
    log "INFO" "Integration tests completed successfully"
    return 0
}

# Execute E2E tests with accessibility validation
run_e2e_tests() {
    log "INFO" "Running E2E tests..."
    
    # Run Cypress tests
    if ! npx cypress run \
        --config-file="${PROJECT_ROOT}/src/test/cypress.config.ts" \
        --browser chrome \
        --headless \
        --parallel \
        --record; then
        log "ERROR" "E2E tests failed"
        return 1
    fi
    
    # Run accessibility tests
    if ! npx cypress run \
        --config-file="${PROJECT_ROOT}/src/test/cypress.config.ts" \
        --env type=accessibility \
        --spec "cypress/e2e/accessibility/**/*"; then
        log "ERROR" "Accessibility tests failed"
        return 1
    fi
    
    log "INFO" "E2E tests completed successfully"
    return 0
}

# Execute performance tests with detailed metrics
run_performance_tests() {
    log "INFO" "Running performance tests..."
    
    # Run k6 load tests
    if ! k6 run \
        --config "${PROJECT_ROOT}/src/test/k6.config.ts" \
        --out json=test-results/k6.json \
        --vus 10 \
        --duration 30s \
        performance-tests.js; then
        log "ERROR" "Performance tests failed"
        return 1
    fi
    
    log "INFO" "Performance tests completed successfully"
    return 0
}

# Execute security tests
run_security_tests() {
    log "INFO" "Running security tests..."
    
    # Run OWASP ZAP scan
    if ! zap-cli quick-scan \
        --self-contained \
        --start-options "-config api.disablekey=true" \
        --spider \
        --ajax-spider \
        --recursive \
        --report "test-results/zap-report.html" \
        http://localhost:3000; then
        log "ERROR" "Security tests failed"
        return 1
    fi
    
    log "INFO" "Security tests completed successfully"
    return 0
}

# Main execution function
main() {
    local start_time=$(date +%s)
    
    # Initialize logging
    initialize_logging
    
    log "INFO" "Starting test execution..."
    
    # Setup trap for cleanup
    trap 'cleanup_on_error $?' ERR INT TERM
    
    # Check prerequisites
    check_prerequisites || exit 1
    
    # Setup test environment
    setup_test_env || exit 1
    
    # Execute test suites
    run_unit_tests || EXIT_CODE=1
    run_integration_tests || EXIT_CODE=1
    run_e2e_tests || EXIT_CODE=1
    run_performance_tests || EXIT_CODE=1
    run_security_tests || EXIT_CODE=1
    
    # Generate test reports
    generate_test_report || EXIT_CODE=1
    
    # Cleanup test environment
    cleanup_test_data || EXIT_CODE=1
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log "INFO" "Test execution completed in ${duration}s with exit code ${EXIT_CODE}"
    return $EXIT_CODE
}

# Execute main function
main "$@"