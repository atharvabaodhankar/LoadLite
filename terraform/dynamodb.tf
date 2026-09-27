resource "aws_dynamodb_table" "load_test_results" {
  name         = "load_test_results"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "run_id"
  range_key    = "timestamp"

  attribute {
    name = "run_id"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "N"
  }

  tags = {
    Name = "load-test-results"
  }
}

resource "aws_dynamodb_table" "load_test_target_data" {
  name         = "load_test_target_data"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  tags = {
    Name = "load-test-target-data"
  }
}
