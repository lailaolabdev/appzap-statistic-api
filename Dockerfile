# Step 1: Build Stage
FROM --platform=linux/amd64 node:20 AS build

# Set the working directory
WORKDIR /usr/src/app

# Copy only package.json and package-lock.json to install dependencies
COPY package*.json ./

# Install dependencies
RUN npm install --production && npm cache clean --force

# Step 2: Production Stage
FROM --platform=linux/amd64 node:20-slim

# Set the working directory
WORKDIR /usr/src/app

# Copy the node_modules from the build stage
COPY --from=build /usr/src/app/node_modules ./node_modules

# Copy only the necessary application files
COPY package*.json ./
COPY index.js ./
COPY src/ ./src/

# Expose the port your API will run on
EXPOSE 5050

# Set environment variable to production
ENV NODE_ENV=production

# Run the application
CMD ["npm", "start"]
