# Output variables exposing critical monitoring and observability endpoints
# from the Task Management System's infrastructure

output "prometheus_endpoint" {
  description = "Endpoint URL for Prometheus monitoring service"
  value       = module.monitoring.prometheus_endpoint
}

output "grafana_endpoint" {
  description = "Endpoint URL for Grafana dashboard"
  value       = module.monitoring.grafana_endpoint
}

output "elasticsearch_endpoint" {
  description = "Endpoint URL for Elasticsearch service"
  value       = module.monitoring.elasticsearch_endpoint
}

output "jaeger_endpoint" {
  description = "Endpoint URL for Jaeger tracing UI"
  value       = module.monitoring.jaeger_endpoint
}