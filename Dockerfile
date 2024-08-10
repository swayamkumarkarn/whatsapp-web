# Use a base image with Puppeteer and dependencies
FROM ghcr.io/puppeteer/puppeteer:23.0.2

# Install Chromium
RUN apt-get update && apt-get install -y \
    chromium \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    MONGODB_URI=mongodb+srv://swayamkumarkarn:Swayam123@cluster0.hqhkkrt.mongodb.net/wweb

# Set the working directory in the container
WORKDIR /usr/src/app

# Install application dependencies
COPY package*.json ./
RUN npm ci

# Copy the application code
COPY . .

# Run the application
CMD [ "node", "index.js" ]
