# Aurora PostgreSQL cluster outputs
output "db_cluster_endpoint" {
  description = "Primary write endpoint for the Aurora PostgreSQL cluster supporting write operations and primary database access"
  value       = aws_rds_cluster.task-management-db-cluster.endpoint
}

output "db_reader_endpoint" {
  description = "Load-balanced reader endpoint for the Aurora PostgreSQL cluster optimized for read-heavy operations"
  value       = aws_rds_cluster.task-management-db-cluster.reader_endpoint
}

output "db_cluster_identifier" {
  description = "Unique identifier for the Aurora PostgreSQL cluster used for monitoring and management"
  value       = aws_rds_cluster.task-management-db-cluster.cluster_identifier
}

# Redis cache cluster outputs
output "cache_primary_endpoint" {
  description = "Primary Redis endpoint for write operations supporting the cache-aside pattern"
  value       = aws_elasticache_replication_group.task-management-cache.primary_endpoint_address
}

output "cache_reader_endpoint" {
  description = "Redis read replica endpoint for distributed read operations and improved cache performance"
  value       = aws_elasticache_replication_group.task-management-cache.reader_endpoint_address
}

output "cache_cluster_identifier" {
  description = "Unique identifier for the Redis cache cluster enabling monitoring integration"
  value       = aws_elasticache_replication_group.task-management-cache.replication_group_id
}