# Production Environment Configuration for Task Management System
# This file defines the infrastructure configuration for the production environment
# Version: 1.0.0

terraform {
  required_version = ">= 1.0.0"

  # Configure S3 backend for state management
  backend "s3" {
    bucket         = "task-management-tfstate-prod"
    key            = "prod/terraform.tfstate"
    region         = "us-west-2"
    encrypt        = true
    dynamodb_table = "terraform-lock-prod"
    kms_key_id     = "arn:aws:kms:us-west-2:ACCOUNT_ID:key/prod-terraform-key"
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
  }
}

# Local variables for production environment
locals {
  environment = "prod"
  common_tags = {
    Environment       = "Production"
    Project          = "TaskManagementSystem"
    ManagedBy        = "Terraform"
    SecurityLevel    = "High"
    ComplianceLevel  = "Production"
    BackupFrequency  = "Daily"
    DataClassification = "Confidential"
  }
}

# AWS Provider configuration for production
provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  default_tags {
    tags = local.common_tags
  }

  assume_role {
    role_arn = "arn:aws:iam::ACCOUNT_ID:role/TerraformProductionRole"
  }
}

# Networking module for production VPC and related resources
module "networking" {
  source = "../../modules/networking"

  environment             = local.environment
  vpc_cidr               = "10.0.0.0/16"
  availability_zones     = ["us-west-2a", "us-west-2b", "us-west-2c"]
  enable_nat_gateway     = true
  single_nat_gateway     = false
  enable_vpn_gateway     = true
  enable_flow_logs       = true
  flow_logs_retention_days = 90
  tags                   = local.common_tags
}

# Database module for production RDS cluster
module "database" {
  source = "../../modules/database"

  environment                  = local.environment
  instance_class              = "db.r6g.2xlarge"
  multi_az                    = true
  backup_retention_period     = 30
  deletion_protection         = true
  storage_encrypted           = true
  performance_insights_enabled = true
  monitoring_interval         = 1
  auto_minor_version_upgrade  = true
  maintenance_window          = "sun:03:00-sun:04:00"
  backup_window              = "01:00-02:00"
  tags                       = local.common_tags
}

# Kubernetes module for production EKS cluster
module "kubernetes" {
  source = "../../modules/kubernetes"

  environment               = local.environment
  cluster_version          = "1.27"
  node_instance_type       = "t3.2xlarge"
  desired_capacity         = 5
  max_size                 = 10
  min_size                 = 3
  enable_cluster_autoscaler = true
  enable_metrics_server    = true
  enable_container_insights = true
  cluster_log_types        = ["api", "audit", "authenticator", "controllerManager", "scheduler"]
  tags                     = local.common_tags
}

# Monitoring module for production observability
module "monitoring" {
  source = "../../modules/monitoring"

  environment          = local.environment
  enable_alerting      = true
  retention_period     = 90
  detailed_monitoring  = true
  enable_dashboard     = true
  alert_endpoints      = ["ops@company.com", "security@company.com"]
  enable_audit_logs    = true
  log_retention_days   = 90
  tags                 = local.common_tags
}

# Variables for production environment
variable "aws_region" {
  type        = string
  default     = "us-west-2"
  description = "AWS region for production deployment"
}

variable "aws_profile" {
  type        = string
  default     = "prod"
  description = "AWS credentials profile for production access"
}

# Outputs for production environment
output "vpc_id" {
  value       = module.networking.vpc_id
  description = "Production VPC ID"
}

output "kubernetes_cluster_endpoint" {
  value       = module.kubernetes.cluster_endpoint
  description = "Production EKS cluster endpoint"
  sensitive   = true
}

output "database_endpoint" {
  value       = module.database.cluster_endpoint
  description = "Production RDS cluster endpoint"
  sensitive   = true
}