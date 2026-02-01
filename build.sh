#!/bin/bash
echo "Building Extension..."
zip -r instagram-ai-comment-assistant.zip . -x "*.git*" -x "*.DS_Store*" -x "build.sh"
echo "Done! Created instagram-ai-comment-assistant.zip"
