# Provider configuration for AWS DR region
# Provider version: ~> 5.0
provider "aws" {
  region = var.aws_region
  alias  = "dr"
}

# Local variables for DR environment
locals {
  dr_tags = {
    Environment = "dr"
    Project     = "TaskManagementSystem"
    ManagedBy   = "Terraform"
    Purpose     = "Disaster Recovery"
    RPO        = "1 hour"
    RTO        = "4 hours"
  }
}

# Data source for available AZs in DR region
data "aws_availability_zones" "available" {
  state    = "available"
  provider = aws.dr
}

# Networking module for DR VPC and associated resources
module "networking" {
  source = "../../modules/networking"

  environment         = "dr"
  vpc_cidr           = "10.1.0.0/16"
  availability_zones = data.aws_availability_zones.available.names
  enable_nat_gateway = true
  single_nat_gateway = false # Multiple NAT gateways for high availability
  
  # Subnet CIDR blocks for DR environment
  private_subnet_cidrs   = ["10.1.1.0/24", "10.1.2.0/24", "10.1.3.0/24"]
  public_subnet_cidrs    = ["10.1.101.0/24", "10.1.102.0/24", "10.1.103.0/24"]
  database_subnet_cidrs  = ["10.1.201.0/24", "10.1.202.0/24", "10.1.203.0/24"]
  
  tags = local.dr_tags
}

# Database module for DR database infrastructure
module "database" {
  source = "../../modules/database"

  environment            = "dr"
  private_subnet_ids     = module.networking.private_subnet_ids
  vpc_security_group_ids = module.networking.database_security_group_ids
  availability_zones     = data.aws_availability_zones.available.names
  
  # Database configuration for DR
  db_instance_class        = "db.r6g.large"
  db_instance_count        = 3
  db_engine_version        = "14.6"
  enable_replica           = true
  source_region           = "us-east-1" # Primary region
  backup_retention_period = 30
  enable_encryption       = true
  multi_az               = true
  
  # Cache configuration for DR
  cache_node_type         = "cache.r6g.large"
  cache_cluster_count     = 3
  
  tags = local.dr_tags
}

# Kubernetes module for DR EKS cluster
module "kubernetes" {
  source = "../../modules/kubernetes"

  environment        = "dr"
  vpc_id            = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids
  
  # EKS configuration for DR
  kubernetes_version      = "1.27"
  node_instance_type     = "t3.large"
  node_desired_size      = 3
  node_max_size          = 5
  node_min_size          = 2
  enable_cluster_autoscaler = true
  
  tags = local.dr_tags
}

# Monitoring module for DR environment
module "monitoring" {
  source = "../../modules/monitoring"

  environment        = "dr"
  vpc_id            = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids
  eks_cluster_name   = module.kubernetes.cluster_name
  
  # Monitoring configuration for DR
  enable_monitoring           = true
  alert_threshold_cpu        = 70
  alert_threshold_memory     = 80
  enable_cross_region_monitoring = true
  
  tags = local.dr_tags
}

# Outputs for DR environment
output "dr_vpc_id" {
  value       = module.networking.vpc_id
  description = "ID of the DR VPC"
}

output "dr_kubernetes_cluster_endpoint" {
  value       = module.kubernetes.cluster_endpoint
  description = "Endpoint of the DR EKS cluster"
  sensitive   = true
}

output "dr_database_endpoint" {
  value       = module.database.db_cluster_endpoint
  description = "Endpoint of the DR RDS cluster"
  sensitive   = true
}

output "dr_redis_endpoint" {
  value       = module.database.redis_endpoint
  description = "Endpoint of the DR Redis cluster"
  sensitive   = true
}