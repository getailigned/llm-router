# LLM Router Microservice

> **Intelligent LLM routing for optimal performance, cost, and quality across Google Cloud Vertex AI**

## 🎯 **What is LLM Router?**

The LLM Router is an intelligent microservice that automatically routes Large Language Model (LLM) requests to the most suitable Vertex AI model based on:

- **Use Case**: Task type and complexity requirements
- **Performance**: Latency and quality optimization
- **Cost**: Budget-conscious model selection
- **Availability**: Load balancing and failover handling

## 🚀 **Key Features**

- **Smart Routing**: AI-powered model selection for each request
- **Cost Optimization**: 20-30% reduction in LLM operational costs
- **Performance Monitoring**: Real-time latency and quality tracking
- **Analytics Dashboard**: Comprehensive insights for optimization
- **Load Balancing**: Intelligent traffic distribution across models
- **Failover Handling**: Automatic fallback to alternative models
- **RAG Capabilities**: Retrieval-Augmented Generation with vector search
- **Semantic Analysis**: Hugging Face models via Vertex AI
- **Unified Provider**: Single Vertex AI interface for all models
- **Service Authentication**: Secure JWT-based microservice authentication
- **Intelligent Categorization**: Automatic request analysis and classification
- **Attachment Analysis**: File type, size, and sensitivity assessment
- **Security Compliance**: Built-in security controls and audit logging
- **Dynamic Configuration**: Hot-reloadable routing priorities and rules
- **Environment Overrides**: Flexible configuration via environment variables
- **Admin Dashboard**: Comprehensive real-time monitoring and analytics
- **Business Intelligence**: Cost optimization and performance insights

## 🏗️ **Architecture**

```
Client App → LLM Router → Vertex AI (Unified)
                ↓
         Analytics Database
```

## 📊 **Supported LLM Models**

### **Google Cloud Vertex AI:**
- **Gemini Pro**: General-purpose tasks
- **Gemini Pro Vision**: Multimodal tasks
- **Gemini Flash**: Fast, cost-effective responses
- **Codey**: Code generation and analysis
- **Imagen**: Image generation and editing
- **PaLM 2**: Text generation and analysis
- **Chat-Bison**: Conversational AI

### **Anthropic Claude:**
- **Claude 4.1 Opus**: Latest generation, highest quality for complex reasoning
- **Claude 4 Sonnet**: Latest generation, balanced performance for most tasks
- **Claude 3.5 Sonnet**: Fast, balanced performance
- **Claude 3.5 Haiku**: Ultra-fast, cost-effective
- **Claude 3 Opus**: High quality reasoning
- **Claude 3 Sonnet**: Balanced performance
- **Claude 3 Haiku**: Fast and efficient

### **Specialized Capabilities:**
- **RAG Operations**: Document retrieval and context augmentation with Claude 4.1 Opus, Claude 4 Sonnet
- **Semantic Analysis**: Text classification, NER, and embeddings via Vertex AI
- **Vector Search**: Azure PostgreSQL with pgvector extension
- **Custom Models**: Hugging Face and fine-tuned models via Vertex AI
- **Unified Access**: Single interface for Google, Anthropic (Claude 4.1 Opus, Claude 4 Sonnet), and Hugging Face models

## 🛠️ **Technology Stack**

- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **Database**: Azure PostgreSQL + Azure Redis
- **Cloud**: Google Cloud Vertex AI (Unified)
- **AI/ML**: Hugging Face & Anthropic via Vertex AI + Azure PostgreSQL pgvector
- **Monitoring**: Azure Monitor + Application Insights
- **Security**: Azure AD JWT authentication + Azure RBAC integration
- **File Processing**: Multi-format attachment analysis and validation

## 📋 **Quick Start**

### Prerequisites
- Google Cloud account with Vertex AI enabled
- Node.js 18+ and npm
- PostgreSQL database
- Redis instance

### Installation
```bash
# Clone the repository
git clone https://github.com/getailigned/llm-router.git
cd llm-router

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Run the service
npm run dev
```

### Environment Configuration
```bash
# Google Cloud (Unified)
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=path/to/credentials.json
VERTEX_AI_LOCATION=us-central1

# Azure AD Security & Authentication
AZURE_TENANT_ID=your-azure-tenant-id
AZURE_CLIENT_ID=your-service-principal-client-id
AZURE_CLIENT_SECRET=your-service-principal-secret
AZURE_AD_INSTANCE=https://login.microsoftonline.com/
AZURE_AD_AUDIENCE=api://your-llm-router-app-id
SERVICE_AUTH_ENABLED=true
MAX_FILE_SIZE=50MB
ALLOWED_FILE_TYPES=pdf,docx,txt,csv,jpg,png,py,js,ts,json

# Azure Database
DATABASE_URL=postgresql://user:pass@azure-postgresql-host:5432/htma_llm_router
REDIS_URL=redis://azure-redis-host:6379

# Vector Storage
POSTGRES_VECTOR_EXTENSION=pgvector
VECTOR_DIMENSION=1536

# Routing Configuration
ROUTING_CONFIG_FILE=config/routing-priorities.json
CONFIG_RELOAD_INTERVAL=300
CONFIG_VALIDATION_ENABLED=true
CONFIG_BACKUP_ENABLED=true

# Admin Dashboard
ADMIN_DASHBOARD_ENABLED=true
DASHBOARD_PORT=3001
WEBSOCKET_ENABLED=true
REAL_TIME_UPDATE_INTERVAL=5000  # 5 seconds

# Service
PORT=3000
NODE_ENV=development

### Configuration Examples

#### **Quick Priority Override:**
```bash
# Set Claude 4.1 Opus as top priority
export ROUTING_PRIORITY_1=claude-4.1-opus
export CLAUDE_4_1_OPUS_WEIGHT=0.40

# Restart service or send SIGHUP
kill -HUP <pid>
```

#### **Task-Specific Routing:**
```bash
# Route complex reasoning to latest models
export COMPLEX_REASONING_MODELS=claude-4.1-opus,claude-4-sonnet
export RAG_OPERATIONS_MODELS=claude-4.1-opus,claude-4-sonnet
```

## 📚 **Documentation**

- **[Complete Roadmap](LLM_ROUTER_ROADMAP.md)** - Detailed planning and development phases
- **API Reference** - Coming soon
- **Configuration Guide** - Coming soon
- **Deployment Guide** - Coming soon

## 🔄 **API Endpoints**

```
# Core Routing
POST /api/v1/route          # Route LLM request with authentication
GET  /api/v1/models         # List available models
GET  /api/v1/health         # Service health check

# Authentication & Security
POST /api/v1/auth/login     # Service authentication
POST /api/v1/auth/refresh   # Refresh JWT token
GET  /api/v1/auth/validate  # Validate service token

# Request Analysis
POST /api/v1/analyze        # Analyze request content and attachments
GET  /api/v1/categories     # Get request categorization options
POST /api/v1/classify       # Classify request type and requirements

# RAG & Semantic Analysis
POST /api/v1/rag/query      # RAG-enabled query processing
POST /api/v1/rag/ingest     # Ingest documents for RAG
GET  /api/v1/rag/documents  # List available documents
POST /api/v1/semantic/analyze # Semantic text analysis
POST /api/v1/semantic/embed  # Generate text embeddings
POST /api/v1/semantic/similarity # Calculate text similarity

# Analytics & Monitoring
GET  /api/v1/analytics      # Get performance analytics
POST /api/v1/feedback       # Submit quality feedback
GET  /api/v1/audit          # Get security audit logs

# Configuration Management
GET  /api/v1/config/current           # Get current configuration
POST /api/v1/config/routing-priorities # Update routing priorities
POST /api/v1/config/task-routing     # Update task routing rules
POST /api/v1/config/reload           # Reload configuration
POST /api/v1/config/validate         # Validate configuration
POST /api/v1/config/reset            # Reset to defaults

# Admin Dashboard
GET  /api/v1/admin/dashboard          # Main dashboard data
GET  /api/v1/admin/real-time         # Real-time monitoring data
GET  /api/v1/admin/analytics         # Detailed analytics
GET  /api/v1/admin/security          # Security and compliance data
GET  /api/v1/admin/configuration     # Configuration management data
GET  /api/v1/admin/business-intel    # Business intelligence data
GET  /api/v1/admin/export            # Export data for external analysis
POST /api/v1/admin/alerts            # Configure alerting rules
```

## 📈 **Success Metrics**

- **Response Time**: < 100ms routing decisions
- **Availability**: 99.9% uptime
- **Cost Reduction**: 20-30% LLM cost savings
- **Quality Improvement**: 15-25% response quality boost

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 **Support**

- **Issues**: [GitHub Issues](https://github.com/getailigned/llm-router/issues)
- **Discussions**: [GitHub Discussions](https://github.com/getailigned/llm-router/discussions)
- **Documentation**: [Wiki](https://github.com/getailigned/llm-router/wiki)

---

**Built with ❤️ by the HTMA Platform Team**
