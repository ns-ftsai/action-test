# Use a lightweight official Node.js Alpine base image.
# We're picking Node.js 20 here, as it's a current LTS version and works well with your setup.
FROM node:20-alpine

# Set the working directory inside the container.
# This is where all your action's files will live.
WORKDIR /app

# Copy package.json and package-lock.json first.
# This is a Docker best practice: if these files don't change,
# Docker can use a cached layer for `npm install`, speeding up builds.
COPY package.json package-lock.json ./

# Install ALL dependencies (including devDependencies) to build the project
# Remove --production flag so devDependencies like typescript are installed
RUN npm install --frozen-lockfile

# Copy the rest of your source code into the container.
# This includes your `src/` directory, `tsconfig.json`, etc.
COPY . .

RUN ls -la src/
RUN npm run build
RUN ls -la dist/

# Compile your TypeScript code into JavaScript.
# This executes the "build" script defined in your package.json,
# which uses `tsc` to output files into the `dist` directory.
RUN npm run build

# Optional: Clean up devDependencies after build to reduce image size
RUN npm prune --production

# Set the container's entry point.
# This is the command that will be executed when the container starts.
# It runs your compiled JavaScript file using Node.js.
ENTRYPOINT ["node", "dist/main.js"]