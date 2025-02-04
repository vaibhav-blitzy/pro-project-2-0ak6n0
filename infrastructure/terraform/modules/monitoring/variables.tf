# Terraform ~> 1.0
# Core variables for monitoring infrastructure module configuring Prometheus, Grafana, ELK Stack, and Jaeger

variable "environment" {
  type        = string
  description = "Environment name (dev, staging, prod)"
  validation {
    condition     = can(regex("^(dev|staging|prod)$", var.environment))
    error_message = "Environment must be dev, staging, or prod"
  }
}

variable "cluster_name" {
  type        = string
  description = "Name of the Kubernetes cluster where monitoring stack will be deployed"
}

variable "monitoring_namespace" {
  type        = string
  description = "Kubernetes namespace for monitoring components"
  default     = "monitoring"
}

variable "enable_persistent_storage" {
  type        = bool
  description = "Enable persistent storage for monitoring components"
  default     = true
}

variable "storage_class_name" {
  type        = string
  description = "Storage class name for persistent volumes"
  default     = "gp2"
}

variable "prometheus_retention_period" {
  type        = string
  description = "Data retention period for Prometheus metrics"
  default     = "15d"
}

variable "prometheus_scrape_interval" {
  type        = string
  description = "Interval at which Prometheus scrapes metrics"
  default     = "30s"
}

variable "metrics_retention_size" {
  type        = string
  description = "Storage size for metrics data"
  default     = "50Gi"
}

variable "grafana_admin_password" {
  type        = string
  description = "Admin password for Grafana dashboard"
  sensitive   = true
}

variable "elasticsearch_retention_days" {
  type        = number
  description = "Number of days to retain Elasticsearch logs"
  default     = 30
}

variable "jaeger_sampling_rate" {
  type        = number
  description = "Sampling rate for Jaeger tracing (0.0 to 1.0)"
  default     = 1
  validation {
    condition     = var.jaeger_sampling_rate >= 0 && var.jaeger_sampling_rate <= 1
    error_message = "Jaeger sampling rate must be between 0 and 1"
  }
}