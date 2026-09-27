resource "aws_sfn_state_machine" "orchestrator" {
  name     = "load-test-orchestrator"
  role_arn = aws_iam_role.step_functions_role.arn

  definition = jsonencode({
    Comment = "LoadLite Concurrency Ramping Orchestrator"
    StartAt = "PrepareRun"
    States = {
      PrepareRun = {
        Type = "Pass"
        Next = "RunStages"
      }
      RunStages = {
        Type           = "Map"
        ItemsPath      = "$.stages"
        MaxConcurrency = 1
        Parameters = {
          "run_id.$"                 = "$.run_id"
          "target_url.$"             = "$.target_url"
          "stage_duration_seconds.$" = "$.stage_duration_seconds"
          "stage.$"                  = "$$.Map.Item.Value"
        }
        Iterator = {
          StartAt = "ExecuteStage"
          States = {
            ExecuteStage = {
              Type     = "Task"
              Resource = "arn:aws:states:::lambda:invoke"
              Parameters = {
                FunctionName = aws_lambda_function.load_generator.arn
                Payload = {
                  "run_id.$"            = "$.run_id"
                  "target_url.$"        = "$.target_url"
                  "duration_seconds.$"  = "$.stage_duration_seconds"
                  "concurrency.$"       = "$.stage"
                  "concurrency_stage.$" = "$.stage"
                }
              }
              ResultSelector = {
                "stage_summary.$" = "$.Payload"
              }
              ResultPath = "$.stage_result"
              Next       = "StageCooldown"
            }
            StageCooldown = {
              Type    = "Wait"
              Seconds = 2
              Next    = "FinishStage"
            }
            FinishStage = {
              Type       = "Pass"
              OutputPath = "$.stage_result.stage_summary"
              End        = true
            }
          }
        }
        ResultPath = "$.stages_output"
        Next       = "TestCompleted"
      }
      TestCompleted = {
        Type = "Pass"
        Parameters = {
          "status"             = "COMPLETED"
          "run_id.$"           = "$.run_id"
          "target_url.$"       = "$.target_url"
          "stages_completed.$" = "$.stages_output"
        }
        End = true
      }
    }
  })

  tags = {
    Name = "load-test-orchestrator"
  }
}
