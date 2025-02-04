# Terraform Configuration Block
terraform {
  required_version = ">= 1.0.0"
  
  backend "s3" {
    bucket         = "task-management-terraform-state"
    key            = "staging/terraform.tfstate"
    region         = "us-west-2"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}

# AWS Provider Configuration
# hashicorp/aws ~> 5.0
provider "aws" {
  region  = "us-west-2"
  profile = "staging"
  
  default_tags {
    tags = {
      Environment = "staging"
      Project     = "TaskManagementSystem"
      ManagedBy   = "Terraform"
    }
  }
}

# Local Variables
locals {
  environment = "staging"
  vpc_cidr    = "10.1.0.0/16"
  common_tags = {
    Project     = "TaskManagementSystem"
    Environment = "staging"
    ManagedBy   = "Terraform"
  }
}

# Networking Module
module "networking" {
  source = "../../modules/networking"

  environment        = local.environment
  vpc_cidr          = local.vpc_cidr
  availability_zones = ["us-west-2a", "us-west-2b", "us-west-2c"]
  enable_nat_gateway = true
  single_nat_gateway = false # High availability for staging
  tags              = local.common_tags
}

# Database Module
module "database" {
  source = "../../modules/database"

  environment             = local.environment
  instance_class         = "db.r6g.xlarge"
  engine_version         = "14.7"
  multi_az              = true # High availability for staging
  backup_retention_period = 7  # 7 days retention for staging
  tags                   = local.common_tags
}

# Kubernetes Module
module "kubernetes" {
  source = "../../modules/kubernetes"

  environment         = local.environment
  cluster_version     = "1.27"
  node_instance_type = "t3.xlarge"
  node_desired_size  = 3
  node_max_size      = 5
  node_min_size      = 2
  tags               = local.common_tags
}

# Monitoring Module
module "monitoring" {
  source = "../../modules/monitoring"

  environment      = local.environment
  enable_monitoring = true
  retention_period = 30 # 30 days retention for staging
  alert_endpoints  = ["ops-staging@taskmanager.com"]
  tags            = local.common_tags
}

# Outputs
output "vpc_id" {
  description = "ID of the staging VPC"
  value       = module.networking.vpc_id
}

output "kubernetes_cluster_endpoint" {
  description = "Endpoint of the staging EKS cluster"
  value       = module.kubernetes.cluster_endpoint
}

output "database_endpoint" {
  description = "Endpoint of the staging RDS cluster"
  value       = module.database.db_cluster_endpoint
}

output "monitoring_dashboard_url" {
  description = "URL of the staging monitoring dashboard"
  value       = module.monitoring.dashboard_url
}