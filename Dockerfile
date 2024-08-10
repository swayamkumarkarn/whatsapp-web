# Use the Puppeteer Docker image
FROM ghcr.io/puppeteer/puppeteer:23.0.2

# Set environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false \
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
