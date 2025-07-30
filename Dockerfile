# Use a lightweight official Node.js Alpine base image.
# We're picking Node.js 20 here, as it's a current LTS version and works well with your setup.
FROM node:20-alpine

# Set the working directory inside the container.
# This is where all your action's files will live.
WORKDIR /github/workspace

# Copy package.json and package-lock.json first.
# This is a Docker best practice: if these files don't change,
# Docker can use a cached layer for `npm install`, speeding up builds.
COPY package.json package-lock.json ./

# Install ALL dependencies (including devDependencies) to build the project
# Remove --production flag so devDependencies like typescript are installed
RUN npm install

# Copy the rest of your source code into the container.
# This includes your `src/` directory, `tsconfig.json`, etc.
COPY . .
COPY src/prompt.txt dist/
RUN ls -la src/
RUN npm run build
RUN ls -la dist/

# Set the container's entry point.
# This is the command that will be executed when the container starts.
# It runs your compiled JavaScript file using Node.js.
ENTRYPOINT ["node", "dist/main.js"]