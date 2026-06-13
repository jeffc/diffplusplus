# Use a lightweight Node.js Alpine base image
FROM node:20-alpine

# Install Git (required by the diff-viewer backend)
RUN apk add --no-cache git

# Configure Git to trust all directories, to allow inspecting mounted host repositories
# that might have different ownership than the container user.
RUN git config --global --add safe.directory '*'

# Set the working directory inside the container
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy the rest of the application files
COPY . .

# Expose the port the server listens on
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]
