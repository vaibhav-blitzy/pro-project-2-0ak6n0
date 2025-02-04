# AWS Provider configuration
# Provider version: ~> 4.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# Database subnet group for Aurora PostgreSQL cluster
resource "aws_db_subnet_group" "task-management-db-subnet-group" {
  name        = "${var.environment}-task-management-db-subnet-group"
  subnet_ids  = var.private_subnet_ids
  
  tags = {
    Environment = var.environment
    Project     = "task-management"
    ManagedBy   = "terraform"
  }
}

# Aurora PostgreSQL cluster configuration
resource "aws_rds_cluster" "task-management-db-cluster" {
  cluster_identifier           = "${var.environment}-task-management-db"
  engine                      = "aurora-postgresql"
  engine_version              = "14.6"
  availability_zones          = var.availability_zones
  database_name               = "taskmanagement"
  master_username             = var.db_master_username
  master_password             = var.db_master_password
  
  # Backup configuration
  backup_retention_period     = 7
  preferred_backup_window     = "03:00-04:00"
  preferred_maintenance_window = "sun:04:00-sun:05:00"
  
  # Network and security
  db_subnet_group_name       = aws_db_subnet_group.task-management-db-subnet-group.name
  vpc_security_group_ids     = var.vpc_security_group_ids
  storage_encrypted          = true
  kms_key_id                = var.kms_key_arn
  
  # Protection and monitoring
  deletion_protection        = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.environment}-task-management-db-final"
  enabled_cloudwatch_logs_exports = ["postgresql"]
  
  tags = {
    Environment = var.environment
    Project     = "task-management"
    ManagedBy   = "terraform"
  }
}

# Aurora PostgreSQL cluster instances
resource "aws_rds_cluster_instance" "task-management-db-instances" {
  count                           = var.db_instance_count
  identifier                      = "${var.environment}-task-management-db-${count.index}"
  cluster_identifier             = aws_rds_cluster.task-management-db-cluster.id
  instance_class                 = var.db_instance_class
  engine                         = "aurora-postgresql"
  
  # Performance and monitoring
  auto_minor_version_upgrade     = true
  performance_insights_enabled   = true
  performance_insights_retention_period = 7
  monitoring_interval            = 60
  monitoring_role_arn           = var.monitoring_role_arn
  
  tags = {
    Environment = var.environment
    Project     = "task-management"
    ManagedBy   = "terraform"
  }
}

# Redis cache subnet group
resource "aws_elasticache_subnet_group" "task-management-cache-subnet-group" {
  name        = "${var.environment}-task-management-cache-subnet-group"
  subnet_ids  = var.private_subnet_ids
  
  tags = {
    Environment = var.environment
    Project     = "task-management"
    ManagedBy   = "terraform"
  }
}

# Redis cache cluster configuration
resource "aws_elasticache_replication_group" "task-management-cache" {
  replication_group_id          = "${var.environment}-task-management-cache"
  description                   = "Redis cache cluster for task management system"
  node_type                     = var.cache_node_type
  num_cache_clusters           = var.cache_cluster_count
  port                         = 6379
  parameter_group_family       = "redis7"
  engine_version               = "7.0"
  
  # High availability configuration
  automatic_failover_enabled   = true
  multi_az_enabled            = true
  
  # Network and security
  subnet_group_name           = aws_elasticache_subnet_group.task-management-cache-subnet-group.name
  security_group_ids          = var.vpc_security_group_ids
  at_rest_encryption_enabled  = true
  transit_encryption_enabled  = true
  auth_token                  = var.redis_auth_token
  
  # Maintenance and backup
  maintenance_window          = "sun:05:00-sun:06:00"
  snapshot_retention_limit    = 7
  snapshot_window            = "04:00-05:00"
  
  tags = {
    Environment = var.environment
    Project     = "task-management"
    ManagedBy   = "terraform"
  }
}