#!/bin/bash
echo "Building Extension..."
chmod +x update_config.sh && ./update_config.sh

rm -f crixenai.zip
zip -r crixenai.zip . -x "*.git*" -x "*.DS_Store*" -x "build.sh" -x ".env.example"
echo "Done! Created crixenai.zip"
