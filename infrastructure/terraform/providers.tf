# Terraform and Provider Versions Configuration
# Terraform version >= 1.5.0 required for enhanced provider configuration and stability
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    # AWS Provider for infrastructure deployment
    # Version ~> 5.0 includes enhanced security features and multi-region support
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }

    # Kubernetes Provider for EKS cluster management
    # Version ~> 2.23 includes improved authentication and resource management
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }

    # Helm Provider for application deployment
    # Version ~> 2.11 includes enhanced chart deployment capabilities
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
  }
}

# AWS Provider Configuration
# Configures AWS provider with region, profile, and default resource tags
provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  default_tags {
    tags = {
      Environment = var.environment
      Project     = "TaskManagementSystem"
      ManagedBy   = "Terraform"
    }
  }
}

# Kubernetes Provider Configuration
# Configures Kubernetes provider with EKS cluster authentication
provider "kubernetes" {
  host                   = data.aws_eks_cluster.cluster.endpoint
  cluster_ca_certificate = base64decode(data.aws_eks_cluster.cluster.certificate_authority[0].data)
  token                  = data.aws_eks_cluster_auth.cluster.token
}

# Helm Provider Configuration
# Configures Helm provider with EKS cluster authentication for chart deployment
provider "helm" {
  kubernetes {
    host                   = data.aws_eks_cluster.cluster.endpoint
    cluster_ca_certificate = base64decode(data.aws_eks_cluster.cluster.certificate_authority[0].data)
    token                  = data.aws_eks_cluster_auth.cluster.token
  }
}