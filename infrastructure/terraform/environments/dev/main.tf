# Required Terraform Version and Backend Configuration
terraform {
  required_version = ">= 1.0.0"
  
  backend "s3" {
    bucket         = "task-management-terraform-state-dev"
    key            = "dev/terraform.tfstate"
    region         = "us-west-2"
    encrypt        = true
    dynamodb_table = "terraform-state-lock-dev"
  }
}

# AWS Provider Configuration
provider "aws" {
  region  = "us-west-2"
  profile = "dev"
  
  default_tags {
    tags = {
      Environment   = "Development"
      Project      = "TaskManagementSystem"
      ManagedBy    = "Terraform"
      CostCenter   = "Development"
      SecurityLevel = "Development"
    }
  }
}

# Local Variables
locals {
  environment = "dev"
  common_tags = {
    Environment   = "Development"
    Project      = "TaskManagementSystem"
    ManagedBy    = "Terraform"
    CostCenter   = "Development"
    SecurityLevel = "Development"
  }
}

# Root Module Implementation
module "task_management_system" {
  source = "../.."

  # Environment Configuration
  environment = local.environment
  
  # Network Configuration
  vpc_cidr = "10.0.0.0/16"
  
  # Database Configuration - Development Optimized
  db_instance_class        = "db.t3.medium"
  db_engine_version        = "14.7"
  db_backup_retention_period = 7
  db_deletion_protection    = false
  
  # Kubernetes Configuration - Development Sized
  kubernetes_version      = "1.27"
  eks_node_instance_type = "t3.medium"
  eks_node_desired_size  = 2
  eks_node_max_size      = 4
  eks_node_min_size      = 2
  
  # Monitoring Configuration - Development Appropriate
  enable_monitoring         = true
  monitoring_retention_days = 30
  alert_notification_threshold = "high"
  
  # Development-specific Access Configuration
  enable_dev_access = true
  dev_security_group_rules = {
    allow_vpn_access        = true
    allow_local_development = true
  }
  
  # Common Resource Tags
  tags = local.common_tags
}

# Output Definitions
output "vpc_id" {
  description = "ID of the development VPC"
  value       = module.task_management_system.vpc_id
}

output "kubernetes_cluster_endpoint" {
  description = "Endpoint of the development EKS cluster"
  value       = module.task_management_system.kubernetes_cluster_endpoint
}

output "database_endpoint" {
  description = "Endpoint of the development RDS cluster"
  value       = module.task_management_system.database_endpoint
}

output "monitoring_dashboard_url" {
  description = "URL of the development monitoring dashboard"
  value       = module.task_management_system.monitoring_dashboard_url
}