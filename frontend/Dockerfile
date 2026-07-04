FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests first for better layer caching
COPY package.json package-lock.json ./

# Install exact locked dependencies to reduce disk usage during build
RUN npm ci --no-audit --no-fund

# Copy source code
COPY . .

# Build argument for API URL
ARG VITE_API_URL=http://localhost:8899/api

# Set environment variable for build
ENV VITE_API_URL=${VITE_API_URL}

# Increase Node.js heap for Vite/TypeScript build inside constrained Docker builders
ENV NODE_OPTIONS=--max-old-space-size=3072

# Build the application
RUN npm run build

# Production stage with nginx
FROM nginx:alpine

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
