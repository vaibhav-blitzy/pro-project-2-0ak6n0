# Backend Configuration for Task Management System Infrastructure
# Version: 1.0.0
# This configuration establishes a secure and scalable remote state management system
# using AWS S3 for storage and DynamoDB for state locking.

terraform {
  # Specify minimum required Terraform version
  required_version = ">= 1.5.0"

  # Configure required providers
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # S3 backend configuration with enhanced security features
  backend "s3" {
    # State file storage configuration
    bucket = "task-management-terraform-state"
    key    = "${var.environment}/terraform.tfstate"
    region = var.aws_region

    # Security configuration
    encrypt        = true
    kms_key_id    = "aws/s3"
    acl           = "private"

    # State locking configuration
    dynamodb_table = "task-management-terraform-locks"

    # Versioning and workspace management
    versioning            = true
    workspace_key_prefix  = "workspaces"

    # Additional security settings
    force_path_style      = false
    skip_region_validation      = false
    skip_credentials_validation = false
    skip_metadata_api_check     = false
  }
}