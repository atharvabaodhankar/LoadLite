output "target_app_public_ip" {
  description = "Public IP address of the target EC2 instance"
  value       = aws_instance.target_app.public_ip
}

output "target_app_url" {
  description = "Base URL of the target Express application"
  value       = "http://${aws_instance.target_app.public_ip}:3000"
}

output "dynamodb_results_table" {
  description = "Name of the DynamoDB results table"
  value       = aws_dynamodb_table.load_test_results.name
}

output "dynamodb_target_data_table" {
  description = "Name of the DynamoDB target mock data table"
  value       = aws_dynamodb_table.load_test_target_data.name
}

output "load_generator_lambda_name" {
  description = "Name of the Lambda load generator function"
  value       = aws_lambda_function.load_generator.function_name
}

output "step_functions_orchestrator_arn" {
  description = "ARN of the Step Functions load test orchestrator state machine"
  value       = aws_sfn_state_machine.orchestrator.arn
}

output "api_gateway_endpoint" {
  description = "Base endpoint URL for the dashboard metrics API Gateway"
  value       = aws_apigatewayv2_stage.default_stage.invoke_url
}
