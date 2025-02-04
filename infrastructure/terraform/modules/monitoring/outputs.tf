# Output definitions for monitoring stack endpoints and configuration
# Exposes secure access to monitoring services while protecting sensitive data

output "prometheus_endpoint" {
  description = "Outputs the Prometheus server endpoint URL for metrics collection and service discovery"
  value       = "${helm_release.prometheus.status[0].load_balancer_ingress[0].hostname}"
  sensitive   = false
}

output "grafana_endpoint" {
  description = "Outputs the Grafana dashboard endpoint URL for visualization and analytics access"
  value       = "${helm_release.grafana.status[0].load_balancer_ingress[0].hostname}"
  sensitive   = false
}

output "elasticsearch_endpoint" {
  description = "Outputs the Elasticsearch cluster endpoint URL for centralized logging and search capabilities"
  value       = "${helm_release.elasticsearch.status[0].load_balancer_ingress[0].hostname}"
  sensitive   = false
}

output "jaeger_endpoint" {
  description = "Outputs the Jaeger query service endpoint URL for distributed tracing visualization"
  value       = "${helm_release.jaeger.status[0].load_balancer_ingress[0].hostname}"
  sensitive   = false
}

output "monitoring_namespace" {
  description = "Outputs the Kubernetes namespace where the monitoring stack is deployed for resource management"
  value       = var.monitoring_namespace
  sensitive   = false
}

output "grafana_admin_password" {
  description = "Outputs the Grafana admin password for secure dashboard access and user management"
  value       = var.grafana_admin_password
  sensitive   = true
}

output "monitoring_stack_endpoints" {
  description = "Consolidated monitoring stack endpoints for service integration"
  value = {
    prometheus = {
      endpoint = "${helm_release.prometheus.status[0].load_balancer_ingress[0].hostname}"
      port     = 9090
      protocol = "http"
    }
    elasticsearch = {
      endpoint = "${helm_release.elasticsearch.status[0].load_balancer_ingress[0].hostname}"
      port     = 9200
      protocol = "https"
    }
    jaeger = {
      endpoint = "${helm_release.jaeger.status[0].load_balancer_ingress[0].hostname}"
      port     = 16686
      protocol = "http"
    }
  }
  sensitive = true
}

output "monitoring_stack_status" {
  description = "Status of monitoring stack components"
  value = {
    prometheus    = helm_release.prometheus.status[0].status
    elasticsearch = helm_release.elasticsearch.status[0].status
    jaeger        = helm_release.jaeger.status[0].status
  }
  sensitive = false
}