# NodeJS API Testbench

A simple NodeJS service designed to be deployed as multiple instances in Docker containers for testing API call chaining, load testing, and monitoring with Elasticsearch.

## Available Endpoints

- **`/delay?delay=34`** - Send response delayed by specified milliseconds
- **`/error?type=(fatal|handled)`** - Simulate error conditions
- **`/crud`** - `{operation:(crud)}` - Execute CRUD operations on in-memory database
- **`/status?code=200`** - Return a response with the specified status code
- **`/chain?seq=3214`** - Execute a chain of API calls across multiple service instances
- **`/chainapi`** - Advanced API call chaining with flexible configuration

## Docker Deployment

The application is designed to be deployed as multiple instances that can communicate with each other:

```bash
# Build and start all 4 instances
docker-compose up -d

# View logs from all instances
docker-compose logs -f

# Test the chain API call
curl "http://localhost:3003/chain?seq=3214"
```

## Chain API Call Sequence

For the `/chain?seq=3214` endpoint:

1. The sequence digits are processed as individual instance IDs: "3","2","1","4"
2. The first call goes to instance-3
3. Instance-3 processes the request and forwards it to instance-2
4. Instance-2 forwards to instance-1
5. Instance-1 forwards to instance-4
6. Instance-4 performs the final processing and returns data
7. Each service adds its response data to the chain, creating a nested response

## Environment Variables

- `INSTANCE_ID` - The unique identifier for this instance (1-4)
- `INSTANCE_BASE_URL` - Base URL for reaching other instances (e.g., http://instance)
- `INSTANCE_PORT` - Port on which the instances are running (default: 3000)
- `INSTANCE_NAME` - Name prefix for the instances (default: instance)

## Docker Networking

Each instance is accessible via the Docker network:
- Within the Docker network: http://instance-1:3000, http://instance-2:3000, etc.
- From the host machine: http://localhost:3001, http://localhost:3002, etc.

## Elasticsearch Integration

The application uses Elastic APM for performance monitoring and tracking. All API calls are automatically tracked and reported to the configured Elasticsearch instance.
