variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "instance_type" {
  description = "EC2 instance type for the target app"
  type        = string
  default     = "t3.micro"
}

variable "vpc_id" {
  description = "VPC ID to deploy EC2 target instance in"
  type        = string
  default     = "vpc-030c2c8c80e830fd1"
}

variable "subnet_id" {
  description = "Subnet ID to deploy EC2 target instance in"
  type        = string
  default     = "subnet-073fce45cc7b6d77d"
}
