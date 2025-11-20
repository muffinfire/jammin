# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install app dependencies
RUN npm install

# Bundle app source
COPY . .

# Build the React app
RUN npm run build

# Your app binds to port 8080, so expose it
EXPOSE 8080

# Define the command to run your app
CMD [ "node", "server.cjs" ]