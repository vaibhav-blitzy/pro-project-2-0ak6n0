#!/usr/bin/env bash

# Enterprise-grade test environment setup script for Task Management System
# Version: 1.0.0
# Dependencies:
# - docker-compose v2.0+
# - docker v20.0+
# - jq v1.6+
# - netcat v1.0+

set -euo pipefail
IFS=$'\n\t'

# Script directory and project root
SCRIPT_DIR=$(dirname "${BASH_SOURCE[0]}")
PROJECT_ROOT=$(cd "$SCRIPT_DIR/../../" && pwd)
LOG_FILE="${PROJECT_ROOT}/logs/setup-test-env.log"
RETRY_COUNT=3
HEALTH_CHECK_TIMEOUT=300
REQUIRED_DISK_SPACE=5120 # 5GB in MB

# Initialize logging with rotation and proper formatting
initialize_logging() {
    mkdir -p "$(dirname "$LOG_FILE")"
    touch "$LOG_FILE"
    chmod 640 "$LOG_FILE"

    # Rotate logs if they exceed 100MB
    if [[ -f "$LOG_FILE" && $(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE") -gt 104857600 ]]; then
        mv "$LOG_FILE" "$LOG_FILE.$(date +%Y%m%d-%H%M%S)"
        gzip "$LOG_FILE.$(date +%Y%m%d-%H%M%S)"
    fi

    exec 3>&1 4>&2
    exec 1> >(tee -a "$LOG_FILE") 2>&1
}

# Log messages with timestamp and level
log() {
    local level=$1
    shift
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [$level] $*"
}

# Verify all prerequisites are met
check_prerequisites() {
    log "INFO" "Checking prerequisites..."

    # Check Docker daemon
    if ! docker info >/dev/null 2>&1; then
        log "ERROR" "Docker daemon is not running"
        return 1
    fi

    # Check Docker Compose
    if ! docker-compose version >/dev/null 2>&1; then
        log "ERROR" "Docker Compose is not installed"
        return 1
    fi

    # Check disk space
    local available_space
    available_space=$(df -m . | awk 'NR==2 {print $4}')
    if [[ $available_space -lt $REQUIRED_DISK_SPACE ]]; then
        log "ERROR" "Insufficient disk space. Required: ${REQUIRED_DISK_SPACE}MB, Available: ${available_space}MB"
        return 1
    }

    # Check required tools
    for tool in jq nc; do
        if ! command -v "$tool" >/dev/null 2>&1; then
            log "ERROR" "Required tool not found: $tool"
            return 1
        fi
    fi

    # Verify environment file
    if [[ ! -f "${PROJECT_ROOT}/src/test/.env.test" ]]; then
        log "ERROR" "Test environment file not found"
        return 1
    fi

    # Check port availability
    local required_ports=(5432 6379 9200 5672 8080 4444)
    for port in "${required_ports[@]}"; do
        if nc -z localhost "$port" 2>/dev/null; then
            log "ERROR" "Port $port is already in use"
            return 1
        fi
    fi

    log "INFO" "All prerequisites met"
    return 0
}

# Setup test database with proper isolation
setup_test_database() {
    log "INFO" "Setting up test database..."

    # Create isolated network for database
    docker network create test_db_network 2>/dev/null || true

    # Start database container with health checks
    docker-compose -f "${PROJECT_ROOT}/src/test/docker-compose.test.yml" up -d test-postgres

    # Wait for database to be ready
    local retries=0
    while [[ $retries -lt $RETRY_COUNT ]]; do
        if docker-compose -f "${PROJECT_ROOT}/src/test/docker-compose.test.yml" exec -T test-postgres pg_isready -U test_user -d taskmanager_test; then
            log "INFO" "Database is ready"
            break
        fi
        ((retries++))
        log "WARN" "Waiting for database to be ready (attempt $retries/$RETRY_COUNT)"
        sleep 5
    done

    if [[ $retries -eq $RETRY_COUNT ]]; then
        log "ERROR" "Database failed to start"
        return 1
    fi

    # Setup database monitoring
    docker stats --no-stream test-postgres >> "$LOG_FILE" 2>&1

    log "INFO" "Database setup completed"
    return 0
}

# Start test services with dependency handling
start_test_services() {
    log "INFO" "Starting test services..."

    # Pull required images
    docker-compose -f "${PROJECT_ROOT}/src/test/docker-compose.test.yml" pull

    # Create service networks
    docker network create test_network 2>/dev/null || true

    # Start services in dependency order
    local services=(test-redis test-elasticsearch test-rabbitmq test-security-scanner test-browser test-runner)
    
    for service in "${services[@]}"; do
        log "INFO" "Starting $service..."
        docker-compose -f "${PROJECT_ROOT}/src/test/docker-compose.test.yml" up -d "$service"
        
        # Wait for service health check
        local start_time=$SECONDS
        while [[ $((SECONDS - start_time)) -lt $HEALTH_CHECK_TIMEOUT ]]; do
            if docker-compose -f "${PROJECT_ROOT}/src/test/docker-compose.test.yml" ps "$service" | grep -q "healthy"; then
                log "INFO" "$service is healthy"
                break
            fi
            sleep 5
        done

        if [[ $((SECONDS - start_time)) -ge $HEALTH_CHECK_TIMEOUT ]]; then
            log "ERROR" "$service failed to become healthy within timeout"
            return 1
        fi
    done

    log "INFO" "All services started successfully"
    return 0
}

# Monitor resource usage of test environment
monitor_resource_usage() {
    log "INFO" "Starting resource monitoring..."

    # Create stats directory
    mkdir -p "${PROJECT_ROOT}/logs/stats"

    # Monitor container resources
    docker stats --no-stream $(docker-compose -f "${PROJECT_ROOT}/src/test/docker-compose.test.yml" ps -q) \
        > "${PROJECT_ROOT}/logs/stats/container_stats.log"

    # Monitor system resources
    top -b -n 1 > "${PROJECT_ROOT}/logs/stats/system_stats.log"

    # Check resource thresholds
    local cpu_threshold=80
    local mem_threshold=80

    # Parse docker stats
    local stats
    stats=$(docker stats --no-stream --format "{{.Container}}: CPU={{.CPUPerc}}, MEM={{.MemPerc}}")
    
    echo "$stats" | while IFS= read -r line; do
        local cpu_usage
        local mem_usage
        cpu_usage=$(echo "$line" | grep -oP 'CPU=\K[0-9.]+(?=%)')
        mem_usage=$(echo "$line" | grep -oP 'MEM=\K[0-9.]+(?=%)')
        
        if (( $(echo "$cpu_usage > $cpu_threshold" | bc -l) )); then
            log "WARN" "High CPU usage detected: $line"
        fi
        if (( $(echo "$mem_usage > $mem_threshold" | bc -l) )); then
            log "WARN" "High memory usage detected: $line"
        fi
    done

    return 0
}

# Cleanup resources on script failure
cleanup_on_error() {
    local exit_code=$1
    log "INFO" "Cleaning up resources after error (exit code: $exit_code)..."

    # Stop all containers
    docker-compose -f "${PROJECT_ROOT}/src/test/docker-compose.test.yml" down -v --remove-orphans

    # Remove networks
    docker network rm test_network test_db_network 2>/dev/null || true

    # Archive logs
    local archive_dir="${PROJECT_ROOT}/logs/archive"
    mkdir -p "$archive_dir"
    tar -czf "${archive_dir}/test-env-logs-$(date +%Y%m%d-%H%M%S).tar.gz" \
        -C "$(dirname "$LOG_FILE")" "$(basename "$LOG_FILE")" \
        "${PROJECT_ROOT}/logs/stats"

    # Remove sensitive data
    find "${PROJECT_ROOT}" -type f -name "*.env.test" -exec shred -u {} \;

    log "INFO" "Cleanup completed"
}

# Main execution
main() {
    # Set up error handling
    trap 'cleanup_on_error $?' ERR INT TERM PIPE HUP

    initialize_logging

    log "INFO" "Starting test environment setup..."

    # Execute setup steps
    check_prerequisites || exit 1
    setup_test_database || exit 3
    start_test_services || exit 2
    monitor_resource_usage || exit 5

    log "INFO" "Test environment setup completed successfully"
    return 0
}

main "$@"