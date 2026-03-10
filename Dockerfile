# Use a lightweight Node.js image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /bg_app

# Copy package.json and package-lock.json first (for caching dependencies)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on (Back4App uses environment variables, but this is good practice)
EXPOSE 3001

# Command to start the application
CMD ["npm", "start"]
