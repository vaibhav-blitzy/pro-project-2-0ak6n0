# VPC Output
output "vpc_id" {
  value       = aws_vpc.main.id
  description = "ID of the created VPC for network isolation"
  sensitive   = false
}

# Subnet Outputs
output "private_subnet_ids" {
  value       = aws_subnet.private_subnets[*].id
  description = "List of private subnet IDs for application tier resources"
  sensitive   = false
}

output "public_subnet_ids" {
  value       = aws_subnet.public_subnets[*].id
  description = "List of public subnet IDs for internet-facing resources"
  sensitive   = false
}

output "database_subnet_ids" {
  value       = aws_subnet.database_subnets[*].id
  description = "List of database subnet IDs for data tier resources"
  sensitive   = false
}

# Security Group Outputs
output "default_security_group_id" {
  value       = aws_security_group.vpc_endpoints.id
  description = "ID of the default VPC security group for network access control"
  sensitive   = false
}

# NAT Gateway Outputs
output "nat_gateway_ips" {
  value       = aws_eip.nat[*].public_ip
  description = "List of Elastic IPs associated with NAT gateways for internet access"
  sensitive   = false
}

# Additional Network Component Outputs
output "vpc_cidr_block" {
  value       = aws_vpc.main.cidr_block
  description = "CIDR block range of the VPC for network planning"
  sensitive   = false
}

output "availability_zones" {
  value       = data.aws_availability_zones.available.names
  description = "List of availability zones where network resources are deployed"
  sensitive   = false
}

output "network_acl_ids" {
  value = {
    public   = aws_network_acl.main[0].id
    private  = aws_network_acl.main[1].id
    database = aws_network_acl.main[2].id
  }
  description = "Map of network ACL IDs for each subnet tier"
  sensitive   = false
}

output "vpc_endpoint_security_group_id" {
  value       = aws_security_group.vpc_endpoints.id
  description = "Security group ID for VPC endpoints"
  sensitive   = false
}

output "internet_gateway_id" {
  value       = aws_internet_gateway.main.id
  description = "ID of the Internet Gateway attached to the VPC"
  sensitive   = false
}

output "nat_gateway_ids" {
  value       = aws_nat_gateway.main[*].id
  description = "List of NAT Gateway IDs for private subnet internet access"
  sensitive   = false
}

output "vpc_flow_log_group" {
  value       = aws_cloudwatch_log_group.vpc_flow_logs.name
  description = "Name of the CloudWatch Log Group for VPC Flow Logs"
  sensitive   = false
}

output "vpc_endpoints" {
  value = {
    for endpoint in aws_vpc_endpoint.endpoints : split(".", endpoint.service_name)[2] => {
      id            = endpoint.id
      dns_entry     = endpoint.dns_entry
      service_name  = endpoint.service_name
    }
  }
  description = "Map of VPC Endpoint details for enabled AWS services"
  sensitive   = false
}