# LoadLite — Closed-Loop AWS Load Testing Platform

[![AWS Infrastructure](https://img.shields.io/badge/AWS-Serverless%20%26%20EC2-orange?style=flat&logo=amazon-aws)](https://aws.amazon.com)
[![Terraform](https://img.shields.io/badge/IaC-Terraform%201.5+-purple?style=flat&logo=terraform)](https://www.terraform.io)
[![Node.js](https://img.shields.io/badge/Runtime-Node.js%2020.x-green?style=flat&logo=node.js)](https://nodejs.org)
[![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-blue?style=flat&logo=react)](https://vitejs.dev)
[![Region](https://img.shields.io/badge/Region-ap--south--1%20%7C%20us--east--1-red?style=flat)](https://aws.amazon.com)

> [!CAUTION]
> **CLOSED-LOOP SAFETY NOTICE**
> This platform is strictly designed and authorized for closed-loop load testing against the target application provisioned in this repository under your own AWS account. **NEVER** point this load generator at third-party infrastructure, public web endpoints, or production systems.

---

## 1. System Architecture

LoadLite is a closed-loop distributed load testing platform built natively on AWS. It orchestrates Step Functions concurrency ladders, fires parallel Lambda generator fleets against a dedicated EC2 target, and plots live saturation curves with microsecond telemetry.

![LoadLite System Architecture](architecture-diagram.jpg)

### End-to-End Execution Flow

```mermaid
sequenceDiagram
    autonumber
    actor Engineer as Engineer / Dashboard
    participant APIGW as Amazon API Gateway
    participant SFN as Step Functions Orchestrator
    participant Lambda as Distributed Lambda Fleet
    participant Target as EC2 Target (Node.js Express)
    participant DDB as DynamoDB (load_test_results)
    participant Query as Lambda Query Handler

    Engineer->>APIGW: POST /start (stages: [5, 15, 25], duration: 5s)
    APIGW->>SFN: StartExecution (run-xxxxxx)
    loop Each Concurrency Stage
        SFN->>Lambda: Invoke Workers in Parallel (N concurrency)
        par Concurrent Load Generation
            Lambda->>Target: GET /compute (CPU-bound) or /db or /health
            Target-->>Lambda: HTTP Response (latency_ms, statusCode)
            Lambda->>DDB: BatchWriteItem (25 items/batch with microsecond SK)
        end
        SFN->>SFN: Inter-stage Cooldown (2s)
    end
    loop Live Polling (Every 1.5s)
        Engineer->>APIGW: GET /results?run_id=run-xxxxxx
        APIGW->>Query: Aggregate Metrics
        Query->>DDB: Query by run_id
        Query-->>Engineer: Percentiles (p50, p90, p95, p99), Error Rate & Saturation Curve
    end
```

---

## 2. Components

### 1. Target Application (EC2)
* **Instance Type**: `t3.micro` (Amazon Linux 2023)
* **Runtime**: Node.js 20 Express API running as a resilient `systemd` daemon (`target-app.service`).
* **Endpoints**:
  * `GET /health` — Baseline trivial 200 OK.
  * `GET /compute` — CPU-bound SHA-256 iterative hash loop simulating computationally intensive application workloads.
  * `GET /db` — Writes and reads items to DynamoDB (`load_test_target_data`) via IAM instance profile credentials.
* **Monitoring**: Amazon CloudWatch Agent reporting host CPU and memory utilization.

### 2. Load Generator (AWS Lambda)
* **Function**: `load-test-generator` (Node.js 20.x, 1024 MB RAM, 300s timeout).
* Spawns worker loops maintaining $N$ concurrent in-flight connections.
* Captures high-resolution per-request latency (ms), HTTP response codes, and timestamps.
* Batch-writes items to DynamoDB in chunks of 25 with exponential backoff.

### 3. Concurrency Orchestrator (AWS Step Functions)
* **State Machine**: `load-test-orchestrator`.
* Executes progressive ramp stages (e.g. `[10, 50, 100]`) sequentially.
* Manages a unified `run_id` across all stages with cooling pauses between tiers.

### 4. Metrics & Results Store (Amazon DynamoDB)
* **Table**: `load_test_results` (Pay-per-request / On-Demand).
  * **Partition Key**: `run_id` (String)
  * **Sort Key**: `timestamp` (Number — microsecond-offset epoch preventing concurrent write collisions).
  * **Attributes**: `latency_ms`, `status_code`, `endpoint`, `concurrency_stage`, `created_at`.
* **Table**: `load_test_target_data` (Target app mock data store).

### 5. API Gateway & Interactive Dashboard (React + Vite)
* **API Gateway**: `load-test-api` backed by `load-test-query` Lambda.
  * `GET /runs` — Lists previous runs with summaries.
  * `GET /results?run_id=xxx` — Calculates p50, p90, p95, p99 percentiles, error rates, and second-by-second timelines.
  * `POST /start` — Triggers new Step Functions executions directly from the UI.
* **Editorial Dashboard**: Handcrafted light-theme interface (warm paper palette, Fraunces serif, JetBrains Mono):
  * **Live Target Pulse**: Real-time rolling SVG oscilloscope probing server health sequentially (1.5s interval) with responsive load state badges.
  * **Server Latency & Saturation Curve**: Interactive SVG chart mapping tail latencies (p95) against median (p50) up to the 10,000ms timeout ceiling.
  * **Live Test Plotting**: Polls intermediate DynamoDB batches every 1.5s so curves, request volumes, and failure rates plot live as each stage runs.

---

## 3. Directory Layout

```text
LoadLite/
├── SYSTEM_DESIGN.md        # Original design specifications & requirements
├── README.md               # Architecture documentation & operations guide
├── .gitignore              # Protects .env, state files, and credentials
├── .env.example            # Root environment variable template
├── terraform/              # Infrastructure as Code
│   ├── main.tf             # Provider setup & default tags (project = load-test-platform)
│   ├── variables.tf        # Region, instance sizing, and VPC config
│   ├── vpc.tf              # Default VPC networking
│   ├── dynamodb.tf         # load_test_results and load_test_target_data tables
│   ├── iam.tf              # Scoped least-privilege IAM roles and instance profiles
│   ├── ec2-target.tf       # Target EC2 instance, security group, and user-data
│   ├── lambda.tf           # Load generator & query Lambdas
│   ├── step-functions.tf   # Concurrency ramping state machine
│   ├── api-gateway.tf      # HTTP API Gateway with CORS
│   └── outputs.tf          # Target URLs, Table Names, and API Gateway endpoints
├── target-app/             # Express API target application code
│   ├── server.js           # /health, /compute, and /db routes
│   ├── package.json
│   └── .env.example
├── load-generator/         # Lambda load generator implementation
│   ├── index.js            # Concurrency worker & DynamoDB batch writer
│   ├── package.json
│   └── .env.example
├── lambda-query/           # API Gateway read/trigger Lambda
│   ├── index.js            # Percentile aggregator & Step Functions launcher
│   ├── package.json
│   └── .env.example
└── dashboard/              # React (Vite) frontend application
    ├── src/
    │   ├── App.jsx         # Real-time metrics, charts, & test launcher
    │   ├── index.css       # Obsidian glassmorphic styling
    │   └── main.jsx
    ├── package.json
    ├── .env                # Configured with deployed API Gateway & EC2 URLs
    └── .env.example
```

---

## 4. Quick Start & Deployment

### Prerequisites
* AWS CLI installed and configured with credentials for `load-test-platform-deploy`.
* Terraform `v1.5+`.
* Node.js `v18+`.

### Deploy Infrastructure
```bash
cd terraform
terraform init
terraform apply -auto-approve
```

### Launch the Frontend Dashboard
```bash
cd ../dashboard
npm install
npm run dev
```
Navigate to `http://localhost:5173` to access the dashboard.

---

## 5. Clean Teardown

To destroy all cloud resources and ensure zero residual costs:

```bash
cd terraform
terraform destroy -auto-approve
```
*Guaranteed to cleanly remove EC2 instances, security groups, DynamoDB tables, Lambda functions, Step Functions, and API Gateway without manual console intervention.*
