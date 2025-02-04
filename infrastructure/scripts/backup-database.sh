#!/bin/bash

# Task Management System - Database Backup Script
# Version: 1.0.0
# Dependencies:
# - aws-cli v2.0.0+
# - postgresql-client v14+

set -euo pipefail

# Global Constants
readonly BACKUP_RETENTION_DAYS=7
readonly BACKUP_TYPES=("full" "incremental")
readonly S3_BUCKET_PREFIX="task-management-backups"
readonly ENVIRONMENTS=("dev" "staging" "prod" "dr")
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly TIMESTAMP=$(date +%Y%m%d_%H%M%S)
readonly LOG_FILE="/var/log/task-management/db-backup-${TIMESTAMP}.log"

# Logging setup
exec 1> >(tee -a "${LOG_FILE}")
exec 2> >(tee -a "${LOG_FILE}" >&2)

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

error() {
    log "ERROR: $1" >&2
    exit 1
}

# Function to check all prerequisites
check_prerequisites() {
    log "Checking prerequisites..."

    # Check AWS CLI version
    aws_version=$(aws --version 2>&1 | cut -d/ -f2 | cut -d' ' -f1)
    if [[ ! "${aws_version}" =~ ^2\. ]]; then
        error "AWS CLI version 2.0.0+ required, found: ${aws_version}"
    }

    # Verify AWS credentials and permissions
    if ! aws sts get-caller-identity &>/dev/null; then
        error "Invalid AWS credentials or insufficient permissions"
    }

    # Check PostgreSQL client
    if ! command -v pg_dump &>/dev/null; then
        error "PostgreSQL client tools not found"
    }
    pg_version=$(pg_dump --version | grep -oP '\d+' | head -1)
    if [[ "${pg_version}" -lt 14 ]]; then
        error "PostgreSQL client version 14+ required, found: ${pg_version}"
    }

    # Verify KMS key status
    if ! aws kms describe-key --key-id "${KMS_KEY_ID}" &>/dev/null; then
        error "Unable to access KMS key: ${KMS_KEY_ID}"
    }

    # Check S3 bucket
    if ! aws s3api head-bucket --bucket "${S3_BUCKET_PREFIX}-${ENVIRONMENT}" 2>/dev/null; then
        error "S3 bucket ${S3_BUCKET_PREFIX}-${ENVIRONMENT} not accessible"
    }

    log "All prerequisites checked successfully"
    return 0
}

# Function to create database backup
create_backup() {
    local environment="$1"
    local backup_type="$2"
    local backup_file="${TIMESTAMP}_${environment}_${backup_type}.sql.gz"
    local metadata_file="${backup_file}.meta"
    
    log "Creating ${backup_type} backup for ${environment} environment"

    # Get database endpoint from Terraform state
    local db_endpoint
    db_endpoint=$(aws rds describe-db-clusters \
        --db-cluster-identifier "${environment}-task-management-db" \
        --query 'DBClusters[0].Endpoint' \
        --output text)

    # Create backup with parallel compression
    PGPASSWORD="${DB_PASSWORD}" pg_dump \
        -h "${db_endpoint}" \
        -U "${DB_USER}" \
        -d "${DB_NAME}" \
        -F c \
        -Z 9 \
        -j 4 \
        --no-owner \
        --no-acl \
        2>/dev/null | \
        aws kms encrypt \
            --key-id "${KMS_KEY_ID}" \
            --encryption-algorithm "SYMMETRIC_DEFAULT" \
            --encryption-context "Environment=${environment},BackupType=${backup_type}" \
            --output text \
            --query CiphertextBlob > "${backup_file}"

    # Generate backup metadata
    cat > "${metadata_file}" <<EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "environment": "${environment}",
    "type": "${backup_type}",
    "db_version": "$(pg_dump --version)",
    "checksum": "$(sha256sum "${backup_file}" | cut -d' ' -f1)",
    "size": "$(stat -f %z "${backup_file}")",
    "encryption": {
        "algorithm": "AES-256-GCM",
        "kms_key_id": "${KMS_KEY_ID}"
    }
}
EOF

    log "Backup created successfully: ${backup_file}"
    echo "${backup_file}"
}

# Function to upload backup to S3
upload_backup() {
    local backup_file="$1"
    local environment="$2"
    local s3_path="s3://${S3_BUCKET_PREFIX}-${environment}/backups/$(date +%Y/%m/%d)/${backup_file}"

    log "Uploading backup to ${s3_path}"

    # Upload with multipart and server-side encryption
    aws s3 cp \
        "${backup_file}" \
        "${s3_path}" \
        --storage-class STANDARD_IA \
        --sse aws:kms \
        --sse-kms-key-id "${KMS_KEY_ID}" \
        --metadata-directive REPLACE \
        --metadata "environment=${environment},timestamp=${TIMESTAMP}"

    # Upload metadata file
    aws s3 cp \
        "${backup_file}.meta" \
        "${s3_path}.meta" \
        --storage-class STANDARD_IA

    # Verify upload
    if ! aws s3api head-object --bucket "${S3_BUCKET_PREFIX}-${environment}" --key "${backup_file}"; then
        error "Failed to verify backup upload"
    }

    log "Backup uploaded successfully"
    echo "${s3_path}"
}

# Function to clean up old backups
cleanup_old_backups() {
    local environment="$1"
    local retention_days="${2:-${BACKUP_RETENTION_DAYS}}"
    local count=0

    log "Cleaning up backups older than ${retention_days} days for ${environment}"

    # List and delete old backups from S3
    aws s3api list-objects-v2 \
        --bucket "${S3_BUCKET_PREFIX}-${environment}" \
        --prefix "backups/" \
        --query "Contents[?LastModified<='$(date -d "${retention_days} days ago" -u +%Y-%m-%dT%H:%M:%SZ)'].Key" \
        --output text | while read -r key; do
        if [[ -n "${key}" ]]; then
            aws s3 rm "s3://${S3_BUCKET_PREFIX}-${environment}/${key}"
            count=$((count + 1))
        fi
    done

    # Clean up local backup files
    find /tmp -name "${environment}_*.sql.gz*" -mtime "+${retention_days}" -delete

    log "Cleaned up ${count} old backups"
    return "${count}"
}

# Main backup orchestration
main() {
    local environment="$1"
    local backup_type="$2"

    # Validate input parameters
    if [[ ! " ${ENVIRONMENTS[@]} " =~ " ${environment} " ]]; then
        error "Invalid environment: ${environment}"
    }
    if [[ ! " ${BACKUP_TYPES[@]} " =~ " ${backup_type} " ]]; then
        error "Invalid backup type: ${backup_type}"
    }

    # Execute backup process
    check_prerequisites
    backup_file=$(create_backup "${environment}" "${backup_type}")
    s3_path=$(upload_backup "${backup_file}" "${environment}")
    cleanup_old_backups "${environment}"

    log "Backup process completed successfully"
    log "Backup location: ${s3_path}"
}

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    if [[ $# -ne 2 ]]; then
        error "Usage: $0 <environment> <backup_type>"
    fi
    main "$1" "$2"
fi

# Export functions for testing
export -f create_backup upload_backup