# Core Terraform functionality for variable definitions
# terraform ~> 1.0

variable "environment" {
  type        = string
  description = "Deployment environment identifier (dev, staging, prod, dr)"
  
  validation {
    condition     = contains(["dev", "staging", "prod", "dr"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod, dr"
  }
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "List of private subnet IDs where database instances will be deployed"
}

variable "vpc_security_group_ids" {
  type        = list(string)
  description = "List of security group IDs for database access control"
}

variable "availability_zones" {
  type        = list(string)
  description = "List of availability zones for multi-AZ database deployment"
}

variable "db_instance_count" {
  type        = number
  description = "Number of database instances in the Aurora cluster"
  default     = 3 # Default to 3 instances for high availability
}

variable "db_instance_class" {
  type        = string
  description = "Instance class for database nodes"
  default     = "db.r6g.large" # Memory-optimized instance type for database workloads
}

variable "db_master_username" {
  type        = string
  description = "Master username for database cluster"
  sensitive   = true # Marked as sensitive to prevent exposure in logs
}

variable "db_master_password" {
  type        = string
  description = "Master password for database cluster"
  sensitive   = true # Marked as sensitive to prevent exposure in logs
}

variable "kms_key_arn" {
  type        = string
  description = "ARN of KMS key for database encryption"
}

variable "cache_cluster_count" {
  type        = number
  description = "Number of nodes in Redis cache cluster"
  default     = 3 # Default to 3 nodes for high availability
}

variable "cache_node_type" {
  type        = string
  description = "Instance type for Redis cache nodes"
  default     = "cache.r6g.large" # Memory-optimized instance type for caching workloads
}

variable "tags" {
  type        = map(string)
  description = "Additional tags for database resources"
  default = {
    Project    = "TaskManagementSystem"
    ManagedBy  = "Terraform"
  }
}