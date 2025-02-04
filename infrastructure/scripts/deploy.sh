#!/bin/bash

# Task Management System Deployment Script
# Version: 1.0.0
# This script implements advanced deployment automation for microservices
# across multiple environments with comprehensive validation and monitoring.

set -euo pipefail
IFS=$'\n\t'

# Import environment variables
source "$(dirname "$0")/.env" 2>/dev/null || true

# Global Constants
readonly ENVIRONMENTS=('dev' 'staging' 'prod' 'dr')
readonly SERVICES=('api-gateway' 'auth-service' 'task-service' 'project-service' 'notification-service' 'search-service')
readonly DEPLOYMENT_STRATEGIES=([dev]='rolling' [staging]='blue-green' [prod]='canary' [dr]='rolling')
readonly ROLLBACK_TIMEOUTS=([dev]=300 [staging]=300 [prod]=600 [dr]=1800)
readonly LOG_FILE='/var/log/deployments.log'
readonly METRIC_ENDPOINTS=([prometheus]='http://prometheus:9090' [grafana]='http://grafana:3000')

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m'

# Logging function with timestamp and log level
log() {
    local level=$1
    local message=$2
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    echo -e "${timestamp} [${level}] ${message}" | tee -a "${LOG_FILE}"
}

# Validate environment and configuration
validate_environment() {
    local environment=$1
    local config=$2
    
    log "INFO" "Validating environment: ${environment}"
    
    # Check if environment is valid
    if [[ ! " ${ENVIRONMENTS[@]} " =~ " ${environment} " ]]; then
        log "ERROR" "Invalid environment: ${environment}"
        return 1
    }
    
    # Verify Kubernetes cluster connectivity
    if ! kubectl cluster-info &>/dev/null; then
        log "ERROR" "Cannot connect to Kubernetes cluster"
        return 1
    }
    
    # Validate Helm installation
    if ! helm version &>/dev/null; then
        log "ERROR" "Helm is not installed or configured"
        return 1
    }
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &>/dev/null; then
        log "ERROR" "Invalid AWS credentials"
        return 1
    }
    
    # Verify namespace exists
    if ! kubectl get namespace "${environment}" &>/dev/null; then
        log "INFO" "Creating namespace: ${environment}"
        kubectl create namespace "${environment}"
    }
    
    # Verify required secrets
    local required_secrets=("aws-credentials" "db-credentials" "api-keys")
    for secret in "${required_secrets[@]}"; do
        if ! kubectl get secret "${secret}" -n "${environment}" &>/dev/null; then
            log "ERROR" "Required secret not found: ${secret}"
            return 1
        fi
    }
    
    # Verify monitoring stack
    for endpoint in "${!METRIC_ENDPOINTS[@]}"; do
        if ! curl -s "${METRIC_ENDPOINTS[$endpoint]}/health" &>/dev/null; then
            log "WARN" "Monitoring endpoint not available: ${endpoint}"
        fi
    done
    
    log "INFO" "Environment validation completed successfully"
    return 0
}

# Deploy service using environment-specific strategy
deploy_service() {
    local service_name=$1
    local environment=$2
    local version=$3
    local config=$4
    
    log "INFO" "Deploying ${service_name} to ${environment} with version ${version}"
    
    # Determine deployment strategy
    local strategy=${DEPLOYMENT_STRATEGIES[$environment]}
    
    # Create deployment directory
    local deploy_dir="/tmp/deploy/${environment}/${service_name}"
    mkdir -p "${deploy_dir}"
    
    # Prepare Helm values
    local values_file="${deploy_dir}/values.yaml"
    cat > "${values_file}" <<EOF
image:
  tag: ${version}
environment: ${environment}
EOF
    
    case ${strategy} in
        "blue-green")
            deploy_blue_green "${service_name}" "${environment}" "${version}" "${values_file}"
            ;;
        "canary")
            deploy_canary "${service_name}" "${environment}" "${version}" "${values_file}"
            ;;
        "rolling")
            deploy_rolling "${service_name}" "${environment}" "${version}" "${values_file}"
            ;;
        *)
            log "ERROR" "Unknown deployment strategy: ${strategy}"
            return 1
            ;;
    esac
    
    # Verify deployment
    if ! verify_deployment "${service_name}" "${environment}"; then
        log "ERROR" "Deployment verification failed"
        rollback_deployment "${service_name}" "${environment}" "${version}"
        return 1
    fi
    
    log "INFO" "Deployment completed successfully"
    return 0
}

# Blue-Green deployment implementation
deploy_blue_green() {
    local service_name=$1
    local environment=$2
    local version=$3
    local values_file=$4
    
    log "INFO" "Executing Blue-Green deployment"
    
    # Deploy new version (green)
    local green_release="${service_name}-${version}"
    if ! helm upgrade --install "${green_release}" "./helm/${service_name}" \
        -f "${values_file}" \
        --namespace "${environment}" \
        --set deployment.color=green \
        --wait --timeout 10m; then
        log "ERROR" "Green deployment failed"
        return 1
    fi
    
    # Verify green deployment
    if verify_deployment "${green_release}" "${environment}"; then
        # Switch traffic to green
        kubectl patch service "${service_name}" -n "${environment}" \
            -p "{\"spec\":{\"selector\":{\"color\":\"green\"}}}"
        
        # Remove old blue deployment
        helm uninstall "${service_name}-blue" -n "${environment}" || true
    else
        log "ERROR" "Green deployment verification failed"
        helm uninstall "${green_release}" -n "${environment}"
        return 1
    fi
}

# Canary deployment implementation
deploy_canary() {
    local service_name=$1
    local environment=$2
    local version=$3
    local values_file=$4
    
    log "INFO" "Executing Canary deployment"
    
    # Deploy canary version (10% traffic)
    if ! helm upgrade --install "${service_name}-canary" "./helm/${service_name}" \
        -f "${values_file}" \
        --namespace "${environment}" \
        --set deployment.weight=10 \
        --wait --timeout 5m; then
        log "ERROR" "Canary deployment failed"
        return 1
    fi
    
    # Monitor canary metrics for 5 minutes
    log "INFO" "Monitoring canary deployment"
    sleep 300
    
    # If canary is healthy, gradually increase traffic
    local weights=(25 50 75 100)
    for weight in "${weights[@]}"; do
        log "INFO" "Increasing canary weight to ${weight}%"
        kubectl patch service "${service_name}" -n "${environment}" \
            -p "{\"spec\":{\"trafficPolicy\":{\"weight\":${weight}}}}"
        sleep 60
        
        if ! verify_deployment "${service_name}-canary" "${environment}"; then
            log "ERROR" "Canary verification failed at ${weight}%"
            rollback_deployment "${service_name}" "${environment}" "${version}"
            return 1
        fi
    done
    
    # Promote canary to primary
    helm upgrade "${service_name}" "./helm/${service_name}" \
        -f "${values_file}" \
        --namespace "${environment}" \
        --set deployment.weight=100 \
        --wait --timeout 5m
}

# Rolling deployment implementation
deploy_rolling() {
    local service_name=$1
    local environment=$2
    local version=$3
    local values_file=$4
    
    log "INFO" "Executing Rolling deployment"
    
    # Perform rolling update
    if ! helm upgrade --install "${service_name}" "./helm/${service_name}" \
        -f "${values_file}" \
        --namespace "${environment}" \
        --set deployment.strategy.type=RollingUpdate \
        --set deployment.strategy.rollingUpdate.maxSurge=1 \
        --set deployment.strategy.rollingUpdate.maxUnavailable=0 \
        --wait --timeout 10m; then
        log "ERROR" "Rolling deployment failed"
        return 1
    fi
}

# Verify deployment health and performance
verify_deployment() {
    local service_name=$1
    local environment=$2
    
    log "INFO" "Verifying deployment: ${service_name}"
    
    # Check pod status
    local ready_pods=$(kubectl get pods -n "${environment}" \
        -l "app=${service_name}" \
        -o jsonpath='{.items[*].status.containerStatuses[*].ready}' | tr ' ' '\n' | grep -c "true")
    
    if [[ ${ready_pods} -eq 0 ]]; then
        log "ERROR" "No ready pods found for ${service_name}"
        return 1
    fi
    
    # Check service health endpoints
    local health_endpoint="http://${service_name}/actuator/health"
    if ! curl -s "${health_endpoint}" | grep -q '"status":"UP"'; then
        log "ERROR" "Health check failed for ${service_name}"
        return 1
    fi
    
    # Check metrics
    if ! check_service_metrics "${service_name}" "${environment}"; then
        log "ERROR" "Metric verification failed"
        return 1
    fi
    
    return 0
}

# Check service metrics
check_service_metrics() {
    local service_name=$1
    local environment=$2
    
    # Query Prometheus for error rate
    local error_rate=$(curl -s "${METRIC_ENDPOINTS[prometheus]}/api/v1/query" \
        --data-urlencode "query=rate(http_server_requests_seconds_count{status=~\"5..\"}[5m])" \
        | jq '.data.result[0].value[1]')
    
    if (( $(echo "${error_rate} > 0.01" | bc -l) )); then
        log "ERROR" "Error rate too high: ${error_rate}"
        return 1
    fi
    
    # Check response time
    local response_time=$(curl -s "${METRIC_ENDPOINTS[prometheus]}/api/v1/query" \
        --data-urlencode "query=histogram_quantile(0.95, rate(http_server_requests_seconds_bucket[5m]))" \
        | jq '.data.result[0].value[1]')
    
    if (( $(echo "${response_time} > 0.5" | bc -l) )); then
        log "ERROR" "Response time too high: ${response_time}s"
        return 1
    fi
    
    return 0
}

# Rollback deployment
rollback_deployment() {
    local service_name=$1
    local environment=$2
    local version=$3
    
    log "WARN" "Initiating rollback for ${service_name} in ${environment}"
    
    # Get previous successful release
    local previous_release=$(helm history "${service_name}" -n "${environment}" \
        | grep "DEPLOYED" \
        | tail -n 1 \
        | awk '{print $1}')
    
    if [[ -n "${previous_release}" ]]; then
        log "INFO" "Rolling back to revision ${previous_release}"
        if ! helm rollback "${service_name}" "${previous_release}" -n "${environment}" --wait; then
            log "ERROR" "Rollback failed"
            return 1
        fi
    else
        log "ERROR" "No previous successful release found"
        return 1
    fi
    
    log "INFO" "Rollback completed successfully"
    return 0
}

# Main deployment function
main() {
    local environment=$1
    local service_name=$2
    local version=$3
    
    log "INFO" "Starting deployment process"
    
    # Validate inputs
    if [[ $# -lt 3 ]]; then
        log "ERROR" "Usage: $0 <environment> <service> <version>"
        exit 1
    fi
    
    # Load configuration
    local config_file="./config/${environment}.yaml"
    if [[ ! -f "${config_file}" ]]; then
        log "ERROR" "Configuration file not found: ${config_file}"
        exit 1
    fi
    
    # Validate environment
    if ! validate_environment "${environment}" "${config_file}"; then
        log "ERROR" "Environment validation failed"
        exit 1
    fi
    
    # Deploy service
    if ! deploy_service "${service_name}" "${environment}" "${version}" "${config_file}"; then
        log "ERROR" "Deployment failed"
        exit 1
    fi
    
    log "INFO" "Deployment process completed successfully"
}

# Execute main function with provided arguments
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi