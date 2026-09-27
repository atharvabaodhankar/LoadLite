# 1. Package Lambda Load Generator
data "archive_file" "load_generator" {
  type        = "zip"
  source_file = "${path.module}/../load-generator/index.js"
  output_path = "${path.module}/load_generator.zip"
}

resource "aws_lambda_function" "load_generator" {
  function_name    = "load-test-generator"
  role             = aws_iam_role.lambda_role.arn
  runtime          = "nodejs20.x"
  handler          = "index.handler"
  filename         = data.archive_file.load_generator.output_path
  source_code_hash = data.archive_file.load_generator.output_base64sha256
  memory_size      = 1024
  timeout          = 300

  environment {
    variables = {
      RESULTS_TABLE   = aws_dynamodb_table.load_test_results.name
      TARGET_APP_URL  = "http://${aws_instance.target_app.public_ip}:3000/compute"
    }
  }

  tags = {
    Name = "load-test-generator"
  }
}

# 2. Package Lambda Query Handler
data "archive_file" "query_handler" {
  type        = "zip"
  source_file = "${path.module}/../lambda-query/index.js"
  output_path = "${path.module}/query_handler.zip"
}

resource "aws_lambda_function" "query_handler" {
  function_name    = "load-test-query"
  role             = aws_iam_role.lambda_role.arn
  runtime          = "nodejs20.x"
  handler          = "index.handler"
  filename         = data.archive_file.query_handler.output_path
  source_code_hash = data.archive_file.query_handler.output_base64sha256
  memory_size      = 512
  timeout          = 30

  environment {
    variables = {
      RESULTS_TABLE       = aws_dynamodb_table.load_test_results.name
      STATE_MACHINE_ARN   = aws_sfn_state_machine.orchestrator.arn
      TARGET_APP_BASE_URL = "http://${aws_instance.target_app.public_ip}:3000"
    }
  }

  tags = {
    Name = "load-test-query"
  }
}
