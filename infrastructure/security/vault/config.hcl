# Vault Server Configuration
# Version: 1.13.0
# Purpose: Production configuration for high-availability Vault cluster with AWS KMS auto-unseal

# Storage configuration using Raft for high availability
storage "raft" {
  path = "/vault/data"
  node_id = "vault_1"
  
  retry_join {
    leader_api_addr = "https://vault-0.vault-internal:8200"
    leader_ca_cert_file = "/vault/tls/ca.crt"
  }
  
  performance_multiplier = 1
}

# Listener configuration with mutual TLS authentication
listener "tcp" {
  address = "0.0.0.0:8200"
  
  # TLS Configuration
  tls_cert_file = "/vault/tls/tls.crt"
  tls_key_file = "/vault/tls/tls.key"
  tls_min_version = "tls12"
  tls_client_ca_file = "/vault/tls/ca.crt"
  tls_require_and_verify_client_cert = "true"
  
  # TLS Cipher Suites (FIPS 140-2 Compliant)
  tls_cipher_suites = [
    "TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384",
    "TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384",
    "TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256",
    "TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256"
  ]
}

# AWS KMS seal configuration for auto-unseal
seal "awskms" {
  region = "us-west-2"
  kms_key_id = "alias/vault-unseal-key"
  endpoint = "https://kms.us-west-2.amazonaws.com"
}

# API and cluster addresses for HA setup
api_addr = "https://vault.internal:8200"
cluster_addr = "https://vault.internal:8201"

# Enable UI access
ui = true

# Telemetry configuration for monitoring
telemetry {
  prometheus_retention_time = "24h"
  disable_hostname = true
  
  # Statsd configuration
  statsd_address = "statsd.monitoring:8125"
  
  # Disable telemetry for dev/staging environments
  disable_hostname = true
}

# Audit logging configuration
audit {
  device "file" {
    path = "/vault/logs/audit.log"
    
    # Log rotation settings
    max_age = "30d"
    max_size = "100MiB"
  }
}

# Enterprise license configuration (if applicable)
license_path = "/vault/config/license.hclic"

# Service registration for consul
service_registration "consul" {
  address = "consul.service.consul:8500"
  service_tags = ["prod", "vault"]
  service_address = "vault.internal"
}

# Cluster name for identification
cluster_name = "task-management-production"

# Default max lease TTL
max_lease_ttl = "768h"          # 32 days
default_lease_ttl = "168h"      # 7 days

# Disable mlock for containerized environments
disable_mlock = true

# Enable response wrapping
default_max_request_duration = "90s"