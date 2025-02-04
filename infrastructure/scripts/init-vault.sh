#!/usr/bin/env bash

# Production-grade Vault initialization script
# Version: 1.0.0
# Dependencies:
# - vault v1.13.0
# - aws-cli v2.0.0
# - kubectl v1.27.0

set -euo pipefail
IFS=$'\n\t'

# Import configuration files
source "$(dirname "$0")/../../security/vault/config.hcl"

# Global variables from environment
readonly VAULT_ADDR=${VAULT_ADDR:-"https://vault.internal:8200"}
readonly VAULT_TOKEN=${VAULT_TOKEN:-""}
readonly AWS_REGION=${AWS_REGION:-"us-west-2"}
readonly LOG_LEVEL=${LOG_LEVEL:-"INFO"}
readonly RETRY_ATTEMPTS=${RETRY_ATTEMPTS:-3}
readonly HA_ENABLED=${HA_ENABLED:-"true"}

# Constants
readonly BACKUP_DIR="/vault/backup"
readonly LOG_DIR="/vault/logs"
readonly CONFIG_DIR="/vault/config"
readonly DATA_DIR="/vault/data"

# Logging functions
log() {
    local level=$1
    shift
    echo "$(date '+%Y-%m-%d %H:%M:%S') [$level] $*" | tee -a "${LOG_DIR}/init.log"
}

log_info() {
    [[ "$LOG_LEVEL" =~ ^(INFO|DEBUG)$ ]] && log "INFO" "$@"
}

log_error() {
    log "ERROR" "$@"
}

log_debug() {
    [[ "$LOG_LEVEL" == "DEBUG" ]] && log "DEBUG" "$@"
}

# Error handling
error_handler() {
    local line_no=$1
    local error_code=$2
    log_error "Error occurred in script $0 at line $line_no (exit code: $error_code)"
    cleanup
    exit "$error_code"
}

trap 'error_handler ${LINENO} $?' ERR

# Cleanup function
cleanup() {
    log_info "Performing cleanup..."
    rm -f /tmp/vault.* 2>/dev/null || true
}

# Verify prerequisites
verify_prerequisites() {
    log_info "Verifying prerequisites..."
    
    # Check required tools
    for cmd in vault aws kubectl; do
        if ! command -v "$cmd" &>/dev/null; then
            log_error "Required command not found: $cmd"
            exit 1
        fi
    done

    # Verify directories
    for dir in "$BACKUP_DIR" "$LOG_DIR" "$CONFIG_DIR" "$DATA_DIR"; do
        if [[ ! -d "$dir" ]]; then
            log_info "Creating directory: $dir"
            mkdir -p "$dir"
            chmod 700 "$dir"
        fi
    done

    # Verify AWS credentials
    if ! aws sts get-caller-identity &>/dev/null; then
        log_error "AWS credentials not configured"
        exit 1
    }
}

# Initialize Vault server
initialize_vault() {
    local key_shares=$1
    local key_threshold=$2
    
    log_info "Initializing Vault server..."
    
    # Check if already initialized
    if vault status &>/dev/null; then
        log_info "Vault is already initialized"
        return 0
    }

    # Initialize with specified parameters
    local init_output
    init_output=$(vault operator init \
        -key-shares="$key_shares" \
        -key-threshold="$key_threshold" \
        -format=json)

    # Backup initialization data to AWS KMS
    log_info "Backing up initialization data..."
    aws kms encrypt \
        --region "$AWS_REGION" \
        --key-id "alias/vault-init-backup" \
        --plaintext "$init_output" \
        --output text \
        --query CiphertextBlob > "${BACKUP_DIR}/init-$(date +%Y%m%d-%H%M%S).enc"

    # Configure auto-unseal using AWS KMS
    vault write sys/config/seal \
        type=awskms \
        region="$AWS_REGION" \
        kms_key_id="alias/vault-unseal-key"

    log_info "Vault initialization completed successfully"
}

# Configure authentication methods
configure_auth_methods() {
    log_info "Configuring authentication methods..."

    # Enable and configure Kubernetes auth
    vault auth enable kubernetes
    vault write auth/kubernetes/config \
        kubernetes_host="https://kubernetes.default.svc" \
        kubernetes_ca_cert="@/var/run/secrets/kubernetes.io/serviceaccount/ca.crt" \
        token_reviewer_jwt="$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)"

    # Enable and configure AWS auth
    vault auth enable aws
    vault write auth/aws/config/client \
        region="$AWS_REGION"

    # Enable and configure OIDC auth for UI
    vault auth enable oidc
    vault write auth/oidc/config \
        oidc_discovery_url="https://accounts.google.com" \
        oidc_client_id="$OIDC_CLIENT_ID" \
        oidc_client_secret="$OIDC_CLIENT_SECRET" \
        default_role="default"

    log_info "Authentication methods configured successfully"
}

# Configure secret engines
setup_secret_engines() {
    log_info "Setting up secret engines..."

    # Enable KV v2 engine
    vault secrets enable -version=2 kv
    vault secrets tune -max-lease-ttl=8760h kv

    # Enable Transit engine for encryption
    vault secrets enable transit
    vault write transit/keys/data-encryption type=aes256-gcm96

    # Enable PKI for certificate management
    vault secrets enable pki
    vault secrets tune -max-lease-ttl=8760h pki
    vault write pki/root/generate/internal \
        common_name="Task Management System CA" \
        ttl=8760h

    # Enable Database engine
    vault secrets enable database
    
    log_info "Secret engines configured successfully"
}

# Configure access policies
configure_policies() {
    log_info "Configuring access policies..."

    # Create service-specific policies
    for service in api-gateway auth-service task-service project-service notification-service search-service; do
        vault policy write "$service" - <<EOF
path "kv/data/${service}/*" {
    capabilities = ["read"]
}
path "transit/encrypt/data-encryption" {
    capabilities = ["update"]
}
path "transit/decrypt/data-encryption" {
    capabilities = ["update"]
}
EOF
    done

    # Create admin policy
    vault policy write admin - <<EOF
path "*" {
    capabilities = ["create", "read", "update", "delete", "list", "sudo"]
}
EOF

    log_info "Access policies configured successfully"
}

# Main execution
main() {
    log_info "Starting Vault initialization process..."
    
    verify_prerequisites
    
    # Initialize Vault with secure parameters
    initialize_vault 5 3
    
    # Configure authentication and authorization
    configure_auth_methods
    setup_secret_engines
    configure_policies
    
    log_info "Vault initialization completed successfully"
    cleanup
}

# Execute main function
main "$@"