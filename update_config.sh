#!/bin/bash

# Load .env variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Default values if not set
API_URL=${CRIXEN_API_URL:-"https://api.crixen.xyz/api/v1/ai/generate"}
NEAR_AI=${NEAR_AI_ENDPOINT:-"https://cloud-api.near.ai/v1/chat/completions"}

# Generate src/config.js
echo "Generating src/config.js..."
cat <<EOF > src/config.js
export const CONFIG = {
    API_URL: '$API_URL',
    NEAR_AI_ENDPOINT: '$NEAR_AI'
};
EOF

echo "src/config.js updated!"
