# 🧠 LLM Router Service

## 📋 **Overview**

The LLM Router is an intelligent microservice that optimizes Large Language Model (LLM) usage across multiple providers, including Google Cloud Vertex AI, with intelligent routing, performance optimization, and cost efficiency.

## 🚀 **Current Status: 95% Complete**

### ✅ **What's Ready:**
- **Weaviate Vector Database**: Production-ready deployment with LLMDocument schema
- **Google Cloud Vertex AI**: Fully configured with Workload Identity Federation
- **Azure Infrastructure**: All services configured and secured
- **Key Vault**: All secrets stored securely
- **Documentation**: Complete deployment and configuration guides

### 🔧 **What's Next:**
- **Azure AD Service Principal**: Create and configure authentication
- **Service Deployment**: Deploy the LLM Router Container App
- **Testing & Validation**: End-to-end testing of the complete system

## 🏗️ **Architecture**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   LLM Router   │────│   Weaviate       │────│   PostgreSQL    │
│   Service      │    │   Vector DB      │    │   Database      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Google Cloud  │    │   Azure Redis    │    │   Azure Service │
│   Vertex AI     │    │   Cache          │    │   Bus           │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🔐 **Key Features**

- **Intelligent LLM Routing**: Automatically selects the best model for each request
- **Vector Search**: RAG capabilities using Weaviate for document similarity
- **Multi-Cloud**: Seamless integration with Azure and Google Cloud
- **Security-First**: Azure AD authentication, Key Vault secrets, Workload Identity
- **Production-Ready**: Auto-scaling, monitoring, health checks, and backup strategies

## 📚 **Documentation**

- **[Production Deployment Guide](PRODUCTION-DEPLOYMENT.md)**: Complete deployment instructions
- **[Azure Key Vault Configuration](env.azure-keyvault.md)**: Security and configuration details
- **[Weaviate Schema](weaviate-schema.json)**: Vector database schema definition

## 🚀 **Quick Start**

### **Prerequisites**
- Azure CLI with proper permissions
- Google Cloud CLI configured
- Access to Azure Key Vault `htma-dev-secure-kv`

### **Deployment**
```bash
# 1. Create Azure Service Principal
az ad sp create-for-rbac --name "htma-llm-router" --role "Contributor"

# 2. Update Key Vault with service principal details
az keyvault secret set --vault-name htma-dev-secure-kv --name "llm-router-azure-client-id" --value "YOUR_CLIENT_ID"
az keyvault secret set --vault-name htma-dev-secure-kv --name "llm-router-azure-client-secret" --value "YOUR_CLIENT_SECRET"

# 3. Deploy the service
az containerapp create --name htma-llm-router --resource-group rg-htma-dev --environment htma-dev-container-env --image YOUR_IMAGE
```

## 🔍 **Testing**

### **Health Checks**
```bash
# Weaviate
curl -H "Authorization: Bearer $WEAVIATE_API_KEY" \
  "https://weaviate-llm-router.victoriouswater-b21edd48.eastus.azurecontainerapps.io/v1/.well-known/ready"

# LLM Router (after deployment)
curl "https://htma-llm-router.victoriouswater-b21edd48.eastus.azurecontainerapps.io/health/live"
```

### **Vector Search Test**
```bash
# Test document insertion and search
curl -X POST -H "Authorization: Bearer $WEAVIATE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"class":"LLMDocument","properties":{"content":"Test document","title":"Test"}}' \
  "https://weaviate-llm-router.victoriouswater-b21edd48.eastus.azurecontainerapps.io/v1/objects"
```

## 🛠️ **Development**

### **Local Development**
```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your local configuration

# Run development server
npm run dev

# Run tests
npm test
```

### **Environment Variables**
See [env.azure-keyvault.md](env.azure-keyvault.md) for complete configuration details.

## 📊 **Monitoring**

- **Health Endpoints**: `/health/live`, `/health/ready`
- **Metrics**: `/metrics` (Prometheus format)
- **Logs**: Azure Container Apps logging
- **Performance**: Weaviate vector search metrics

## 🔒 **Security**

- **Authentication**: Azure AD JWT tokens
- **Secrets**: Azure Key Vault integration
- **Network**: HTTPS/TLS, network policies
- **Access Control**: Role-based permissions

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 **License**

This project is proprietary and confidential.

---

**🎯 Next**: Complete Azure AD setup and deploy the LLM Router service to production!
# LLM Router CI/CD Pipeline Ready - Fri Aug 22 15:06:10 EDT 2025
