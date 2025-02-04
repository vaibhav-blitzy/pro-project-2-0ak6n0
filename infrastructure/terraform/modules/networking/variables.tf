# Terraform version constraint
terraform {
  required_version = "~> 1.0"
}

# VPC CIDR block variable
variable "vpc_cidr" {
  type        = string
  description = "CIDR block for the VPC network space"
  default     = "10.0.0.0/16"
}

# Environment variable with validation
variable "environment" {
  type        = string
  description = "Deployment environment identifier (dev, staging, prod, dr)"
  validation {
    condition     = can(regex("^(dev|staging|prod|dr)$", var.environment))
    error_message = "Environment must be one of: dev, staging, prod, dr"
  }
}

# Availability zones variable with validation
variable "availability_zones" {
  type        = list(string)
  description = "List of AWS availability zones for multi-AZ deployment"
  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "At least 2 availability zones required for high availability"
  }
}

# Private subnet CIDR blocks
variable "private_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks for private subnets hosting application workloads"
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

# Public subnet CIDR blocks
variable "public_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks for public subnets hosting load balancers and bastion hosts"
  default     = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
}

# Database subnet CIDR blocks
variable "database_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks for isolated database subnets"
  default     = ["10.0.201.0/24", "10.0.202.0/24", "10.0.203.0/24"]
}

# NAT Gateway enablement flag
variable "enable_nat_gateway" {
  type        = bool
  description = "Flag to enable NAT Gateway for private subnet internet access"
  default     = true
}

# Single NAT Gateway flag for cost optimization
variable "single_nat_gateway" {
  type        = bool
  description = "Use single NAT Gateway instead of one per AZ for cost optimization in non-prod environments"
  default     = false
}

# VPN Gateway enablement flag
variable "enable_vpn_gateway" {
  type        = bool
  description = "Flag to enable VPN Gateway for secure remote access"
  default     = false
}

# Resource tags
variable "tags" {
  type        = map(string)
  description = "Additional resource tags for all networking components"
  default     = {}
}