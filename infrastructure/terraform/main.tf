# Provider Configuration
# hashicorp/aws ~> 5.0
provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  default_tags {
    tags = local.common_tags
  }
}

# hashicorp/kubernetes ~> 2.0
provider "kubernetes" {
  host                   = module.kubernetes.cluster_endpoint
  cluster_ca_certificate = base64decode(module.kubernetes.cluster_certificate_authority_data)
  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args = [
      "eks",
      "get-token",
      "--cluster-name",
      module.kubernetes.cluster_name
    ]
  }
}

# hashicorp/helm ~> 2.0
provider "helm" {
  kubernetes {
    host                   = module.kubernetes.cluster_endpoint
    cluster_ca_certificate = base64decode(module.kubernetes.cluster_certificate_authority_data)
    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args = [
        "eks",
        "get-token",
        "--cluster-name",
        module.kubernetes.cluster_name
      ]
    }
  }
}

# Local Variables
locals {
  common_tags = {
    Project          = "TaskManagementSystem"
    Environment      = var.environment
    ManagedBy       = "Terraform"
    SecurityLevel    = "High"
    ComplianceLevel = "Enterprise"
  }
}

# Data Sources
data "aws_availability_zones" "available" {
  state = "available"
}

# Networking Module
module "networking" {
  source = "./modules/networking"

  environment         = var.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = data.aws_availability_zones.available.names
  enable_vpn_gateway = var.environment != "dev"
  enable_nat_gateway = true
  single_nat_gateway = var.environment != "prod"
  enable_flow_logs   = true
  tags               = local.common_tags
}

# Database Module
module "database" {
  source = "./modules/database"

  environment              = var.environment
  private_subnet_ids       = module.networking.private_subnets
  vpc_security_group_ids   = module.networking.database_security_group_ids
  db_instance_class       = var.db_instance_class
  db_engine_version       = var.db_engine_version
  multi_az               = var.environment == "prod"
  backup_retention_period = var.environment == "prod" ? 30 : 7
  enable_performance_insights = true
  tags                    = local.common_tags

  depends_on = [module.networking]
}

# Kubernetes Module
module "kubernetes" {
  source = "./modules/kubernetes"

  environment          = var.environment
  vpc_id              = module.networking.vpc_id
  private_subnet_ids   = module.networking.private_subnets
  kubernetes_version   = var.kubernetes_version
  node_instance_type  = var.eks_node_instance_type
  node_desired_size   = var.eks_node_desired_size
  node_max_size       = var.eks_node_max_size
  node_min_size       = var.eks_node_min_size
  enable_irsa         = true
  cluster_encryption_config = true
  tags                = local.common_tags

  depends_on = [module.networking]
}

# Monitoring Module
module "monitoring" {
  source = "./modules/monitoring"

  environment        = var.environment
  vpc_id            = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnets
  eks_cluster_name   = module.kubernetes.cluster_name
  enable_monitoring  = true
  retention_in_days  = var.environment == "prod" ? 90 : 30
  enable_alerting    = true
  alert_endpoints    = var.alert_endpoints
  tags              = local.common_tags

  depends_on = [module.kubernetes]
}

# Outputs
output "vpc_id" {
  description = "ID of the created VPC"
  value       = module.networking.vpc_id
}

output "kubernetes_cluster_endpoint" {
  description = "Endpoint of the EKS cluster"
  value       = module.kubernetes.cluster_endpoint
  sensitive   = true
}

output "database_endpoint" {
  description = "Endpoint of the RDS cluster"
  value       = module.database.db_cluster_endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "Endpoint of the Redis cache cluster"
  value       = module.database.redis_endpoint
  sensitive   = true
}

# Required Terraform Version
terraform {
  required_version = ">= 1.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"
    }
  }

  backend "s3" {
    # Backend configuration should be provided via backend config file
    # or command line arguments
  }
}