const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const app = express(); 
const port = 3000;
app.use(express.json());

// SQLite in-memory database
const db = new sqlite3.Database(':memory:');
db.serialize(() => {
    db.run("CREATE TABLE test (id INTEGER PRIMARY KEY, data TEXT)");
});

// Delay response simulation
app.get('/delay', (req, res) => {
    const delay = parseInt(req.query.delay) || 1000;
    setTimeout(() => {
        res.json({ message: `Response delayed by ${delay}ms` });
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
app.post('/crud', (req, res) => {
    const operation = req.body.operation.toUpperCase();
    const randomData = `Data_${Math.random().toString(36).substr(2, 5)}`;
    
    if (operation.includes('C')) {
        db.run("INSERT INTO test (data) VALUES (?)", [randomData], function(err) {
            if (err) return res.status(500).json({ error: err.message });
        });
    }

    if (operation.includes('R')) {
        db.all("SELECT * FROM test", [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
        return;
    }

    if (operation.includes('U')) {
        db.run("UPDATE test SET data = ? WHERE id = (SELECT id FROM test ORDER BY RANDOM() LIMIT 1)", [randomData], function(err) {
            if (err) return res.status(500).json({ error: err.message });
        });
    }

    if (operation.includes('D')) {
        db.run("DELETE FROM test WHERE id = (SELECT id FROM test ORDER BY RANDOM() LIMIT 1)", function(err) {
            if (err) return res.status(500).json({ error: err.message });
        });
    }

    res.json({ message: `Operations executed: ${operation}`, randomData });
});

// Error code simulation
app.get('/status/:code', (req, res) => {
    const code = parseInt(req.params.code);
    res.status(code).json({ error: `Error ${code}`, message: `Simulated error code ${code}` });
});

// Instance chaining simulation
const instances = ['http://localhost:3000/instance1', 'http://localhost:3000/instance2', 'http://localhost:3000/instance3', 'http://localhost:3000/instance4'];
app.get('/chain', async (req, res) => {
    const sequence = req.query.seq ? req.query.seq.split(',').map(i => parseInt(i)) : [1, 2, 3, 4];
    let response = [];
    for (const index of sequence) {
        if (instances[index - 1]) {
            try {
                const resp = await axios.get(instances[index - 1]);
                response.push(resp.data);
            } catch (err) {
                response.push({ error: `Instance ${index} failed` });
            }
        }
    }
    res.json(response);
});

// Auto API calls simulation
app.get('/simulate-load', async (req, res) => {
    const endpoints = ['/delay?delay=500', '/error?type=handled', '/crud'];
    const responses = await Promise.all(endpoints.map(endpoint => axios.get(`http://localhost:${port}${endpoint}`).catch(err => err.response?.data || { error: 'Request failed' })));
    res.json(responses.map(r => r.data));
});

// Default instances for chaining
app.get('/instance1', (req, res) => res.json({ instance: 1 }));
app.get('/instance2', (req, res) => res.json({ instance: 2 }));
app.get('/instance3', (req, res) => res.json({ instance: 3 }));
app.get('/instance4', (req, res) => res.json({ instance: 4 }));

// Start server
app.listen(port, () => console.log(`Test bench running on port ${port}`));