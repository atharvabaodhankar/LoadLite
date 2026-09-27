data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }

  filter {
    name   = "state"
    values = ["available"]
  }
}

resource "aws_security_group" "target_sg" {
  name        = "load-test-target-sg"
  description = "Security group for load test target application"
  vpc_id      = var.vpc_id

  ingress {
    description = "Express App HTTP Port"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Standard HTTP Port"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "SSH Access"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "load-test-target-sg"
  }
}

resource "aws_instance" "target_app" {
  ami                         = data.aws_ami.amazon_linux_2023.id
  instance_type               = var.instance_type
  subnet_id                   = var.subnet_id
  vpc_security_group_ids      = [aws_security_group.target_sg.id]
  iam_instance_profile        = aws_iam_instance_profile.ec2_profile.name
  associate_public_ip_address = true

  tags = {
    Name = "load-test-target-app"
  }

  user_data = <<-EOF
              #!/bin/bash
              set -ex

              # Update and install Node.js 20 and Amazon CloudWatch Agent
              dnf update -y
              dnf install -y nodejs amazon-cloudwatch-agent

              # Create app directory
              mkdir -p /opt/target-app
              cd /opt/target-app

              # Write package.json
              cat <<'JSON' > /opt/target-app/package.json
              {
                "name": "load-test-target-app",
                "version": "1.0.0",
                "main": "server.js",
                "dependencies": {
                  "@aws-sdk/client-dynamodb": "^3.750.0",
                  "@aws-sdk/lib-dynamodb": "^3.750.0",
                  "dotenv": "^16.4.7",
                  "express": "^4.21.2"
                }
              }
              JSON

              # Write server.js
              cat <<'JS' > /opt/target-app/server.js
              const express = require('express');
              const crypto = require('crypto');
              const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
              const { DynamoDBDocumentClient, PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
              require('dotenv').config();

              const app = express();
              const PORT = process.env.PORT || 3000;
              const REGION = process.env.AWS_REGION || '${var.aws_region}';
              const DB_TABLE = process.env.DYNAMODB_TABLE_NAME || '${aws_dynamodb_table.load_test_target_data.name}';

              const ddbClient = new DynamoDBClient({ region: REGION });
              const docClient = DynamoDBDocumentClient.from(ddbClient);

              app.use(express.json());

              app.get('/health', (req, res) => {
                res.status(200).json({
                  status: 'ok',
                  service: 'load-test-target-app',
                  timestamp: new Date().toISOString()
                });
              });

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

              app.get('/db', async (req, res) => {
                const startTime = Date.now();
                const id = 'item-' + Math.floor(Math.random() * 100);
                try {
                  await docClient.send(new PutCommand({
                    TableName: DB_TABLE,
                    Item: {
                      id,
                      updatedAt: new Date().toISOString(),
                      payload: 'test-data-payload'
                    }
                  }));

                  const getResult = await docClient.send(new GetCommand({
                    TableName: DB_TABLE,
                    Key: { id }
                  }));

                  res.status(200).json({
                    status: 'ok',
                    operation: 'db',
                    id,
                    item: getResult.Item,
                    durationMs: Date.now() - startTime
                  });
                } catch (error) {
                  res.status(500).json({
                    status: 'error',
                    message: error.message,
                    durationMs: Date.now() - startTime
                  });
                }
              });

              app.listen(PORT, '0.0.0.0', () => {
                console.log('Target app listening on port ' + PORT);
              });
              JS

              # Write .env
              cat <<ENV > /opt/target-app/.env
              PORT=3000
              AWS_REGION=${var.aws_region}
              DYNAMODB_TABLE_NAME=${aws_dynamodb_table.load_test_target_data.name}
              ENV

              # Install dependencies
              npm install --prefix /opt/target-app

              # Configure CloudWatch Agent
              cat <<'CW' > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
              {
                "metrics": {
                  "namespace": "LoadTest/TargetApp",
                  "metrics_collected": {
                    "cpu": {
                      "measurement": ["cpu_usage_idle", "cpu_usage_user", "cpu_usage_system"],
                      "metrics_collection_interval": 10,
                      "totalcpu": true
                    },
                    "mem": {
                      "measurement": ["mem_used_percent"],
                      "metrics_collection_interval": 10
                    }
                  }
                }
              }
              CW
              /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json

              # Create systemd service
              cat <<'SERVICE' > /etc/systemd/system/target-app.service
              [Unit]
              Description=Load Test Target Express API
              After=network.target

              [Service]
              Type=simple
              User=root
              WorkingDirectory=/opt/target-app
              ExecStart=/usr/bin/node /opt/target-app/server.js
              Restart=always
              RestartSec=5
              Environment=NODE_ENV=production

              [Install]
              WantedBy=multi-user.target
              SERVICE

              # Enable and start target app service
              systemctl daemon-reload
              systemctl enable target-app.service
              systemctl start target-app.service
              EOF
}
