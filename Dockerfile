# Use a lightweight official Node.js Alpine base image.
# We're picking Node.js 20 here, as it's a current LTS version and works well with your setup.
FROM node:20-alpine

# Set the working directory inside the container.
# This is the standard path GitHub Actions uses for Docker containers.
WORKDIR /app

# --- DEBUG STEP 1: Show initial /app contents ---
RUN echo "--- DEBUG: Initial /app contents ---" && ls -la /app

# Copy package.json and package-lock.json first.
# This is a Docker best practice: if these files don't change,
# Docker can use a cached layer for `npm install`, speeding up builds.
COPY package.json package-lock.json ./

# --- DEBUG STEP 2: Show /app contents after copying package files ---
RUN echo "--- DEBUG: /app contents after copying package files ---" && ls -la /app
# --- DEBUG STEP 3: Show content of package.json and package-lock.json inside the container ---
RUN echo "--- DEBUG: package.json content ---" && cat package.json
RUN echo "--- DEBUG: package-lock.json content ---" && cat package-lock.json

# Install ALL dependencies (including devDependencies).
# This is crucial for ensuring `typescript` (for `npm run build`) and potentially
# `@actions/core` (if still in devDependencies) are installed.
RUN echo "--- DEBUG: Running npm install (installing all dependencies) ---" && npm install

# --- DEBUG STEP 4: Check if @actions/core is in node_modules after install ---
RUN echo "--- DEBUG: Contents of /app/node_modules/ (top level) ---" && ls -la /app/node_modules/
RUN echo "--- DEBUG: Contents of /app/node_modules/@actions/ ---" && ls -la /app/node_modules/@actions/
RUN echo "--- DEBUG: Contents of /app/node_modules/@actions/core/ ---" && ls -la /app/node_modules/@actions/core/ || echo "@actions/core not found here!"

# Copy the rest of your source code into the container.
# This brings `src/` (containing `main.ts` and `prompt.txt`) and `tsconfig.json`.
COPY . .

# --- DEBUG STEP 5: Show /app contents after copying source code ---
RUN echo "--- DEBUG: /app contents after copying source code ---" && ls -la /app
# --- DEBUG STEP 5.1: Verify src/ contents ---
RUN echo "--- DEBUG: Contents of /app/src/ ---" && ls -la /app/src/
RUN echo "--- DEBUG: Contents of /app/src/prompt.txt ---" && cat /app/src/prompt.txt || echo "src/prompt.txt not found!"


# Compile your TypeScript code into JavaScript.
# This executes the "build" script defined in your package.json,
# which uses `tsc` to output files into the `dist` directory.
RUN echo "--- DEBUG: Running npm run build (tsc compilation) ---" && npm run build

# --- DEBUG STEP 6: Show contents of dist/ directory and compiled main.js ---
RUN echo "--- DEBUG: Contents of /app/dist/ ---" && ls -la /app/dist/
RUN echo "--- DEBUG: Content of /app/dist/main.js (first 30 lines) ---" && head -n 30 /app/dist/main.js

# Set the container's entry point.
# This is the command that will be executed when the container starts.
# It runs your compiled JavaScript file using Node.js.
ENTRYPOINT ["node", "/app/dist/main.js"]