# Output definitions for the Kubernetes (EKS) module
# These outputs expose essential cluster information needed by other modules and root configuration

output "cluster_endpoint" {
  description = "EKS cluster endpoint URL"
  value       = aws_eks_cluster.main.endpoint
}

output "cluster_name" {
  description = "Name of the EKS cluster"
  value       = aws_eks_cluster.main.name
}

output "cluster_security_group_id" {
  description = "Security group ID attached to the EKS cluster"
  value       = aws_security_group.eks_cluster_sg.id
}

output "cluster_certificate_authority_data" {
  description = "Base64 encoded certificate data required for cluster authentication"
  value       = aws_eks_cluster.main.certificate_authority[0].data
  sensitive   = true
}

output "cluster_oidc_issuer_url" {
  description = "OpenID Connect issuer URL for IAM role federation"
  value       = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

output "node_security_group_id" {
  description = "Security group ID attached to the EKS node groups"
  value       = aws_eks_node_group.main.resources[0].remote_access_security_group_id
}