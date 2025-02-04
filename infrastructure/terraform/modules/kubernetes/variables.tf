# Terraform version constraint
terraform {
  required_version = "~> 1.0"
}

# Environment variable with validation
variable "environment" {
  type        = string
  description = "Deployment environment (dev, staging, prod, dr) for resource isolation and configuration"
  validation {
    condition     = contains(["dev", "staging", "prod", "dr"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod, dr"
  }
}

# VPC configuration variables
variable "vpc_id" {
  type        = string
  description = "ID of the VPC where EKS cluster will be deployed for network isolation"
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR block of the VPC for configuring security group rules and network policies"
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "List of private subnet IDs for EKS node groups deployment across availability zones"
}

# EKS cluster configuration
variable "cluster_version" {
  type        = string
  description = "Kubernetes version for the EKS cluster with semantic versioning support"
  default     = "1.27"
  validation {
    condition     = can(regex("^\\d+\\.\\d+$", var.cluster_version))
    error_message = "Kubernetes version must be in the format X.Y"
  }
}

# Node group configuration
variable "node_instance_types" {
  type        = list(string)
  description = "List of EC2 instance types for EKS node groups supporting mixed instance policy"
  default     = ["t3.large"]
}

variable "node_desired_size" {
  type        = number
  description = "Desired number of nodes in EKS node group for normal operation"
  default     = 3
}

variable "node_min_size" {
  type        = number
  description = "Minimum number of nodes in EKS node group for high availability"
  default     = 3
}

variable "node_max_size" {
  type        = number
  description = "Maximum number of nodes in EKS node group for scaling headroom"
  default     = 10
}

# Security configuration
variable "enable_cluster_encryption" {
  type        = bool
  description = "Enable envelope encryption for Kubernetes secrets using KMS for data protection"
  default     = true
}

variable "cluster_log_types" {
  type        = list(string)
  description = "List of EKS cluster log types to enable for audit and monitoring"
  default     = ["api", "audit", "authenticator", "controllerManager", "scheduler"]
}

# Resource tagging
variable "tags" {
  type        = map(string)
  description = "Additional tags for EKS cluster resources and cost allocation"
  default = {
    Project   = "TaskManagementSystem"
    ManagedBy = "Terraform"
  }
}