FROM node:20-alpine AS builder

WORKDIR /app

# Copy only package.json (without lock file to regenerate fresh dependencies)
COPY package.json ./

# Install dependencies
RUN npm install

# Copy source code (excluding package-lock.json via .dockerignore or overwrite)
COPY . .

# Remove any package-lock.json that might have been copied
RUN rm -f package-lock.json

# Build argument for API URL
ARG VITE_API_URL=http://localhost:8899/api

# Set environment variable for build
ENV VITE_API_URL=${VITE_API_URL}

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
