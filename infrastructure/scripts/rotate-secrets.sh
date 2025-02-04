#!/bin/bash

# Enterprise-grade secret rotation script for Task Management System
# Version: 1.0.0
# Purpose: Automated rotation of secrets and credentials with zero-downtime and compliance features

set -euo pipefail
IFS=$'\n\t'

# Import environment variables
if [[ -f ".env" ]]; then
    source .env
fi

# Global constants
readonly VAULT_ADDR=${VAULT_ADDR:-"https://vault.internal:8200"}
readonly ROTATION_GRACE_PERIOD=${ROTATION_GRACE_PERIOD:-3600}
readonly LOG_FILE=${LOG_FILE:-"/var/log/secret-rotation.log"}
readonly ENVIRONMENTS=("dev" "staging" "prod")
readonly MAX_RETRY_ATTEMPTS=3
readonly HEALTH_CHECK_INTERVAL=5
readonly PERFORMANCE_THRESHOLD_MS=500

# Initialize logging with security context
setup_logging() {
    if [[ ! -f "$LOG_FILE" ]]; then
        touch "$LOG_FILE"
        chmod 600 "$LOG_FILE"
    fi
    exec 1> >(tee -a "$LOG_FILE")
    exec 2> >(tee -a "$LOG_FILE" >&2)
}

log() {
    local level=$1
    local message=$2
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    echo "[$timestamp] [$level] $message"
}

# Validate prerequisites and environment
validate_environment() {
    local environment=$1
    
    # Verify required tools
    for cmd in vault aws kubectl jq curl; do
        if ! command -v "$cmd" &> /dev/null; then
            log "ERROR" "Required command not found: $cmd"
            exit 1
        fi
    done

    # Validate environment name
    if [[ ! " ${ENVIRONMENTS[*]} " =~ ${environment} ]]; then
        log "ERROR" "Invalid environment: $environment"
        exit 1
    }

    # Verify Vault connectivity
    if ! curl -s -k "$VAULT_ADDR/v1/sys/health" &> /dev/null; then
        log "ERROR" "Cannot connect to Vault server"
        exit 1
    }
}

# Create rotation lock to prevent concurrent operations
create_rotation_lock() {
    local resource=$1
    local lock_path="secret-rotation/$resource"
    
    if ! vault write -f "sys/locks/$lock_path" ttl="1h"; then
        log "ERROR" "Failed to acquire rotation lock for $resource"
        exit 1
    fi
}

# Release rotation lock
release_rotation_lock() {
    local resource=$1
    local lock_path="secret-rotation/$resource"
    
    vault delete "sys/locks/$lock_path"
}

# Rotate database credentials with zero-downtime
rotate_database_credentials() {
    local environment=$1
    local force=${2:-false}
    local start_time
    start_time=$(date +%s%N)

    log "INFO" "Starting database credential rotation for $environment"
    create_rotation_lock "database-$environment"

    try {
        # Generate new credentials
        local new_credentials
        new_credentials=$(vault write -f "database/creds/task-management-$environment")
        
        # Backup current credentials
        kubectl get secret "task-service-secrets" -n "task-management-$environment" -o json > "/tmp/db-backup-$environment.json"
        
        # Update Kubernetes secrets
        kubectl create secret generic "task-service-secrets" \
            --from-literal="db-username=$(echo "$new_credentials" | jq -r .username)" \
            --from-literal="db-password=$(echo "$new_credentials" | jq -r .password)" \
            --dry-run=client -o yaml | kubectl apply -f -
        
        # Perform rolling update
        kubectl rollout restart deployment/task-service -n "task-management-$environment"
        
        # Monitor deployment health
        local attempts=0
        while [[ $attempts -lt $MAX_RETRY_ATTEMPTS ]]; do
            if kubectl rollout status deployment/task-service -n "task-management-$environment" --timeout=300s; then
                break
            fi
            ((attempts++))
            sleep "$HEALTH_CHECK_INTERVAL"
        done

        # Validate database connectivity
        if ! check_database_health "$environment"; then
            throw "Database health check failed"
        }

        # Record metrics
        local end_time
        end_time=$(date +%s%N)
        local duration_ms=$(( (end_time - start_time) / 1000000 ))
        log "INFO" "Database credential rotation completed in ${duration_ms}ms"

    } catch {
        log "ERROR" "Failed to rotate database credentials: $1"
        if [[ -f "/tmp/db-backup-$environment.json" ]]; then
            kubectl apply -f "/tmp/db-backup-$environment.json"
        fi
        return 1
    } finally {
        release_rotation_lock "database-$environment"
        rm -f "/tmp/db-backup-$environment.json"
    }
}

# Rotate JWT signing keys with backward compatibility
rotate_jwt_keys() {
    local environment=$1
    local transition_period=${2:-3600}
    
    log "INFO" "Starting JWT key rotation for $environment"
    create_rotation_lock "jwt-$environment"

    try {
        # Generate new key pair
        local new_keys
        new_keys=$(vault write -f "transit/keys/jwt-$environment" type="rsa-2048")
        
        # Store new keys in Vault with versioning
        vault write "secret/jwt-keys-$environment" \
            public_key="$(echo "$new_keys" | jq -r .public_key)" \
            private_key="$(echo "$new_keys" | jq -r .private_key)" \
            version="$(date +%s)"
        
        # Update auth service configuration
        kubectl create configmap "auth-service-config" \
            --from-literal="jwt-public-key=$(echo "$new_keys" | jq -r .public_key)" \
            --from-literal="jwt-private-key=$(echo "$new_keys" | jq -r .private_key)" \
            --dry-run=client -o yaml | kubectl apply -f -
        
        # Gradual rollout with monitoring
        kubectl rollout restart deployment/auth-service -n "task-management-$environment"
        
        # Monitor token verification success rate
        local success_rate
        success_rate=$(check_token_verification_rate "$environment")
        if (( $(echo "$success_rate < 99.9" | bc -l) )); then
            throw "Token verification success rate below threshold: $success_rate%"
        }

    } catch {
        log "ERROR" "Failed to rotate JWT keys: $1"
        return 1
    } finally {
        release_rotation_lock "jwt-$environment"
    }
}

# Health check functions
check_database_health() {
    local environment=$1
    local healthy=false
    
    for i in $(seq 1 "$MAX_RETRY_ATTEMPTS"); do
        if kubectl exec -it "$(kubectl get pod -l app=task-service -n "task-management-$environment" -o jsonpath='{.items[0].metadata.name}')" \
            -n "task-management-$environment" -- pg_isready -h "$DB_HOST" -U "$DB_USER"; then
            healthy=true
            break
        fi
        sleep "$HEALTH_CHECK_INTERVAL"
    done
    
    return "$healthy"
}

check_token_verification_rate() {
    local environment=$1
    local metrics
    metrics=$(curl -s "http://prometheus:9090/api/v1/query" \
        --data-urlencode "query=rate(auth_token_verification_success_total{env=\"$environment\"}[5m])" \
        | jq -r '.data.result[0].value[1]')
    echo "$metrics"
}

# Main execution
main() {
    local environment=$1
    local operation=$2
    local start_time
    start_time=$(date +%s%N)

    setup_logging
    validate_environment "$environment"

    log "INFO" "Starting secret rotation for $environment"

    case "$operation" in
        "database")
            rotate_database_credentials "$environment"
            ;;
        "jwt")
            rotate_jwt_keys "$environment"
            ;;
        "all")
            rotate_database_credentials "$environment"
            rotate_jwt_keys "$environment"
            ;;
        *)
            log "ERROR" "Invalid operation: $operation"
            exit 1
            ;;
    esac

    local end_time
    end_time=$(date +%s%N)
    local duration_ms=$(( (end_time - start_time) / 1000000 ))

    if [[ $duration_ms -gt $PERFORMANCE_THRESHOLD_MS ]]; then
        log "WARN" "Secret rotation exceeded performance threshold: ${duration_ms}ms"
    }

    log "INFO" "Secret rotation completed successfully"
}

# Script entry point with error handling
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    if [[ $# -lt 2 ]]; then
        echo "Usage: $0 <environment> <operation>"
        echo "Operations: database, jwt, all"
        exit 1
    fi

    trap 'log "ERROR" "Script failed on line $LINENO"' ERR
    main "$@"
fi