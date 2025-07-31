# Use the official Node.js 20 LTS Alpine image as a lightweight base.
FROM node:20-alpine

# Set the working directory for the application.
WORKDIR /app

# Install the git client using Alpine's package manager.
# This is required for your action to run git commands like 'diff'.
RUN apk add --no-cache git

# Copy package files and install Node.js dependencies.
# This is done in a separate step to leverage Docker's build cache.
COPY package.json package-lock.json ./
RUN npm install

# Copy the rest of the application source code.
COPY . .

# Compile TypeScript to JavaScript using the "build" script in package.json.
RUN npm run build

# Set the entry point for the container to run the compiled action.
ENTRYPOINT ["node", "/app/dist/main.js"]