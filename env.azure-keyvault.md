# 🔐 LLM Router Service - Azure Key Vault Configuration

## 📋 **Overview**

This document describes how to configure the LLM Router service using Azure Key Vault secrets. All sensitive configuration values are now stored securely in Azure Key Vault and can be accessed by the service.

## 🏗️ **Azure Key Vault Secrets Added**

The following secrets have been added to the Azure Key Vault `htma-dev-secure-kv`:

### **Database Configuration**
- **`llm-router-database-url`**: PostgreSQL connection string for LLM Router database
- **`llm-router-redis-url`**: Redis connection string for caching

### **Azure AD Authentication**
- **`llm-router-azure-tenant-id`**: Azure AD tenant ID (configured)
- **`llm-router-azure-client-id`**: Service principal client ID (placeholder)
- **`llm-router-azure-client-secret`**: Service principal secret (placeholder)

### **Google Cloud Configuration**
- **`llm-router-google-cloud-project-id`**: GCP project ID (placeholder)
- **`llm-router-google-application-credentials`**: Service account key JSON (placeholder)

### **Security & Integration**
- **`llm-router-jwt-secret`**: JWT signing secret (auto-generated)
- **`llm-router-service-bus-connection-string`**: Service Bus connection (placeholder)

## 🔧 **Configuration Steps**

### **Step 1: Update Placeholder Values**

The following secrets need to be updated with actual values:

#### **Azure Service Principal**
```bash
# Create service principal for LLM Router
az ad sp create-for-rbac \
  --name "htma-llm-router" \
  --role "Contributor" \
  --scopes "/subscriptions/98f43dcc-3139-41bb-a50b-a2fb1b08ef62/resourceGroups/rg-htma-dev"

# Update Key Vault secrets
az keyvault secret set \
  --vault-name htma-dev-secure-kv \
  --name "llm-router-azure-client-id" \
  --value "ACTUAL_CLIENT_ID_FROM_SERVICE_PRINCIPAL"

az keyvault secret set \
  --vault-name htma-dev-secure-kv \
  --name "llm-router-azure-client-secret" \
  --value "ACTUAL_CLIENT_SECRET_FROM_SERVICE_PRINCIPAL"
```

#### **Google Cloud Project**
```bash
# Set your GCP project ID
az keyvault secret set \
  --vault-name htma-dev-secure-kv \
  --name "llm-router-google-cloud-project-id" \
  --value "your-actual-gcp-project-id"

# Create service account and download key
gcloud iam service-accounts create htma-llm-router \
  --display-name="HTMA LLM Router Service Account"

gcloud projects add-iam-policy-binding your-project-id \
  --member="serviceAccount:htma-llm-router@your-project-id.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

gcloud iam service-accounts keys create key.json \
  --iam-account=htma-llm-router@your-project-id.iam.gserviceaccount.com

# Upload service account key to Key Vault
az keyvault secret set \
  --vault-name htma-dev-secure-kv \
  --name "llm-router-google-application-credentials" \
  --file key.json
```

#### **Service Bus Connection String**
```bash
# Get Service Bus connection string
SERVICE_BUS_CONNECTION=$(az servicebus namespace authorization-rule keys list \
  --resource-group rg-htma-dev \
  --namespace-name htma-dev-servicebus \
  --name RootManageSharedAccessKey \
  --query primaryConnectionString -o tsv)

# Update Key Vault
az keyvault secret set \
  --vault-name htma-dev-secure-kv \
  --name "llm-router-service-bus-connection-string" \
  --value "$SERVICE_BUS_CONNECTION"
```

### **Step 2: Create Environment File**

Create a `.env` file that references Key Vault secrets:

```bash
# LLM Router Service Environment Configuration
PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# Database Configuration (from Key Vault)
DATABASE_URL=@Microsoft.KeyVault(SecretUri=https://htma-dev-secure-kv.vault.azure.net/secrets/llm-router-database-url/)
REDIS_URL=@Microsoft.KeyVault(SecretUri=https://htma-dev-secure-kv.vault.azure.net/secrets/llm-router-redis-url/)

# Azure AD Configuration (from Key Vault)
AZURE_TENANT_ID=@Microsoft.KeyVault(SecretUri=https://htma-dev-secure-kv.vault.azure.net/secrets/llm-router-azure-tenant-id/)
AZURE_CLIENT_ID=@Microsoft.KeyVault(SecretUri=https://htma-dev-secure-kv.vault.azure.net/secrets/llm-router-azure-client-id/)
AZURE_CLIENT_SECRET=@Microsoft.KeyVault(SecretUri=https://htma-dev-secure-kv.vault.azure.net/secrets/llm-router-azure-client-secret/)
AZURE_AD_INSTANCE=https://login.microsoftonline.com/
AZURE_AD_AUDIENCE=api://htma-llm-router
SERVICE_AUTH_ENABLED=true
JWT_SECRET=@Microsoft.KeyVault(SecretUri=https://htma-dev-secure-kv.vault.azure.net/secrets/llm-router-jwt-secret/)

# Google Cloud Configuration (from Key Vault)
GOOGLE_CLOUD_PROJECT_ID=@Microsoft.KeyVault(SecretUri=https://htma-dev-secure-kv.vault.azure.net/secrets/llm-router-google-cloud-project-id/)
GOOGLE_APPLICATION_CREDENTIALS=@Microsoft.KeyVault(SecretUri=https://htma-dev-secure-kv.vault.azure.net/secrets/llm-router-google-application-credentials/)
VERTEX_AI_LOCATION=us-east1

# Service Bus Configuration (from Key Vault)
SERVICE_BUS_CONNECTION_STRING=@Microsoft.KeyVault(SecretUri=https://htma-dev-secure-kv.vault.azure.net/secrets/llm-router-service-bus-connection-string/)

# Service Configuration
MAX_FILE_SIZE=50MB
ALLOWED_FILE_TYPES=pdf,docx,txt,csv,jpg,png,py,js,ts,json
MAX_REQUEST_SIZE=10MB
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Routing Configuration
ROUTING_CONFIG_FILE=config/routing-priorities.json
CONFIG_RELOAD_INTERVAL=300
CONFIG_VALIDATION_ENABLED=true
CONFIG_BACKUP_ENABLED=true
CONFIG_BACKUP_RETENTION=7

# Model Configuration
DEFAULT_MODEL=claude-4.1-opus
FALLBACK_MODEL=claude-4-sonnet
MAX_TOKENS=8192
TEMPERATURE=0.7
TOP_P=0.9

# Monitoring & Analytics
ENABLE_METRICS=true
METRICS_PORT=9090
ENABLE_HEALTH_CHECKS=true
HEALTH_CHECK_INTERVAL=30000

# Caching Configuration
CACHE_TTL=3600
CACHE_MAX_KEYS=10000
ENABLE_RESPONSE_CACHE=true
ENABLE_ROUTING_CACHE=true

# Security Configuration
ENABLE_CORS=true
CORS_ORIGIN=*
ENABLE_HELMET=true
ENABLE_RATE_LIMITING=true
ENABLE_REQUEST_LOGGING=true

# Development Configuration
ENABLE_SWAGGER=false
```

### **Step 3: Database Setup**

Create the LLM Router database and enable pgvector:

```sql
-- Connect to PostgreSQL
psql -h htma-postgres-dev.postgres.database.azure.com -U htmaadmin -d postgres

-- Create database
CREATE DATABASE htma_llm_router;

-- Connect to new database
\c htma_llm_router;

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create basic tables (if needed)
CREATE TABLE IF NOT EXISTS llm_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255),
  model_name VARCHAR(100),
  request_tokens INTEGER,
  response_tokens INTEGER,
  latency_ms INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create vector table for embeddings
CREATE TABLE IF NOT EXISTS document_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id VARCHAR(255),
  content_hash VARCHAR(64),
  embedding vector(1536),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_document_embeddings_vector 
ON document_embeddings 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

## 🚀 **Deployment Configuration**

### **Container App Environment Variables**

When deploying the LLM Router service, use these Key Vault references:

```yaml
# Container App environment variables
env:
  - name: DATABASE_URL
    secretRef: llm-router-database-url
  - name: REDIS_URL
    secretRef: llm-router-redis-url
  - name: AZURE_TENANT_ID
    secretRef: llm-router-azure-tenant-id
  - name: AZURE_CLIENT_ID
    secretRef: llm-router-azure-client-id
  - name: AZURE_CLIENT_SECRET
    secretRef: llm-router-azure-client-secret
  - name: JWT_SECRET
    secretRef: llm-router-jwt-secret
  - name: GOOGLE_CLOUD_PROJECT_ID
    secretRef: llm-router-google-cloud-project-id
  - name: GOOGLE_APPLICATION_CREDENTIALS
    secretRef: llm-router-google-application-credentials
  - name: SERVICE_BUS_CONNECTION_STRING
    secretRef: llm-router-service-bus-connection-string
```

### **Key Vault Access Policy**

Ensure the Container App has access to Key Vault:

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

## 🔍 **Verification Commands**

### **Check Key Vault Secrets**
```bash
# List all LLM Router secrets
az keyvault secret list \
  --vault-name htma-dev-secure-kv \
  --query "[?contains(name, 'llm-router')].name" \
  --output table

# Verify specific secret
az keyvault secret show \
  --vault-name htma-dev-secure-kv \
  --name "llm-router-database-url"
```

### **Test Database Connection**
```bash
# Test PostgreSQL connection
psql -h htma-postgres-dev.postgres.database.azure.com \
  -U htmaadmin \
  -d htma_llm_router \
  -c "SELECT version();"

# Test Redis connection
redis-cli -h htma-dev-redis.redis.cache.windows.net \
  -p 6380 \
  -a "$(az keyvault secret show --vault-name htma-dev-secure-kv --name postgres-admin-password --query value -o tsv)" \
  ping
```

## 📋 **Next Steps**

1. **Update Placeholder Values**: Replace all placeholder secrets with actual values
2. **Create Database**: Set up the PostgreSQL database with pgvector extension
3. **Configure Google Cloud**: Set up Vertex AI project and service account
4. **Deploy Service**: Use Terraform to deploy the LLM Router Container App
5. **Test Integration**: Verify all services can access Key Vault secrets

## 🔐 **Security Notes**

- All secrets are stored in Azure Key Vault with proper access controls
- Secrets are automatically rotated and managed by Azure
- Container Apps use managed identities for secure access
- No secrets are stored in code or configuration files
- All sensitive data is encrypted at rest and in transit

---

**🎯 Status**: Key Vault secrets have been created and are ready for configuration. Update the placeholder values and proceed with service deployment.
