const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { SFNClient, StartExecutionCommand, DescribeExecutionCommand } = require('@aws-sdk/client-sfn');

const REGION = process.env.AWS_REGION || 'us-east-1';
const RESULTS_TABLE = process.env.RESULTS_TABLE || 'load_test_results';
const STATE_MACHINE_ARN = process.env.STATE_MACHINE_ARN || '';
const TARGET_APP_BASE_URL = process.env.TARGET_APP_BASE_URL || '';

const ddbClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(ddbClient);
const sfnClient = new SFNClient({ region: REGION });

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  const method = event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method) || 'GET';
  const path = event.path || (event.requestContext && event.requestContext.http && event.requestContext.http.path) || '/';

  if (method === 'OPTIONS') {
    return response(200, { message: 'OK' });
  }

  try {
    // 1. Health
    if (path.endsWith('/health')) {
      return response(200, { status: 'ok', service: 'load-test-query-api' });
    }

    // 2. GET /runs - List recent runs
    if (path.endsWith('/runs') && method === 'GET') {
      const scanResult = await docClient.send(new ScanCommand({
        TableName: RESULTS_TABLE,
        ProjectionExpression: 'run_id, #ts, created_at, concurrency_stage, endpoint, latency_ms, status_code',
        ExpressionAttributeNames: { '#ts': 'timestamp' },
        Limit: 1000
      }));

      const runMap = {};
      for (const item of (scanResult.Items || [])) {
        if (!runMap[item.run_id]) {
          runMap[item.run_id] = {
            run_id: item.run_id,
            first_seen: item.created_at || new Date(Math.floor(item.timestamp / 1000)).toISOString(),
            last_seen: item.created_at || new Date(Math.floor(item.timestamp / 1000)).toISOString(),
            endpoint: item.endpoint,
            stages: new Set(),
            request_count: 0
          };
        }
        runMap[item.run_id].request_count++;
        if (item.concurrency_stage) {
          runMap[item.run_id].stages.add(item.concurrency_stage);
        }
      }

      const runs = Object.values(runMap).map(r => ({
        run_id: r.run_id,
        created_at: r.first_seen,
        endpoint: r.endpoint,
        request_count: r.request_count,
        stages: Array.from(r.stages).sort((a, b) => a - b)
      })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return response(200, { runs: runs.slice(0, 20) });
    }

    // 3. GET /results?run_id=xxx - Get aggregate results for a run
    if (path.endsWith('/results') && method === 'GET') {
      const queryParams = event.queryStringParameters || {};
      const runId = queryParams.run_id;

      if (!runId) {
        return response(400, { error: 'Missing run_id query parameter' });
      }

      let allItems = [];
      let lastEvaluatedKey = undefined;

      do {
        const queryCommand = new QueryCommand({
          TableName: RESULTS_TABLE,
          KeyConditionExpression: 'run_id = :rid',
          ExpressionAttributeValues: {
            ':rid': runId
          },
          ExclusiveStartKey: lastEvaluatedKey
        });

        const queryResult = await docClient.send(queryCommand);
        if (queryResult.Items) {
          allItems = allItems.concat(queryResult.Items);
        }
        lastEvaluatedKey = queryResult.LastEvaluatedKey;
      } while (lastEvaluatedKey);

      if (allItems.length === 0) {
        return response(404, { error: `No results found for run_id: ${runId}` });
      }

      // Aggregate statistics
      const latencies = allItems.map(item => item.latency_ms).sort((a, b) => a - b);
      const totalRequests = latencies.length;
      let successCount = 0;
      let errorCount = 0;

      const stageGroups = {};
      const timeBins = {};

      for (const item of allItems) {
        const isSuccess = item.status_code >= 200 && item.status_code < 400;
        if (isSuccess) successCount++;
        else errorCount++;

        // Stage breakdown
        const stage = item.concurrency_stage || 1;
        if (!stageGroups[stage]) {
          stageGroups[stage] = { stage, count: 0, latencies: [], errors: 0 };
        }
        stageGroups[stage].count++;
        stageGroups[stage].latencies.push(item.latency_ms);
        if (!isSuccess) stageGroups[stage].errors++;

        // Second-by-second timeline binning
        const approxEpochMs = Math.floor(item.timestamp / 1000);
        const secondBucket = Math.floor(approxEpochMs / 1000);
        if (!timeBins[secondBucket]) {
          timeBins[secondBucket] = { second: secondBucket, requests: 0, latencies: [], errors: 0 };
        }
        timeBins[secondBucket].requests++;
        timeBins[secondBucket].latencies.push(item.latency_ms);
        if (!isSuccess) timeBins[secondBucket].errors++;
      }

      const p50 = latencies[Math.floor(totalRequests * 0.50)] || 0;
      const p90 = latencies[Math.floor(totalRequests * 0.90)] || 0;
      const p95 = latencies[Math.floor(totalRequests * 0.95)] || 0;
      const p99 = latencies[Math.floor(totalRequests * 0.99)] || 0;
      const avgLatency = Math.round(latencies.reduce((a, b) => a + b, 0) / totalRequests);

      // Format stages
      const stagesSummary = Object.values(stageGroups).map(s => {
        s.latencies.sort((a, b) => a - b);
        const count = s.count;
        return {
          concurrency_stage: s.stage,
          total_requests: count,
          error_count: s.errors,
          error_rate: Number(((s.errors / count) * 100).toFixed(2)),
          avg_latency_ms: Math.round(s.latencies.reduce((a, b) => a + b, 0) / count),
          p50_latency_ms: s.latencies[Math.floor(count * 0.50)] || 0,
          p95_latency_ms: s.latencies[Math.floor(count * 0.95)] || 0,
          p99_latency_ms: s.latencies[Math.floor(count * 0.99)] || 0
        };
      }).sort((a, b) => a.concurrency_stage - b.concurrency_stage);

      // Format timeline
      const timeline = Object.values(timeBins).map(b => ({
        time: new Date(b.second * 1000).toLocaleTimeString(),
        timestamp_sec: b.second,
        requests_per_sec: b.requests,
        avg_latency_ms: Math.round(b.latencies.reduce((a, b) => a + b, 0) / b.requests),
        error_count: b.errors
      })).sort((a, b) => a.timestamp_sec - b.timestamp_sec);

      return response(200, {
        run_id: runId,
        endpoint: allItems[0].endpoint,
        total_requests: totalRequests,
        success_count: successCount,
        error_count: errorCount,
        error_rate: Number(((errorCount / totalRequests) * 100).toFixed(2)),
        avg_latency_ms: avgLatency,
        p50_latency_ms: p50,
        p90_latency_ms: p90,
        p95_latency_ms: p95,
        p99_latency_ms: p99,
        stages: stagesSummary,
        timeline
      });
    }

    // 4. POST /start - Trigger Step Functions orchestrator
    if (path.endsWith('/start') && method === 'POST') {
      let body = {};
      try {
        body = JSON.parse(event.body || '{}');
      } catch (e) {
        return response(400, { error: 'Invalid JSON body' });
      }

      const endpoint = body.endpoint || '/compute';
      const targetUrl = body.target_url || `${TARGET_APP_BASE_URL}${endpoint}`;
      const stages = Array.isArray(body.stages) && body.stages.length > 0 ? body.stages : [10, 50, 100];
      const stageDurationSeconds = parseInt(body.stage_duration_seconds, 10) || 10;
      const runId = body.run_id || `run-${Date.now()}`;

      const input = {
        run_id: runId,
        target_url: targetUrl,
        stage_duration_seconds: stageDurationSeconds,
        stages
      };

      const startCmd = new StartExecutionCommand({
        stateMachineArn: STATE_MACHINE_ARN,
        name: `${runId}-${Date.now().toString().slice(-4)}`,
        input: JSON.stringify(input)
      });

      const sfnRes = await sfnClient.send(startCmd);
      return response(200, {
        message: 'Load test orchestrator started',
        run_id: runId,
        execution_arn: sfnRes.executionArn,
        startDate: sfnRes.startDate,
        config: input
      });
    }

    // 5. GET /status?execution_arn=xxx - Check Step Functions execution status
    if (path.endsWith('/status') && method === 'GET') {
      const queryParams = event.queryStringParameters || {};
      const executionArn = queryParams.execution_arn;
      if (!executionArn) {
        return response(400, { error: 'Missing execution_arn query parameter' });
      }

      const describeRes = await sfnClient.send(new DescribeExecutionCommand({
        executionArn
      }));

      return response(200, {
        execution_arn: describeRes.executionArn,
        status: describeRes.status,
        startDate: describeRes.startDate,
        stopDate: describeRes.stopDate,
        output: describeRes.output ? JSON.parse(describeRes.output) : null
      });
    }

    return response(404, { error: `Not found: ${method} ${path}` });
  } catch (error) {
    console.error('Handler error:', error);
    return response(500, { error: error.message });
  }
};
