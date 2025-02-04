# Terraform configuration for comprehensive monitoring stack
# Version requirements for providers
terraform {
  required_providers {
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5.0"
    }
  }
}

# Prometheus deployment with enhanced security and retention configuration
resource "helm_release" "prometheus" {
  name             = "prometheus"
  repository       = "https://prometheus-community.github.io/helm-charts"
  chart            = "prometheus"
  namespace        = var.monitoring_namespace
  create_namespace = true
  version          = "15.10.0"

  values = [
    yamlencode({
      server = {
        retention           = var.prometheus_retention_period
        global = {
          scrape_interval = var.prometheus_scrape_interval
        }
        persistentVolume = {
          enabled      = var.enable_persistent_storage
          storageClass = var.storage_class_name
          size         = var.metrics_retention_size
        }
        securityContext = {
          enabled             = true
          runAsUser          = 65534
          runAsNonRoot       = true
          fsGroup            = 65534
        }
      }
      networkPolicy = {
        enabled = true
      }
      alertmanager = {
        enabled = true
        persistentVolume = {
          enabled      = var.enable_persistent_storage
          storageClass = var.storage_class_name
        }
      }
      serviceMonitors = {
        enabled = true
      }
    })
  ]
}

# Elasticsearch deployment with SIEM integration and security features
resource "helm_release" "elasticsearch" {
  name             = "elasticsearch"
  repository       = "https://helm.elastic.co"
  chart            = "elasticsearch"
  namespace        = var.monitoring_namespace
  version          = "7.17.3"

  values = [
    yamlencode({
      cluster = {
        name = "${var.cluster_name}-es"
      }
      persistence = {
        enabled      = var.enable_persistent_storage
        storageClass = var.storage_class_name
      }
      security = {
        enabled = true
        elasticPassword = random_password.elastic_password.result
        encryptionAtRest = {
          enabled = true
        }
        audit = {
          enabled = true
          logLevel = "INFO"
        }
      }
      xpack = {
        security = {
          enabled = true
          transport = {
            ssl = {
              enabled = true
            }
          }
        }
        monitoring = {
          enabled = true
        }
      }
      nodeRoles = ["master", "data", "ingest"]
      clusterHealthCheckParams = "wait_for_status=yellow&timeout=180s"
      retention = {
        days = var.elasticsearch_retention_days
      }
    })
  ]
}

# Jaeger deployment with Elasticsearch storage and sampling configuration
resource "helm_release" "jaeger" {
  name             = "jaeger"
  repository       = "https://jaegertracing.github.io/helm-charts"
  chart            = "jaeger"
  namespace        = var.monitoring_namespace
  version          = "0.71.0"

  values = [
    yamlencode({
      sampling = {
        type = "probabilistic"
        param = var.jaeger_sampling_rate
      }
      storage = {
        type = "elasticsearch"
        elasticsearch = {
          host = "${helm_release.elasticsearch.name}-master"
          port = 9200
          scheme = "https"
          user = "elastic"
          password = random_password.elastic_password.result
        }
      }
      securityContext = {
        enabled = true
        runAsUser = 1000
        fsGroup = 1000
      }
      networkPolicy = {
        enabled = true
      }
      agent = {
        strategy = "probabilistic"
      }
    })
  ]

  depends_on = [helm_release.elasticsearch]
}

# Generate secure random password for Elasticsearch
resource "random_password" "elastic_password" {
  length  = 32
  special = true
}

# Export monitoring endpoints for service discovery
output "monitoring_endpoints" {
  value = {
    prometheus_endpoint    = "http://${helm_release.prometheus.name}-server.${var.monitoring_namespace}:9090"
    elasticsearch_endpoint = "https://${helm_release.elasticsearch.name}-master.${var.monitoring_namespace}:9200"
    jaeger_query_endpoint = "http://${helm_release.jaeger.name}-query.${var.monitoring_namespace}:16686"
  }
  description = "Endpoints for monitoring services"
  sensitive   = true
}