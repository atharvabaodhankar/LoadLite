# System design — self-hosted load testing platform on AWS

## Purpose
A closed-loop load testing platform: we own and control both the load generator and the target application. This is **not** to be pointed at any third-party or production infrastructure — only at the target app defined in this repo, deployed under our own AWS account.

## Architecture

```
Step Functions (orchestrator, ramps concurrency)
        |
        v
Lambda (load generator, fires N concurrent requests)
        |
        v
EC2 target app (Express API — /health, /compute, /db)
        |
        v
DynamoDB (per-request latency + status code)
        |
        v
React dashboard (p50/p95/p99, error rate, requests/sec)
```

## Components to build

### 1. Target app (EC2)
- Simple Express (Node.js) API, deployed on a single EC2 instance (t3.micro/small is enough — this is the thing being tested, not the tester)
- Endpoints:
  - `GET /health` — trivial 200 OK
  - `GET /compute` — CPU-bound busy-loop to simulate real work
  - `GET /db` — reads/writes a DynamoDB item to simulate a data-layer hit
- Install CloudWatch agent for CPU/memory metrics
- Runs as a systemd service so it survives reboots

### 2. Load generator (Lambda)
- Node.js or Python Lambda
- Input: target URL, concurrency, duration
- Fires concurrent HTTP requests at the target for the given duration
- Records per-request latency + status code
- Writes results to DynamoDB in batches (not one write per request — batch every N requests to avoid throttling)

### 3. Orchestrator (Step Functions)
- Ramps concurrency over stages (e.g. 10 → 100 → 500 → 1000), each stage invoking the Lambda with updated params
- Waits between stages, aggregates a run_id so all stages of one test are grouped

### 4. Results store (DynamoDB)
- Table: `load_test_results`
- Partition key: `run_id`, sort key: `timestamp`
- Attributes: `latency_ms`, `status_code`, `endpoint`, `concurrency_stage`

### 5. Dashboard (React)
- Reads from DynamoDB via a small API Gateway + Lambda read endpoint (do not expose DynamoDB directly to the frontend)
- Shows: requests/sec over time, p50/p95/p99 latency, error rate, current concurrency stage
- One page, no auth needed for v1 (private repo / not publicly hosted)

## Infra as code
- **Terraform**, not CloudFormation (see reasoning: portability, plan-before-apply, cleaner destroy for repeated spin-up/teardown)
- Structure:
```
terraform/
  main.tf           # provider config, backend
  vpc.tf            # networking (or reuse default VPC for v1 — don't over-engineer)
  ec2-target.tf     # target Express app instance + security group
  lambda.tf         # load generator function + IAM role
  dynamodb.tf       # results table
  step-functions.tf # orchestrator state machine
  api-gateway.tf    # read endpoint for dashboard
  iam.tf            # roles/policies (least privilege — see IAM section below)
  outputs.tf        # EC2 public IP, table name, API endpoint
```
- Every resource must be tagged `project = load-tester` for cost tracking
- `terraform destroy` must cleanly tear down everything — no orphaned resources, no manual console cleanup ever required

## Environment variables — strict rule
**No credentials, IDs, or endpoints hardcoded anywhere in source, ever.**
- Every component (Lambda, EC2 app, React dashboard) reads config from `.env` (or Lambda environment variables in the Terraform resource, not committed to source)
- A `.env.example` file must exist in every component's directory listing every required variable with a placeholder value, e.g.:
  ```
  AWS_REGION=
  DYNAMODB_TABLE_NAME=
  TARGET_APP_URL=
  API_GATEWAY_ENDPOINT=
  ```
- `.env` must be in `.gitignore` at the repo root — never committed
- AWS access keys are provided out-of-band (pasted directly by Atharva into the local `.env` / AWS CLI config) — **never** requested in chat, never written into any file that gets committed, never logged

## IAM setup (to be created manually by Atharva before Antigravity starts)

Create a dedicated IAM user for this project only — do not reuse an existing admin or personal key.

**User name:** `load-test-platform-deploy`

**Access type:** Programmatic access only (access key + secret key for Terraform/CLI use) — no console password needed

**Permissions — attach a custom policy, not broad managed policies like `AdministratorAccess`.** Scope to only what this project touches:
- `ec2:*` restricted to resources tagged `project=load-tester` (RunInstances, TerminateInstances, DescribeInstances, security group management)
- `dynamodb:*` restricted to tables named `load_test_*`
- `lambda:*` restricted to functions named `load-test-*`
- `states:*` (Step Functions) restricted to state machines named `load-test-*`
- `apigateway:*` for the dashboard read endpoint
- `iam:PassRole` (needed so Terraform can attach execution roles to Lambda/EC2) — scope to roles named `load-test-*`
- `iam:CreateRole`, `iam:AttachRolePolicy`, `iam:PutRolePolicy` scoped to role names `load-test-*` (Terraform needs to create the Lambda/EC2 execution roles itself)
- `cloudwatch:*` and `logs:*` for metrics/log groups (can leave less restricted, these are low-risk)
- `s3:*` restricted to a bucket named `load-test-tfstate-*` if using S3 as the Terraform backend

Use IAM Condition keys (`aws:ResourceTag/project`: `load-test-platform`) wherever the service supports resource-level tagging conditions, so a bug in Terraform config can't accidentally touch unrelated AWS resources in the account.

**Do not** grant this user permissions to IAM user/group management, billing, or any other project's resources.

## Build order for Antigravity
1. Terraform: DynamoDB table + EC2 target app + security group (get the target app reachable first)
2. Target Express app code, deployed to EC2, verified reachable via `/health`
3. Load generator Lambda, manually invoked once against the target, confirm DynamoDB writes appear
4. Step Functions orchestrator wrapping the Lambda with ramping stages
5. API Gateway read endpoint + React dashboard
6. README with architecture diagram, `.env.example` files everywhere, and a clear "only test resources in this repo" notice at the top