#!/bin/bash
# Deployment documentation for Cloud Run

# Exit if any command fails
set -e

# Ensure PROJECT_ID is set or determine it dynamically
if [ -z "$PROJECT_ID" ]; then
  PROJECT_ID=$(gcloud config get-value project)
  if [ -z "$PROJECT_ID" ]; then
    echo "Error: PROJECT_ID environment variable not set and no default gcloud project found."
    exit 1
  fi
fi

echo "Deploying to project: $PROJECT_ID"

# Build and submit the container image to Google Artifact Registry
echo "Building the container..."
# Using us-central1 Artifact Registry by default
IMAGE_URL="us-central1-docker.pkg.dev/$PROJECT_ID/twenty-repo/twenty-server"

gcloud builds submit --tag $IMAGE_URL --file packages/twenty-server/Dockerfile.cloudrun .

# Deploy the service to Google Cloud Run
echo "Deploying to Cloud Run..."
gcloud run deploy twenty-server \
  --image $IMAGE_URL \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated

echo "Deployment complete!"
