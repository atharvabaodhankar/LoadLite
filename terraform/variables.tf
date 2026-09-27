variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "ap-south-1"
}

variable "instance_type" {
  description = "EC2 instance type for the target app"
  type        = string
  default     = "t3.micro"
}

variable "vpc_id" {
  description = "VPC ID to deploy EC2 target instance in"
  type        = string
  default     = "vpc-0a50c4d555316818b"
}

variable "subnet_id" {
  description = "Subnet ID to deploy EC2 target instance in"
  type        = string
  default     = "subnet-087c95d27386f017f"
}
