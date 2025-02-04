#!/bin/bash

# Enterprise-grade monitoring setup script for Task Management System
# Version: 1.0.0
# Description: Automated deployment and configuration of Prometheus, Grafana, and Elasticsearch
# with high availability, security, and comprehensive monitoring capabilities

set -euo pipefail

# Import configurations
source <(kubectl create configmap prometheus-config --from-file=infrastructure/monitoring/prometheus/prometheus.yml -o json | jq -r '.data["prometheus.yml"]')
source <(kubectl create configmap grafana-dashboards --from-file=infrastructure/monitoring/grafana/dashboards/system-metrics.json -o json | jq -r '.data["system-metrics.json"]')
source <(kubectl create configmap elasticsearch-config --from-file=infrastructure/monitoring/elasticsearch/elasticsearch.yml -o json | jq -r '.data["elasticsearch.yml"]')

# Global variables
MONITORING_NAMESPACE="monitoring"
GRAFANA_VERSION="9.5.0"
PROMETHEUS_VERSION="2.45.0"
ELASTICSEARCH_VERSION="8.0.0"
TLS_CERT_PATH="/etc/monitoring/certs"
HA_REPLICAS=3
RETENTION_DAYS=90

# Function to setup Prometheus with high availability and security
setup_prometheus() {
    local namespace=$1
    local cert_path=$2
    local replicas=$3

    echo "Setting up Prometheus (v${PROMETHEUS_VERSION}) with HA configuration..."

    # Create namespace with RBAC policies
    kubectl create namespace "$namespace" --dry-run=client -o yaml | kubectl apply -f -
    
    # Setup TLS certificates
    kubectl create secret tls prometheus-tls \
        --cert="$cert_path/prometheus.crt" \
        --key="$cert_path/prometheus.key" \
        --namespace="$namespace"

    # Apply network policies
    cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: prometheus-network-policy
  namespace: $namespace
spec:
  podSelector:
    matchLabels:
      app: prometheus
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: grafana
    ports:
    - protocol: TCP
      port: 9090
EOF

    # Deploy Prometheus using Helm
    helm upgrade --install prometheus prometheus-community/prometheus \
        --namespace "$namespace" \
        --version "$PROMETHEUS_VERSION" \
        --set server.replicaCount="$replicas" \
        --set server.retention="${RETENTION_DAYS}d" \
        --set server.securityContext.runAsUser=65534 \
        --set server.securityContext.fsGroup=65534 \
        --values infrastructure/monitoring/prometheus/prometheus.yml

    echo "Prometheus setup completed successfully"
}

# Function to setup Grafana with comprehensive dashboards
setup_grafana() {
    local namespace=$1
    local cert_path=$2
    local replicas=$3

    echo "Setting up Grafana (v${GRAFANA_VERSION}) with HA configuration..."

    # Create TLS secrets
    kubectl create secret tls grafana-tls \
        --cert="$cert_path/grafana.crt" \
        --key="$cert_path/grafana.key" \
        --namespace="$namespace"

    # Deploy Grafana using Helm
    helm upgrade --install grafana grafana/grafana \
        --namespace "$namespace" \
        --version "$GRAFANA_VERSION" \
        --set replicas="$replicas" \
        --set persistence.enabled=true \
        --set persistence.size=10Gi \
        --set datasources."datasources\.yaml".apiVersion=1 \
        --set datasources."datasources\.yaml".datasources[0].name=Prometheus \
        --set datasources."datasources\.yaml".datasources[0].type=prometheus \
        --set datasources."datasources\.yaml".datasources[0].url=http://prometheus-server:9090

    # Import dashboards
    kubectl create configmap grafana-dashboards \
        --from-file=infrastructure/monitoring/grafana/dashboards/ \
        --namespace="$namespace"

    echo "Grafana setup completed successfully"
}

# Function to setup Elasticsearch with security features
setup_elasticsearch() {
    local namespace=$1
    local cert_path=$2
    local replicas=$3

    echo "Setting up Elasticsearch (v${ELASTICSEARCH_VERSION}) cluster..."

    # Create TLS secrets
    kubectl create secret generic elasticsearch-certs \
        --from-file="$cert_path/elastic-certificates.p12" \
        --namespace="$namespace"

    # Deploy Elasticsearch using Helm
    helm upgrade --install elasticsearch elastic/elasticsearch \
        --namespace "$namespace" \
        --version "$ELASTICSEARCH_VERSION" \
        --set replicas="$replicas" \
        --set minimumMasterNodes="$(($replicas/2 + 1))" \
        --set xpack.security.enabled=true \
        --set xpack.security.transport.ssl.enabled=true \
        --values infrastructure/monitoring/elasticsearch/elasticsearch.yml

    echo "Elasticsearch setup completed successfully"
}

# Function to verify monitoring stack health
verify_monitoring() {
    local namespace=$1
    
    echo "Verifying monitoring stack health..."

    # Check Prometheus health
    if ! kubectl get pods -n "$namespace" -l app=prometheus -o jsonpath='{.items[*].status.containerStatuses[0].ready}' | grep -q true; then
        echo "Error: Prometheus pods not ready"
        return 1
    fi

    # Check Grafana health
    if ! kubectl get pods -n "$namespace" -l app=grafana -o jsonpath='{.items[*].status.containerStatuses[0].ready}' | grep -q true; then
        echo "Error: Grafana pods not ready"
        return 1
    fi

    # Check Elasticsearch health
    if ! kubectl get pods -n "$namespace" -l app=elasticsearch -o jsonpath='{.items[*].status.containerStatuses[0].ready}' | grep -q true; then
        echo "Error: Elasticsearch pods not ready"
        return 1
    fi

    echo "All monitoring components are healthy"
    return 0
}

# Main execution
main() {
    echo "Starting monitoring stack setup..."

    # Create monitoring namespace
    kubectl create namespace "$MONITORING_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

    # Setup components
    setup_prometheus "$MONITORING_NAMESPACE" "$TLS_CERT_PATH" "$HA_REPLICAS"
    setup_grafana "$MONITORING_NAMESPACE" "$TLS_CERT_PATH" "$HA_REPLICAS"
    setup_elasticsearch "$MONITORING_NAMESPACE" "$TLS_CERT_PATH" "$HA_REPLICAS"

    # Verify setup
    verify_monitoring "$MONITORING_NAMESPACE"

    echo "Monitoring stack setup completed successfully"
}

# Execute main function
main "$@"