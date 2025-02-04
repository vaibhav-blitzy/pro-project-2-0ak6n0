# AWS Provider configuration
# Provider version: ~> 5.0
provider "aws" {
  region = var.aws_region
}

# Local variables for common configurations
locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
    LastUpdated = timestamp()
  }

  # Subnet tier configurations
  tier_names = ["public", "private", "database"]
  
  # VPC Endpoint services for enhanced security
  vpc_endpoint_services = [
    "com.amazonaws.${data.aws_region.current.name}.s3",
    "com.amazonaws.${data.aws_region.current.name}.ecr.api",
    "com.amazonaws.${data.aws_region.current.name}.ecr.dkr",
    "com.amazonaws.${data.aws_region.current.name}.logs",
    "com.amazonaws.${data.aws_region.current.name}.secretsmanager"
  ]
}

# VPC Creation
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  tags = merge(local.common_tags, {
    Name = format("%s-vpc", var.environment)
  })
}

# Public Subnets
resource "aws_subnet" "public_subnets" {
  count             = length(data.aws_availability_zones.available.names)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.public_subnet_cidrs[count.index]
  availability_zone = data.aws_availability_zones.available.names[count.index]
  
  map_public_ip_on_launch = true

  tags = merge(local.common_tags, {
    Name = format("%s-public-subnet-%s", var.environment, data.aws_availability_zones.available.names[count.index])
    Tier = "Public"
  })
}

# Private Subnets
resource "aws_subnet" "private_subnets" {
  count             = length(data.aws_availability_zones.available.names)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = merge(local.common_tags, {
    Name = format("%s-private-subnet-%s", var.environment, data.aws_availability_zones.available.names[count.index])
    Tier = "Private"
  })
}

# Database Subnets
resource "aws_subnet" "database_subnets" {
  count             = length(data.aws_availability_zones.available.names)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.database_subnet_cidrs[count.index]
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = merge(local.common_tags, {
    Name = format("%s-database-subnet-%s", var.environment, data.aws_availability_zones.available.names[count.index])
    Tier = "Database"
  })
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = merge(local.common_tags, {
    Name = format("%s-igw", var.environment)
  })
}

# NAT Gateways
resource "aws_eip" "nat" {
  count = var.enable_nat_gateway ? (var.single_nat_gateway ? 1 : length(data.aws_availability_zones.available.names)) : 0
  domain = "vpc"

  tags = merge(local.common_tags, {
    Name = format("%s-nat-eip-%s", var.environment, count.index + 1)
  })
}

resource "aws_nat_gateway" "main" {
  count         = var.enable_nat_gateway ? (var.single_nat_gateway ? 1 : length(data.aws_availability_zones.available.names)) : 0
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public_subnets[count.index].id

  tags = merge(local.common_tags, {
    Name = format("%s-nat-%s", var.environment, count.index + 1)
  })

  depends_on = [aws_internet_gateway.main]
}

# VPC Flow Logs
resource "aws_flow_log" "main" {
  vpc_id                = aws_vpc.main.id
  traffic_type         = "ALL"
  log_destination_type = "cloud-watch-logs"
  log_destination      = aws_cloudwatch_log_group.vpc_flow_logs.arn
  iam_role_arn         = aws_iam_role.vpc_flow_log_role.arn

  tags = merge(local.common_tags, {
    Name = format("%s-flow-logs", var.environment)
  })
}

# Network ACLs
resource "aws_network_acl" "main" {
  count      = 3
  vpc_id     = aws_vpc.main.id
  subnet_ids = count.index == 0 ? aws_subnet.public_subnets[*].id : (
               count.index == 1 ? aws_subnet.private_subnets[*].id :
               aws_subnet.database_subnets[*].id)

  tags = merge(local.common_tags, {
    Name = format("%s-%s-nacl", var.environment, local.tier_names[count.index])
  })
}

# VPC Endpoints
resource "aws_vpc_endpoint" "endpoints" {
  for_each = toset(local.vpc_endpoint_services)

  vpc_id              = aws_vpc.main.id
  service_name        = each.value
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private_subnets[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = merge(local.common_tags, {
    Name = format("%s-%s-endpoint", var.environment, split(".", each.value)[2])
  })
}

# VPC Endpoint Security Group
resource "aws_security_group" "vpc_endpoints" {
  name_prefix = format("%s-vpc-endpoints-", var.environment)
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  tags = merge(local.common_tags, {
    Name = format("%s-vpc-endpoints-sg", var.environment)
  })
}

# Outputs
output "vpc_id" {
  value       = aws_vpc.main.id
  description = "ID of the created VPC"
}

output "vpc_cidr_block" {
  value       = aws_vpc.main.cidr_block
  description = "CIDR block of the created VPC"
}

output "private_subnet_ids" {
  value       = aws_subnet.private_subnets[*].id
  description = "IDs of private subnets for application tier"
}

output "vpc_endpoint_ids" {
  value = {
    for endpoint in aws_vpc_endpoint.endpoints :
    split(".", endpoint.service_name)[2] => endpoint.id
  }
  description = "IDs of created VPC endpoints"
}

output "nat_gateway_ips" {
  value       = aws_eip.nat[*].public_ip
  description = "Elastic IP addresses of NAT gateways"
}