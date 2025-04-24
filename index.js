// Initialize Elastic APM with dynamic configuration from environment variables
const apm = require('elastic-apm-node').start({
    // Service name - can be overridden with environment variable
    serviceName: process.env.APM_SERVICE_NAME || 'nodejs-testbench',
    secretToken: process.env.APM_SECRET_TOKEN || 'okok',
    serverUrl: process.env.APM_SERVER_URL || 'http://127.0.0.1:8200',
    captureBody: process.env.APM_CAPTURE_BODY || 'all',
    environment: process.env.NODE_ENV || 'development',
    logLevel: process.env.APM_LOG_LEVEL || 'info'
});

// Import dependencies
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');

// Initialize express application
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// SQLite in-memory database setup
const db = new sqlite3.Database(':memory:');
db.serialize(() => {
    db.run("CREATE TABLE test (id INTEGER PRIMARY KEY, data TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
    console.log('In-memory SQLite database initialized');
});

// Delay response simulation
app.get('/delay', (req, res) => {
    const delay = parseInt(req.query.delay) || 1000;
    const startTime = Date.now();
    
    setTimeout(() => {
        const actualDelay = Date.now() - startTime;
        res.json({ 
            message: `Response delayed by ${delay}ms`,
            requestedDelay: delay,
            actualDelay,
            timestamp: new Date().toISOString()
        });
    }, delay);
});

// Error simulation
app.get('/error', (req, res) => {
    try {
        const type = req.query.type;
        if (type === 'fatal') {
                throw new Error('Fatal error occurred');
        } else if (type === 'handled') {
            return res.status(400).json({ error: 'Handled error', message: 'This is a handled error' });
        }
        res.json({ message: 'No error triggered' });
    } catch (err) {
        res.status(500).json({ error: 'Unhandled error', message: err.message });
    }
});

// CRUD simulation based on operation string
app.post('/crud', async (req, res) => {
    const { operation = '' } = req.body;
    const operationUpper = operation.toUpperCase();
    const randomData = `Data_${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = new Date().toISOString();
    const results = { operations: [], timestamp };
    
    try {
        // Create operation
        if (operationUpper.includes('C')) {
            await new Promise((resolve, reject) => {
                db.run("INSERT INTO test (data) VALUES (?)", [randomData], function(err) {
                    if (err) reject(err);
                    results.operations.push({
                        type: 'create',
                        success: true,
                        lastId: this.lastID
                    });
                    resolve();
                });
            });
        }

        // Read operation
        if (operationUpper.includes('R')) {
            const rows = await new Promise((resolve, reject) => {
                db.all("SELECT * FROM test", [], (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                });
            });
            
            results.operations.push({
                type: 'read',
                success: true,
                count: rows.length
            });
            results.data = rows;
        }

        // Update operation
        if (operationUpper.includes('U')) {
            await new Promise((resolve, reject) => {
                db.run("UPDATE test SET data = ? WHERE id = (SELECT id FROM test ORDER BY RANDOM() LIMIT 1)", [randomData], function(err) {
                    if (err) reject(err);
                    results.operations.push({
                        type: 'update',
                        success: true,
                        affectedRows: this.changes
                    });
                    resolve();
                });
            });
        }

        // Delete operation
        if (operationUpper.includes('D')) {
            await new Promise((resolve, reject) => {
                db.run("DELETE FROM test WHERE id = (SELECT id FROM test ORDER BY RANDOM() LIMIT 1)", function(err) {
                    if (err) reject(err);
                    results.operations.push({
                        type: 'delete',
                        success: true,
                        affectedRows: this.changes
                    });
                    resolve();
                });
            });
        }

        // Add summary info
        results.message = `Operations executed: ${operation}`;
        results.randomData = randomData;
        
        res.json(results);
    } catch (err) {
        res.status(500).json({ 
            error: err.message, 
            operation: operation,
            timestamp
        });
    }
});

// Status code simulation
app.get('/status', (req, res) => {
    const code = parseInt(req.query.code) || 200;
    const timestamp = new Date().toISOString();
    
    // Handle different status code ranges
    if (code >= 200 && code < 300) {
        return res.status(code).json({ 
            status: code, 
            message: `Successful response with code ${code}`,
            timestamp
        });
    } else if (code >= 300 && code < 400) {
        return res.status(code).json({ 
            status: code, 
            message: `Redirection with code ${code}`,
            timestamp
        });
    } else if (code >= 400 && code < 500) {
        return res.status(code).json({ 
            status: code, 
            error: `Client error ${code}`, 
            message: `Simulated client error code ${code}`,
            timestamp
        });
    } else {
        return res.status(code).json({ 
            status: code, 
            error: `Server error ${code}`, 
            message: `Simulated server error code ${code}`,
            timestamp
        });
    }
});

// Instance chaining simulation
// In a Docker environment, these will be service names instead of localhost
// The instance URLs will be dynamically determined at deploy time
const instanceBaseUrl = process.env.INSTANCE_BASE_URL || 'http://localhost';
const instancePort = process.env.INSTANCE_PORT || '3000';
const instanceName = process.env.INSTANCE_NAME || 'instance';
const instanceId = parseInt(process.env.INSTANCE_ID || '0');

// Format: http://instance-1:3000 or http://localhost:3000 for local testing
const getInstanceUrl = (id) => `${instanceBaseUrl}${id === 0 ? '' : `-${id}`}:${instancePort}`;

// Cascading chaining simulation
// When a request comes to /chain?seq=3214, each instance will call the next one in the sequence
// E.g., instance-3 will call instance-2, which will call instance-1, which will call instance-4
app.get('/chain', async (req, res) => {
    const fullSequence = req.query.seq ? req.query.seq.split('').map(i => parseInt(i)) : [1, 2, 3, 4];
    const timestamp = Date.now();
    const traceId = req.query.traceId || `trace-${timestamp}-${Math.random().toString(36).substring(2, 15)}`;
    
    console.log(`[Instance ${instanceId}] Received chain request with sequence: ${fullSequence.join('')}, traceId: ${traceId}`);
    
    // Get the remaining sequence after this instance
    const currentIndex = fullSequence.findIndex(id => id === instanceId);
    const remainingSequence = currentIndex >= 0 ? fullSequence.slice(currentIndex + 1) : [];
    
    // This service's response data
    const responseData = {
        instance: instanceId,
        timestamp: Date.now(),
        traceId,
        message: `Instance ${instanceId} processing request`,
        sequence: fullSequence.join(''),
        chainPosition: currentIndex,
        remainingChain: remainingSequence,
        processingTime: Math.floor(Math.random() * 100),
        childResponses: []
    };
    
    // If this is the last instance in the sequence, just return dummy data
    if (remainingSequence.length === 0) {
        console.log(`[Instance ${instanceId}] End of chain reached`);
        responseData.message = `Instance ${instanceId} is the final node in the chain`;
        responseData.finalResult = {
            status: "completed",
            data: `Processed data from chain ${fullSequence.join('')}`,
            randomValue: Math.random()
        };
        return res.json(responseData);
    }
    
    // Otherwise, call the next service in the chain
    const nextInstanceId = remainingSequence[0];
    const nextInstanceUrl = getInstanceUrl(nextInstanceId);
    
    try {
        console.log(`[Instance ${instanceId}] Calling next instance: ${nextInstanceUrl}`);
        const nextServiceUrl = `${nextInstanceUrl}/chain?seq=${fullSequence.join('')}&traceId=${traceId}`;
        
        const resp = await axios.get(nextServiceUrl, { timeout: 10000 });
        responseData.childResponses.push(resp.data);
        responseData.totalChainTime = Date.now() - timestamp;
        
        res.json(responseData);
    } catch (err) {
        console.error(`[Instance ${instanceId}] Error calling next instance ${nextInstanceId}:`, err.message);
        responseData.error = `Failed to call instance ${nextInstanceId}`;
        responseData.errorMessage = err.message;
        res.status(500).json(responseData);
    }
});
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'up',
        instance: process.env.INSTANCE_ID || 'unknown',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
    });
});

// Catch-all for undefined routes
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`,
        timestamp: new Date().toISOString()
    });
});

// Error handler middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    apm.captureError(err);
    
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message,
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(port, () => {
    console.log(`🚀 Test bench running on port ${port}`);
    console.log(`📝 Instance ID: ${process.env.INSTANCE_ID || 'unknown'}`);
    console.log(`⏱️ Started at: ${new Date().toISOString()}`);
});