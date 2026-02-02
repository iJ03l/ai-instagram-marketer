#!/bin/bash
echo "Building Extension..."
rm -f instagram-ai-comment-assistant.zip
zip -r instagram-ai-comment-assistant.zip . -x "*.git*" -x "*.DS_Store*" -x "build.sh" -x ".env.example"
echo "Done! Created instagram-ai-comment-assistant.zip"
