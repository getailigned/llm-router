# Dynamic Model Discovery Environment Configuration

## 🔧 **Required Environment Variables**

### **Google Cloud Configuration**
```bash
# Your Google Cloud project ID
GOOGLE_CLOUD_PROJECT=getaligned-469514

# Google Cloud region for Vertex AI
GOOGLE_CLOUD_LOCATION=us-central1

# Google Cloud authentication (set via gcloud auth)
# gcloud auth application-default login
# gcloud config set project getaligned-469514
```

### **External API Keys (Optional)**
```bash
# Anthropic API key for Claude models
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# OpenAI API key for GPT models
OPENAI_API_KEY=your_openai_api_key_here
```

## 🚀 **Setup Instructions**

### **1. Authenticate with Google Cloud**
```bash
# Login and set project
gcloud auth login
gcloud config set project getaligned-469514

# Set up application default credentials
gcloud auth application-default login --scopes="https://www.googleapis.com/auth/cloud-platform"
gcloud auth application-default set-quota-project getaligned-469514
```

### **2. Enable Required APIs**
```bash
# Enable Vertex AI API
gcloud services enable aiplatform.googleapis.com

# Enable other required services
gcloud services enable compute.googleapis.com
gcloud services enable container.googleapis.com
gcloud services enable storage.googleapis.com
```

### **3. Set Environment Variables**
```bash
export GOOGLE_CLOUD_PROJECT="getaligned-469514"
export GOOGLE_CLOUD_LOCATION="us-central1"
export ANTHROPIC_API_KEY="your_key_here"  # Optional
export OPENAI_API_KEY="your_key_here"     # Optional
```

## 📊 **What Gets Discovered Automatically**

### **Vertex AI Models**
- All deployed models in your project
- Model capabilities inferred from names
- Real-time performance metrics
- Google Cloud pricing information

### **External API Models**
- Anthropic Claude models (if API key provided)
- OpenAI GPT models (if API key provided)
- Published pricing rates
- Estimated performance metrics

## 🔄 **Automatic Updates**

### **Model Discovery**
- **Frequency**: Every time the service initializes
- **Manual Refresh**: Available via API calls
- **New Models**: Automatically detected when deployed

### **Pricing Updates**
- **Cache TTL**: 1 hour (configurable)
- **Automatic Refresh**: On cache expiration
- **Fallback**: Estimated pricing if APIs fail

## 🧪 **Testing the System**

### **Run the Test Script**
```bash
cd llm-router
npm run test:dynamic-discovery
# or
npx ts-node src/test-dynamic-discovery.ts
```

### **Expected Output**
```
🚀 Starting Dynamic Model Discovery Test

📋 Test 1: Discovering Models from Google Cloud...
✅ Discovered 9 models:

🔹 VERTEX-AI Models (9):
   • simple-text-model (907557788287238144)
     Capabilities: text-generation
     Region: us-central1
     Last Discovered: 2024-01-XX...

💰 Test 2: Retrieving Real-time Pricing...
✅ Retrieved pricing for 9 models:

🔹 simple-text-model:
   Input: $0.001/1K tokens
   Output: $0.002/1K tokens
   Source: vertex-ai-estimated
   Confidence: 80.0%
   Last Updated: 2024-01-XX...
```

## 🔍 **Troubleshooting**

### **Common Issues**

#### **1. Authentication Errors**
```bash
# Solution: Re-authenticate
gcloud auth application-default login
gcloud auth application-default set-quota-project getaligned-469514
```

#### **2. Permission Denied**
```bash
# Solution: Check IAM roles
gcloud projects get-iam-policy getaligned-469514
# Ensure you have roles/owner or roles/aiplatform.admin
```

#### **3. API Not Enabled**
```bash
# Solution: Enable required APIs
gcloud services enable aiplatform.googleapis.com
gcloud services enable compute.googleapis.com
```

#### **4. No Models Found**
```bash
# Solution: Check if models are deployed
gcloud ai models list --region=us-central1
# If empty, deploy models first
```

## 📈 **Performance Considerations**

### **Discovery Performance**
- **Initial Discovery**: ~2-5 seconds
- **Pricing Retrieval**: ~1-3 seconds per model
- **Cache Hit**: <100ms

### **Resource Usage**
- **Memory**: ~50MB for 100 models
- **API Calls**: Minimal (cached)
- **Network**: Only during discovery/refresh

## 🔐 **Security Features**

### **Authentication**
- Google Cloud IAM integration
- Service account support
- OAuth 2.0 flow

### **Data Protection**
- No sensitive data logged
- Secure API communication
- Environment variable protection

## 🎯 **Next Steps**

1. **Deploy the services** to your LLM Router
2. **Test model discovery** with the test script
3. **Integrate with routing** for automatic model selection
4. **Monitor performance** and adjust cache TTL as needed
5. **Add custom models** to your Vertex AI project
