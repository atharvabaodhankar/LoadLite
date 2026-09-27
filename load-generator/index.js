const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || 'us-east-1';
const RESULTS_TABLE = process.env.RESULTS_TABLE || 'load_test_results';

const ddbClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(ddbClient);

// Batch write items to DynamoDB in chunks of 25 (DynamoDB limit)
async function flushBatch(items) {
  if (!items || items.length === 0) return;

  const chunks = [];
  for (let i = 0; i < items.length; i += 25) {
    chunks.push(items.slice(i, i + 25));
  }

  for (const chunk of chunks) {
    const putRequests = chunk.map(item => ({
      PutRequest: { Item: item }
    }));

    let requestParams = {
      RequestItems: {
        [RESULTS_TABLE]: putRequests
      }
    };

    let attempts = 0;
    while (attempts < 3) {
      try {
        const response = await docClient.send(new BatchWriteCommand(requestParams));
        const unprocessed = response.UnprocessedItems && response.UnprocessedItems[RESULTS_TABLE];
        if (!unprocessed || unprocessed.length === 0) {
          break;
        }
        // Exponential backoff for unprocessed items
        attempts++;
        await new Promise(res => setTimeout(res, 50 * Math.pow(2, attempts)));
        requestParams.RequestItems[RESULTS_TABLE] = unprocessed;
      } catch (err) {
        console.error('DynamoDB BatchWrite error:', err.message);
        break;
      }
    }
  }
}

exports.handler = async (event) => {
  console.log('Received event:', JSON.stringify(event));

  const targetUrl = event.target_url || process.env.TARGET_APP_URL;
  if (!targetUrl) {
    throw new Error('Missing target_url in event or TARGET_APP_URL environment variable');
  }

  const concurrency = parseInt(event.concurrency, 10) || 10;
  const durationSeconds = parseInt(event.duration_seconds, 10) || 10;
  const runId = event.run_id || `run-${Date.now()}`;
  const concurrencyStage = event.concurrency_stage || concurrency;

  const urlObj = new URL(targetUrl);
  const endpoint = urlObj.pathname + urlObj.search;

  const endTime = Date.now() + (durationSeconds * 1000);
  const resultsBuffer = [];
  const latencies = [];
  let successCount = 0;
  let errorCount = 0;
  let seqCounter = 0;

  // Worker loop
  async function worker(workerId) {
    while (Date.now() < endTime) {
      const startTime = Date.now();
      let statusCode = 0;
      let error = null;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(targetUrl, {
          signal: controller.signal,
          headers: { 'User-Agent': 'LoadLite-Generator/1.0' }
        });
        clearTimeout(timeoutId);
        statusCode = res.status;

        // Consume body stream
        await res.text();
      } catch (err) {
        error = err.message;
        statusCode = err.name === 'AbortError' ? 504 : 0;
      }

      const latencyMs = Date.now() - startTime;
      latencies.push(latencyMs);

      if (statusCode >= 200 && statusCode < 400) {
        successCount++;
      } else {
        errorCount++;
      }

      seqCounter++;
      // High-precision unique sort key: timestamp in ms * 1000 + sequence to stay safely within Number.MAX_SAFE_INTEGER
      const itemTimestamp = (startTime * 1000) + (seqCounter % 1000);

      resultsBuffer.push({
        run_id: runId,
        timestamp: itemTimestamp,
        created_at: new Date(startTime).toISOString(),
        latency_ms: latencyMs,
        status_code: statusCode,
        endpoint,
        concurrency_stage: concurrencyStage,
        error: error || undefined
      });

      // Flush in batches periodically during the test
      if (resultsBuffer.length >= 100) {
        const batchToFlush = resultsBuffer.splice(0, 100);
        await flushBatch(batchToFlush);
      }
    }
  }

  // Launch concurrent workers
  const workers = [];
  for (let i = 0; i < concurrency; i++) {
    workers.push(worker(i));
  }

  await Promise.all(workers);

  // Flush any remaining results
  if (resultsBuffer.length > 0) {
    await flushBatch(resultsBuffer);
  }

  // Calculate statistics
  latencies.sort((a, b) => a - b);
  const totalRequests = latencies.length;
  const p50 = totalRequests > 0 ? latencies[Math.floor(totalRequests * 0.50)] : 0;
  const p95 = totalRequests > 0 ? latencies[Math.floor(totalRequests * 0.95)] : 0;
  const p99 = totalRequests > 0 ? latencies[Math.floor(totalRequests * 0.99)] : 0;
  const avgLatency = totalRequests > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / totalRequests) : 0;
  const actualRps = durationSeconds > 0 ? Number((totalRequests / durationSeconds).toFixed(2)) : 0;

  const summary = {
    run_id: runId,
    concurrency_stage: concurrencyStage,
    concurrency,
    duration_seconds: durationSeconds,
    target_url: targetUrl,
    total_requests: totalRequests,
    success_count: successCount,
    error_count: errorCount,
    error_rate: totalRequests > 0 ? Number(((errorCount / totalRequests) * 100).toFixed(2)) : 0,
    requests_per_sec: actualRps,
    avg_latency_ms: avgLatency,
    p50_latency_ms: p50,
    p95_latency_ms: p95,
    p99_latency_ms: p99
  };

  console.log('Run Stage Complete:', JSON.stringify(summary));
  return summary;
};
