# Use an official Node.js runtime as a parent image (choose a version compatible with your project)
# Using 'slim' variant for a smaller image size
FROM node:18-slim

# Set an argument for the Rhubarb version for easier updates
ARG RHUBARB_VERSION=1.13.0

# Install system dependencies:
# - ffmpeg: For audio conversion
# - wget & unzip: To download and extract Rhubarb
# - ca-certificates: Often needed for HTTPS downloads
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg wget unzip ca-certificates && \
    \
    # Download and install the Rhubarb lip-sync binary
    wget "https://github.com/DanielSWolf/rhubarb-lip-sync/releases/download/v${RHUBARB_VERSION}/rhubarb-lip-sync-${RHUBARB_VERSION}-linux.zip" -O rhubarb.zip && \
    unzip rhubarb.zip -d /tmp/rhubarb && \
    # Move the executable to a standard bin directory and make it executable
    mv "/tmp/rhubarb/rhubarb-lip-sync-${RHUBARB_VERSION}-linux/rhubarb" /usr/local/bin/rhubarb && \
    chmod +x /usr/local/bin/rhubarb && \
    \
    # Clean up downloaded files and apt cache to reduce image size
    rm -rf rhubarb.zip /tmp/rhubarb && \
    # Remove packages only needed for download/extraction
    apt-get purge -y --auto-remove wget unzip && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create a non-root user and group for security
# Running as non-root is a security best practice
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs --shell /bin/bash nodejs

# Set the working directory in the container
WORKDIR /app

# Create directories for audio and video files
# IMPORTANT: For persistent storage (e.g., on Render), you'll need to mount
# a persistent disk volume to these locations (/app/audios, /app/videos).
# Set ownership to the non-root user.
RUN mkdir -p audios videos && chown -R nodejs:nodejs audios videos

# Copy package.json and package-lock.json (if available)
# This step leverages Docker layer caching - dependencies are only re-installed
# if these files change.
COPY package.json package-lock.json* ./

# Install application dependencies using npm
# Use --omit=dev or --only=production in a production build for smaller size
RUN npm install && npm cache clean --force
# Ensure the app directory and node_modules are owned by the non-root user
RUN chown -R nodejs:nodejs /app

# Switch to the non-root user
USER nodejs

# Copy the rest of the application source code into the container
# Do this *after* npm install to leverage caching
COPY . .

# The application listens on process.env.PORT || 3000. Render will set PORT.
# Exposing the port is good practice for documentation but not strictly necessary on Render.
# EXPOSE 3000

# Define the command to run the application
CMD ["node", "index.js"]
