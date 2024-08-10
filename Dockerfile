FROM ghcr.io/puppeteer/puppeteer:23.0.2

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
   PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable\
   MONGODB_URI=mongodb+srv://swayamkumarkarn:Swayam123@cluster0.hqhkkrt.mongodb.net/wweb

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci
COPY . .
CMD [ "node","index.js" ]