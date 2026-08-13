#!/bin/bash
set -e

echo "🚀 Starting deployment..."

cd /www/live_chat_nemark

# Pull latest changes
echo "📥 Pulling latest code..."
git pull --ff-only origin main

# If CI supplied a release SHA, never deploy a different (untested) revision.
# This remains optional for manual deploys, but fails closed when present.
if [ -n "${DEPLOY_SHA:-}" ]; then
  ACTUAL_SHA="$(git rev-parse HEAD)"
  if [ "$ACTUAL_SHA" != "$DEPLOY_SHA" ]; then
    echo "Release mismatch: expected $DEPLOY_SHA, got $ACTUAL_SHA"
    exit 19
  fi
fi

# Build first, then apply additive Prisma schema changes before switching the
# application container. Prisma aborts instead of accepting destructive changes.
# Dockerfile runs `npm run verify:production` while building this image, so the
# gate must pass before the database or any running application changes.
echo "🐳 Building production image..."
docker compose build app
docker compose up -d mongo

echo "🗄️ Applying safe database schema updates..."
docker compose run --rm app npx prisma db push --skip-generate

echo "🚀 Starting application containers..."
docker compose up -d --remove-orphans --wait --wait-timeout 180

# The public proxy can route /_next/static to the API process, so verify that
# it can serve every JS/CSS asset referenced by the new login page.
echo "🔎 Verifying production runtime assets..."
docker compose exec -T app npm run test:static

# Verify through the real public reverse proxy as well. This catches a proxy
# serving HTML from Next.js while sending its hashed chunks to another origin.
echo "Verifying public login assets..."
docker compose exec -T app npm run test:public-static

# Clean up dangling images
echo "🧹 Cleaning up old images..."
docker image prune -f

# Show status
echo ""
echo "✅ Deployment complete! Container status:"
docker compose ps
