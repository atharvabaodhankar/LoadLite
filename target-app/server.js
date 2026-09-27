const express = require('express');
const crypto = require('crypto');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const REGION = process.env.AWS_REGION || 'us-east-1';
const DB_TABLE = process.env.DYNAMODB_TABLE_NAME || 'load_test_target_data';

const ddbClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(ddbClient);

app.use(express.json());

// 1. Health endpoint - trivial 200 OK
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'load-test-target-app',
    timestamp: new Date().toISOString()
  });
});

// 2. Compute endpoint - CPU-bound busy-loop to simulate real work
app.get('/compute', (req, res) => {
  const iterations = parseInt(req.query.iterations, 10) || 40000;
  const startTime = Date.now();

  let hash = 'seed';
  for (let i = 0; i < iterations; i++) {
    hash = crypto.createHash('sha256').update(hash + i).digest('hex');
  }

  const durationMs = Date.now() - startTime;
  res.status(200).json({
    status: 'ok',
    operation: 'compute',
    iterations,
    durationMs,
    sampleHash: hash.substring(0, 16)
  });
});

// 3. DB endpoint - reads/writes a DynamoDB item to simulate data layer hit
app.get('/db', async (req, res) => {
  const startTime = Date.now();
  const id = `item-${Math.floor(Math.random() * 100)}`;

  try {
    // Write an item
    await docClient.send(new PutCommand({
      TableName: DB_TABLE,
      Item: {
        id,
        updatedAt: new Date().toISOString(),
        payload: 'test-data-payload'
      }
    }));

    // Read the item back
    const getResult = await docClient.send(new GetCommand({
      TableName: DB_TABLE,
      Key: { id }
    }));

    const durationMs = Date.now() - startTime;
    res.status(200).json({
      status: 'ok',
      operation: 'db',
      id,
      item: getResult.Item,
      durationMs
    });
  } catch (error) {
    console.error('DynamoDB Error:', error.message);
    res.status(500).json({
      status: 'error',
      message: error.message,
      durationMs: Date.now() - startTime
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Target Express app listening on port ${PORT}`);
});
