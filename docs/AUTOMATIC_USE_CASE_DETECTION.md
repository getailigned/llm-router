# Automatic Use Case Detection for LLM Models

## 🎯 **Overview**

The Automatic Use Case Detection system intelligently analyzes each LLM model and determines the optimal use cases based on:

- **Model Capabilities** (RAG, code generation, multimodal, etc.)
- **Performance Metrics** (quality, latency, success rate)
- **Cost Analysis** (per-token pricing, cost tolerance)
- **Provider Strengths** (Vertex AI, Anthropic, OpenAI)

## 🧠 **How It Works**

### **1. Multi-Dimensional Scoring**

Each model is scored across three dimensions:

#### **Capability Score (40% weight)**
- Checks if model meets specific capability requirements
- Examples: `complex-reasoning`, `multimodal`, `code-generation`
- Score: 0-1 based on requirements met

#### **Performance Score (35% weight)**
- Quality requirements (min quality threshold)
- Latency requirements (max acceptable latency)
- Success rate evaluation
- Score: 0-1 based on performance metrics

#### **Cost Score (25% weight)**
- Cost tolerance matching (`very-low`, `low`, `medium`, `high`)
- Per-token pricing analysis
- Score: 0-1 based on cost efficiency

### **2. Use Case Requirements**

Each use case has specific requirements:

```typescript
'complex-reasoning': {
  requirements: ['complex-reasoning', 'advanced-rag', 'high-quality'],
  minQuality: 0.9,
  maxLatency: 15000,
  costTolerance: 'high',
  description: 'Complex analytical tasks requiring deep reasoning'
}
```

### **3. Intelligent Capability Detection**

The system automatically detects capabilities from:

- **Model names** (e.g., "opus" → complex-reasoning)
- **Explicit capabilities** (e.g., multimodal, code-generation)
- **Performance indicators** (e.g., high quality score → high-quality)
- **Provider patterns** (e.g., Claude models → RAG capabilities)

## 📊 **Use Case Categories**

### **🥇 Primary Use Cases**
- Top 3 best-fit use cases for each model
- Overall score > 0.6
- Excellent capability, performance, and cost match

### **🥈 Secondary Use Cases**
- Good alternative use cases
- Overall score 0.4-0.6
- Moderate capability, performance, and cost match

### **🎯 Specialized Use Cases**
- Niche use cases where model excels
- Overall score 0.3-0.4
- Specific capability strengths

### **⚠️ Avoid Use Cases**
- Use cases where model performs poorly
- Overall score < 0.3
- Missing required capabilities

## 🔍 **Automatic Analysis Process**

### **Step 1: Model Discovery**
```typescript
// Discover all available models
const discoveredModels = await dynamicModelDiscoveryService.discoverModels();
```

### **Step 2: Pricing Retrieval**
```typescript
// Get real-time pricing for all models
const pricingMap = await dynamicPricingService.getBulkPricing(modelIds);
```

### **Step 3: Use Case Analysis**
```typescript
// Analyze use cases for all models
const useCaseAnalysis = await useCaseAnalysisService.analyzeModelUseCases(discoveredModels);
```

### **Step 4: Intelligent Routing**
```typescript
// Get optimal model for specific use case
const optimalModel = useCaseAnalysisService.getOptimalModelForUseCase('complex-reasoning', analysis);
```

## 🎯 **Supported Use Cases**

### **High-Complexity Tasks**
- **complex-reasoning**: Deep analytical reasoning
- **strategic-planning**: Long-term strategic decisions
- **research-analysis**: Comprehensive research tasks

### **Business Operations**
- **business-intelligence**: Data analysis and insights
- **document-processing**: Document analysis and extraction
- **rag-operations**: Retrieval-augmented generation

### **Technical Tasks**
- **code-generation**: Software development
- **technical-docs**: Technical writing
- **code-analysis**: Code review and analysis

### **Performance-Optimized**
- **fast-response**: Quick response requirements
- **cost-sensitive**: Budget-conscious operations
- **multimodal**: Image and text processing

### **Creative Tasks**
- **creative-generation**: Content creation
- **documentation**: Writing and documentation

## 📈 **Scoring Algorithm**

### **Overall Score Calculation**
```typescript
overallScore = (capabilityScore * 0.4) + (performanceScore * 0.35) + (costScore * 0.25)
```

### **Capability Scoring**
```typescript
capabilityScore = matchedRequirements / totalRequirements
```

### **Performance Scoring**
```typescript
performanceScore = (qualityScore + latencyScore + successRateScore) / factors
```

### **Cost Scoring**
```typescript
costScore = costToleranceMatch(avgCost, tolerance)
```

## 🚀 **Usage Examples**

### **Example 1: Get Best Model for Complex Reasoning**
```typescript
const bestModel = useCaseAnalysisService.getOptimalModelForUseCase('complex-reasoning', analysis);
console.log(`Best model: ${bestModel.displayName}`);
```

### **Example 2: Get All Models for Code Generation**
```typescript
const codeModels = useCaseAnalysisService.getModelsForUseCase('code-generation', analysis);
codeModels.forEach((model, index) => {
  console.log(`${index + 1}. ${model.displayName} (${model.provider})`);
});
```

### **Example 3: Analyze Specific Model**
```typescript
const modelAnalysis = useCaseAnalysis.get('model-id');
console.log('Primary use cases:', modelAnalysis.primaryUseCases.map(uc => uc.useCase));
console.log('Avoid use cases:', modelAnalysis.avoidUseCases);
```

## 🔧 **Configuration**

### **Use Case Definitions**
```typescript
const USE_CASES = {
  'use-case-name': {
    requirements: ['capability1', 'capability2'],
    minQuality: 0.8,
    maxLatency: 10000,
    costTolerance: 'medium'
  }
};
```

### **Scoring Weights**
```typescript
// Adjustable weights for different factors
const CAPABILITY_WEIGHT = 0.4;    // 40%
const PERFORMANCE_WEIGHT = 0.35;  // 35%
const COST_WEIGHT = 0.25;         // 25%
```

### **Thresholds**
```typescript
const MIN_VIABLE_SCORE = 0.3;     // Minimum score to include
const PRIMARY_USE_CASE_LIMIT = 3;  // Top 3 primary use cases
const SECONDARY_USE_CASE_LIMIT = 3; // Top 3 secondary use cases
```

## 📊 **Output Format**

### **Use Case Profile**
```typescript
interface UseCaseProfile {
  useCase: string;
  confidence: number;
  reasoning: string[];
  performanceScore: number;
  costScore: number;
  capabilityScore: number;
  overallScore: number;
}
```

### **Model Analysis**
```typescript
interface ModelUseCaseMapping {
  modelId: string;
  displayName: string;
  provider: string;
  primaryUseCases: UseCaseProfile[];
  secondaryUseCases: UseCaseProfile[];
  specializedUseCases: UseCaseProfile[];
  avoidUseCases: string[];
  recommendations: string[];
}
```

## 🧪 **Testing**

### **Run Use Case Analysis Test**
```bash
cd llm-router
npx ts-node src/test-use-case-analysis.ts
```

### **Expected Output**
```
🚀 Starting Automatic Use Case Analysis Test

📋 Step 1: Discovering Models from Google Cloud...
✅ Discovered 9 models

💰 Step 2: Retrieving Real-time Pricing...
✅ Retrieved pricing for 9 models

🧠 Step 3: Analyzing Use Cases for Each Model...
✅ Completed use case analysis for 9 models

📊 Step 4: Comprehensive Use Case Analysis Results
================================================================================

🔹 Model: Claude 4.1 Opus (anthropic)
   ID: claude-4.1-opus

   🥇 PRIMARY USE CASES:
      • complex-reasoning (Score: 95.2%)
        Confidence: 95.0%
        Capability: 100.0%
        Performance: 95.0%
        Cost: 90.0%
        Reasoning:
          - Excellent capability match: 3/3 requirements met
          - Quality requirement met: 0.95 >= 0.9
          - Latency requirement met: 1000ms <= 15000ms

   🥈 SECONDARY USE CASES:
      • strategic-planning (Score: 92.1%)
      • research-analysis (Score: 89.8%)

   💡 RECOMMENDATIONS:
      • Primary use case: complex-reasoning (Score: 95.2%)
      • Use for high-value, complex tasks
      • Versatile model - good for multiple use cases
```

## 🔄 **Automatic Updates**

### **Real-Time Discovery**
- Models are discovered automatically when deployed
- No manual configuration required
- New capabilities automatically detected

### **Dynamic Pricing**
- Pricing updates automatically
- Cost analysis reflects current rates
- Confidence scoring based on data freshness

### **Performance Monitoring**
- Real-time performance metrics
- Quality scores updated automatically
- Latency and success rate tracking

## 🎯 **Benefits**

### **1. Automatic Optimization**
- No manual use case assignment
- Models automatically categorized
- Optimal routing decisions

### **2. Cost Efficiency**
- Cost-aware model selection
- Budget optimization
- ROI maximization

### **3. Performance Optimization**
- Quality-based routing
- Latency optimization
- Success rate improvement

### **4. Scalability**
- New models automatically analyzed
- Use cases automatically detected
- System scales with infrastructure

## 🚀 **Next Steps**

1. **Deploy the services** to your LLM Router
2. **Run the test script** to see automatic analysis
3. **Monitor routing decisions** based on use case analysis
4. **Customize use case definitions** for your specific needs
5. **Adjust scoring weights** based on your priorities

## 💡 **Best Practices**

1. **Regular Testing**: Run analysis tests after deploying new models
2. **Monitor Confidence**: Use confidence scores to identify data quality issues
3. **Review Reasoning**: Check reasoning logs to understand model assignments
4. **Customize Use Cases**: Add domain-specific use cases as needed
5. **Performance Tuning**: Adjust thresholds based on your requirements

The Automatic Use Case Detection system provides intelligent, data-driven model selection that continuously optimizes your LLM routing decisions! 🎉
