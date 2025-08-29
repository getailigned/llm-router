#!/bin/bash

# Setup Environment Variables for Dynamic Model Discovery
echo "🔧 Setting up environment variables for LLM Router..."

# Set Google Cloud project
export GOOGLE_CLOUD_PROJECT="getaligned-469514"
echo "✅ Set GOOGLE_CLOUD_PROJECT=$GOOGLE_CLOUD_PROJECT"

# Set Google Cloud region
export GOOGLE_CLOUD_LOCATION="us-central1"
echo "✅ Set GOOGLE_CLOUD_LOCATION=$GOOGLE_CLOUD_LOCATION"

# Optional: Set API keys if you have them
# export ANTHROPIC_API_KEY="your_anthropic_api_key_here"
# export OPENAI_API_KEY="your_openai_api_key_here"

echo ""
echo "🚀 Environment variables set successfully!"
echo ""
echo "To make these permanent, add them to your ~/.zshrc or ~/.bashrc:"
echo "export GOOGLE_CLOUD_PROJECT=\"getaligned-469514\""
echo "export GOOGLE_CLOUD_LOCATION=\"us-central1\""
echo ""
echo "Now you can run the test scripts:"
echo "npx ts-node src/test-dynamic-discovery.ts"
echo "npx ts-node src/test-use-case-analysis.ts"
