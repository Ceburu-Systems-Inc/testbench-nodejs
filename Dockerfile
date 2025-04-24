FROM node:18-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies and rebuild native modules
RUN npm install

# Copy application code
COPY . .

# Expose the port
EXPOSE 3000

# Start the application
CMD ["node", "index.js"]
