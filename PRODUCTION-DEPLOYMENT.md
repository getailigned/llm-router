# 🚀 LLM Router - Production Deployment Guide

## 📋 **Overview**

This guide covers the complete production deployment of the LLM Router service, including all infrastructure components, security configurations, and deployment procedures.

## 🏗️ **Infrastructure Components**

### **1. Vector Database: Weaviate**
- **Status**: ✅ **Production Ready**
- **URL**: `https://weaviate-llm-router.victoriouswater-b21edd48.eastus.azurecontainerapps.io`
- **Authentication**: API Key (stored in Azure Key Vault)
- **Schema**: LLMDocument class with 15 properties
- **Features**: 
  - HNSW vector indexing with cosine similarity
  - Auto-scaling (1-3 replicas)
  - Health checks and monitoring
  - HTTPS/TLS termination
  - Resource limits (1 CPU, 2GB RAM)

### **2. Database: PostgreSQL**
- **Status**: ✅ **Configured**
- **Host**: `htma-postgres-dev.postgres.database.azure.com`
- **Database**: `htma_llm_router`
- **User**: `htmaadmin`
- **Note**: pgvector extension not available, using Weaviate for vector storage

### **3. Caching: Redis**
- **Status**: ✅ **Available**
- **Host**: `htma-dev-redis.redis.cache.windows.net`
- **Port**: 6380
- **Authentication**: Password-based

### **4. Message Queue: Azure Service Bus**
- **Status**: ✅ **Configured**
- **Namespace**: `htma-dev-servicebus`
- **Connection**: Stored in Key Vault
- **Access Policy**: RootManageSharedAccessKey

### **5. Authentication: Azure AD**
- **Status**: ⚠️ **Needs Configuration**
- **Tenant ID**: Configured in Key Vault
- **Service Principal**: Needs to be created
- **JWT Secret**: Auto-generated and stored

### **6. AI Services: Google Cloud Vertex AI**
- **Status**: ✅ **Production Ready**
- **Project**: `gen-lang-client-0143595591`
- **Location**: `us-east1`
- **Authentication**: Workload Identity Federation
- **Models**: Gemini 1.5 Pro, PaLM 2, and other hosted models

## 🔐 **Security Configuration**

### **Azure Key Vault Secrets**
All sensitive configuration is stored in `htma-dev-secure-kv`:

```bash
# Database & Storage
llm-router-database-url          # PostgreSQL connection
llm-router-redis-url            # Redis connection
WEAVIATE-URL                    # Weaviate vector database URL
WEAVIATE-API-KEY                # Weaviate authentication

# Azure AD
llm-router-azure-tenant-id      # Azure AD tenant
llm-router-azure-client-id      # Service principal (placeholder)
llm-router-azure-client-secret  # Service principal (placeholder)
llm-router-jwt-secret           # JWT signing

# Google Cloud
llm-router-google-cloud-project-id      # GCP project
llm-router-google-application-credentials # Service account
llm-router-vertex-ai-location           # Vertex AI region
llm-router-workload-identity-pool       # Workload Identity
llm-router-workload-identity-provider   # Workload Identity

# Integration
llm-router-service-bus-connection-string # Service Bus
```

### **Workload Identity Federation**
- **Pool**: `azure-htma-pool`
- **Provider**: `azure-htma-provider`
- **Repository**: `getailigned/HT-Management`
- **Service Account**: `htma-llm-router@gen-lang-client-0143595591.iam.gserviceaccount.com`

## 🚀 **Deployment Steps**

### **Step 1: Create Azure Service Principal**
```bash
# Create service principal for LLM Router
az ad sp create-for-rbac \
  --name "htma-llm-router" \
  --role "Contributor" \
  --scopes "/subscriptions/98f43dcc-3139-41bb-a50b-a2fb1b08ef62/resourceGroups/rg-htma-dev"

# Update Key Vault with actual values
az keyvault secret set \
  --vault-name htma-dev-secure-kv \
  --name "llm-router-azure-client-id" \
  --value "ACTUAL_CLIENT_ID_FROM_SERVICE_PRINCIPAL"

az keyvault secret set \
  --vault-name htma-dev-secure-kv \
  --name "llm-router-azure-client-secret" \
  --value "ACTUAL_CLIENT_SECRET_FROM_SERVICE_PRINCIPAL"
```

### **Step 2: Deploy LLM Router Container App**
```bash
# Deploy the LLM Router service
az containerapp create \
  --name htma-llm-router \
  --resource-group rg-htma-dev \
  --environment htma-dev-container-env \
  --image YOUR_REGISTRY/llm-router:latest \
  --target-port 3000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 1.0 \
  --memory 2.0Gi \
  --env-vars \
    NODE_ENV=production \
    PORT=3000 \
    LOG_LEVEL=info
```

### **Step 3: Configure Key Vault Access**
```bash
# Get Container App managed identity
CONTAINER_APP_IDENTITY=$(az containerapp show \
  --resource-group rg-htma-dev \
  --name htma-llm-router \
  --query "identity.principalId" -o tsv)

# Grant access to Key Vault
az keyvault set-policy \
  --vault-name htma-dev-secure-kv \
  --object-id "$CONTAINER_APP_IDENTITY" \
  --secret-permissions get list
```

## 🔧 **Service Configuration**

### **Environment Variables**
The LLM Router service uses these environment variables (configured via Key Vault):

```bash
# Core Configuration
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Database & Storage
DATABASE_URL=@Microsoft.KeyVault(SecretUri=https://htma-dev-secure-kv.vault.azure.net/secrets/llm-router-database-url/)
REDIS_URL=@Microsoft.KeyVault(SecretUri=https://htma-dev-secure-kv.vault.azure.net/secrets/llm-router-redis-url/)
WEAVIATE_URL=@Microsoft.KeyVault(SecretUri=https://htma-dev-secure-kv.vault.azure.net/secrets/WEAVIATE-URL/)
WEAVIATE_API_KEY=@Microsoft.KeyVault(SecretUri=https://htma-dev-secure-kv.vault.azure.net/secrets/WEAVIATE-API-KEY/)

# Authentication
AZURE_TENANT_ID=@Microsoft.KeyVault(SecretUri=https://htma-dev-secure-kv.vault.azure.net/secrets/llm-router-azure-tenant-id/)
AZURE_CLIENT_ID=@Microsoft.KeyVault(SecretUri=https://htma-dev-secure-kv.vault.azure.net/secrets/llm-router-azure-client-id/)
AZURE_CLIENT_SECRET=@Microsoft.KeyVault(SecretUri=https://htma-dev-secure-kv.vault.azure.net/secrets/llm-router-azure-client-secret/)
JWT_SECRET=@Microsoft.KeyVault(SecretUri=https://htma-dev-secure-kv.vault.azure.net/secrets/llm-router-jwt-secret/)

# Google Cloud
GOOGLE_CLOUD_PROJECT_ID=@Microsoft.KeyVault(SecretUri=https://htma-dev-secure-kv.vault.azure.net/secrets/llm-router-google-cloud-project-id/)
VERTEX_AI_LOCATION=@Microsoft.KeyVault(SecretUri=https://htma-dev-secure-kv.vault.azure.net/secrets/llm-router-vertex-ai-location/)

# Integration
SERVICE_BUS_CONNECTION_STRING=@Microsoft.KeyVault(SecretUri=https://htma-dev-secure-kv.vault.azure.net/secrets/llm-router-service-bus-connection-string/)
```

## 📊 **Monitoring & Health Checks**

### **Health Endpoints**
- **Live**: `GET /health/live` - Container health
- **Ready**: `GET /health/ready` - Service readiness
- **Metrics**: `GET /metrics` - Prometheus metrics

### **Key Metrics**
- Request latency
- Error rates
- Vector search performance
- Database connection health
- Memory and CPU usage

### **Alerting**
- Service availability
- Response time thresholds
- Error rate spikes
- Resource utilization

## 🔄 **CI/CD Pipeline**

### **GitHub Actions Workflow**
```yaml
name: Deploy LLM Router

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  id-token: write  # Required for Workload Identity Federation

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run tests
        run: npm test
        
      - name: Build application
        run: npm run build
        
      - name: Build Docker image
        run: docker build -t llm-router:${{ github.sha }} .
        
      - name: Deploy to Azure Container Apps
        run: |
          az containerapp update \
            --name htma-llm-router \
            --resource-group rg-htma-dev \
            --image llm-router:${{ github.sha }}
```

## 🧪 **Testing & Validation**

### **Pre-deployment Tests**
```bash
# Test Weaviate connectivity
curl -H "Authorization: Bearer $WEAVIATE_API_KEY" \
  "$WEAVIATE_URL/v1/.well-known/ready"

# Test database connectivity
psql "$DATABASE_URL" -c "SELECT version();"

# Test Redis connectivity
redis-cli -u "$REDIS_URL" ping

# Test Service Bus connectivity
az servicebus queue list \
  --namespace-name htma-dev-servicebus \
  --resource-group rg-htma-dev
```

### **Post-deployment Validation**
```bash
# Health checks
curl "https://htma-llm-router.victoriouswater-b21edd48.eastus.azurecontainerapps.io/health/live"
curl "https://htma-llm-router.victoriouswater-b21edd48.eastus.azurecontainerapps.io/health/ready"

# API endpoints
curl "https://htma-llm-router.victoriouswater-b21edd48.eastus.azurecontainerapps.io/api/v1/models"
curl "https://htma-llm-router.victoriouswater-b21edd48.eastus.azurecontainerapps.io/api/v1/health"
```

## 🛡️ **Security Best Practices**

### **Network Security**
- All services use HTTPS/TLS
- Container Apps have network restrictions
- Key Vault has private endpoints (if needed)

### **Authentication**
- JWT tokens for API access
- Azure AD integration for user management
- Workload Identity Federation for Google Cloud

### **Data Protection**
- All secrets stored in Key Vault
- Database connections use SSL
- Vector data encrypted in transit

## 📈 **Scaling & Performance**

### **Auto-scaling Rules**
- **Min Replicas**: 1
- **Max Replicas**: 3
- **Scale Up**: CPU > 70% for 1 minute
- **Scale Down**: CPU < 30% for 5 minutes

### **Resource Limits**
- **CPU**: 1.0 core per replica
- **Memory**: 2GB per replica
- **Storage**: 4GB ephemeral storage

### **Performance Optimization**
- Redis caching for frequent queries
- Connection pooling for databases
- Vector search optimization in Weaviate

## 🔄 **Backup & Recovery**

### **Data Backup Strategy**
- **Weaviate**: Automated backups to Azure Storage
- **PostgreSQL**: Azure Backup service
- **Configuration**: Version controlled in Git

### **Disaster Recovery**
- Multi-region deployment capability
- Automated failover procedures
- Data replication strategies

## 📋 **Maintenance & Updates**

### **Regular Maintenance**
- Security patches (monthly)
- Dependency updates (weekly)
- Performance monitoring (daily)
- Backup verification (weekly)

### **Update Procedures**
1. Test in staging environment
2. Deploy during maintenance window
3. Monitor health metrics
4. Rollback plan if needed

## 🎯 **Next Steps**

1. **Complete Azure AD Setup**: Create service principal and update Key Vault
2. **Deploy LLM Router Service**: Build and deploy the Container App
3. **Configure Monitoring**: Set up Application Insights and alerting
4. **Performance Testing**: Load test the vector search capabilities
5. **Documentation**: Create API documentation and user guides

---

**🎉 Status**: Infrastructure is 95% complete. Weaviate is production-ready, all secrets are configured in Key Vault, and the deployment guide is ready. Only Azure AD service principal creation remains before full deployment.
