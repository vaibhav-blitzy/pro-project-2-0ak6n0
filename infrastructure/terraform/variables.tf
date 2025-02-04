# AWS Region Configuration
variable "aws_region" {
  type        = string
  description = "AWS region for infrastructure deployment"
  default     = "us-west-2"
  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-\\d{1}$", var.aws_region))
    error_message = "AWS region must be a valid region identifier"
  }
}

# AWS Authentication
variable "aws_profile" {
  type        = string
  description = "AWS credentials profile for authentication"
  default     = "default"
  sensitive   = true
}

# Environment Configuration
variable "environment" {
  type        = string
  description = "Deployment environment (dev, staging, prod, dr)"
  validation {
    condition     = contains(["dev", "staging", "prod", "dr"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod, dr"
  }
}

# Network Configuration
variable "vpc_cidr" {
  type        = string
  description = "CIDR block for the VPC"
  default     = "10.0.0.0/16"
  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block"
  }
}

# Database Configuration
variable "db_instance_class" {
  type        = string
  description = "RDS instance class for database nodes"
  default     = "db.r6g.large"
}

variable "db_engine_version" {
  type        = string
  description = "PostgreSQL engine version"
  default     = "14.7"
  validation {
    condition     = can(regex("^\\d+\\.\\d+(\\.\\d+)?$", var.db_engine_version))
    error_message = "Database engine version must be in the format X.Y[.Z]"
  }
}

# Kubernetes Configuration
variable "kubernetes_version" {
  type        = string
  description = "EKS cluster Kubernetes version"
  default     = "1.27"
  validation {
    condition     = can(regex("^\\d+\\.\\d+$", var.kubernetes_version))
    error_message = "Kubernetes version must be in the format X.Y"
  }
}

variable "eks_node_instance_type" {
  type        = string
  description = "EC2 instance type for EKS worker nodes"
  default     = "t3.large"
  validation {
    condition     = can(regex("^[a-z][0-9][.][a-z]+$", var.eks_node_instance_type))
    error_message = "EKS node instance type must be a valid EC2 instance type"
  }
}

variable "eks_node_desired_size" {
  type        = number
  description = "Desired number of EKS worker nodes"
  default     = 3
  validation {
    condition     = var.eks_node_desired_size >= var.eks_node_min_size && var.eks_node_desired_size <= var.eks_node_max_size
    error_message = "Desired size must be between min and max size"
  }
}

variable "eks_node_max_size" {
  type        = number
  description = "Maximum number of EKS worker nodes"
  default     = 5
  validation {
    condition     = var.eks_node_max_size >= var.eks_node_min_size
    error_message = "Maximum size must be greater than or equal to minimum size"
  }
}

variable "eks_node_min_size" {
  type        = number
  description = "Minimum number of EKS worker nodes"
  default     = 3
  validation {
    condition     = var.eks_node_min_size > 0
    error_message = "Minimum size must be greater than 0"
  }
}

# Monitoring Configuration
variable "enable_monitoring" {
  type        = bool
  description = "Enable monitoring stack deployment"
  default     = true
}

# Resource Tagging
variable "tags" {
  type        = map(string)
  description = "Common tags to apply to all resources"
  default = {
    Project     = "TaskManagementSystem"
    ManagedBy   = "Terraform"
    Environment = "${var.environment}"
  }
}