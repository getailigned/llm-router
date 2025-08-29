# 🚀 Enhanced Routing Examples: Text + Attachments

## 📋 Overview

The LLM Router now uses **intelligent semantic analysis** that considers **both** the request text AND attachments to determine the optimal routing category. This ensures that the actual subject matter (often in attachments) drives routing decisions, not just the instructions.

## 🔍 How It Works

### **1. Dual Analysis Approach**
- **Text Analysis**: Understands user instructions and context
- **Attachment Analysis**: Identifies the actual subject matter and content type
- **Combined Scoring**: Merges both analyses for optimal routing decisions

### **2. Attachment-Driven Domain Detection**
- **Filename Analysis**: Extracts domain indicators from attachment names
- **Content Type Analysis**: Determines file types and processing requirements
- **Size Analysis**: Assesses complexity based on file sizes
- **Extension Analysis**: Identifies programming languages and data formats

### **3. Intelligent Override System**
- **Strong Attachment Signals**: If attachments strongly indicate a domain/task, they can override text-based analysis
- **Confidence Scoring**: Higher confidence attachment analysis takes precedence
- **Context Integration**: Combines text context with attachment content for comprehensive understanding

## 📊 Example Scenarios

### **Example 1: Code Review Request**

#### **Request Text**
```
"Please review this code for best practices and potential improvements."
```

#### **Attachments**
- `main.py` (2KB) - Python code file
- `requirements.txt` (0.5KB) - Dependencies file

#### **Analysis Results**
- **Text Domain**: General (low confidence)
- **Attachment Domain**: Technical (high confidence - 0.9)
- **Text Task Type**: General (low confidence)
- **Attachment Task Type**: Code Generation (high confidence - 0.9)
- **Final Routing**: Technical domain + Code Generation task
- **Model Selection**: Claude 4.1 Opus (expert code analysis)

#### **Why This Works**
The text is generic instructions, but the attachments clearly indicate:
- **Technical domain**: Python code files
- **Code generation task**: Code review and improvement
- **Expert complexity**: Code analysis requires specialized capabilities

### **Example 2: Financial Report Analysis**

#### **Request Text**
```
"Analyze this quarterly report and provide insights on revenue trends."
```

#### **Attachments**
- `Q4_Financial_Report.pdf` (5MB) - Financial document
- `revenue_data.csv` (1MB) - Financial data

#### **Analysis Results**
- **Text Domain**: Financial (medium confidence)
- **Attachment Domain**: Financial (high confidence - 0.9)
- **Text Task Type**: Complex Reasoning (medium confidence)
- **Attachment Task Type**: RAG Operations (high confidence - 0.8)
- **Final Routing**: Financial domain + Complex Reasoning task
- **Model Selection**: Claude 4.1 Opus (expert financial analysis)

#### **Why This Works**
The text mentions "quarterly report" but the attachments confirm:
- **Financial domain**: PDF report + CSV data
- **Complex reasoning**: Large document analysis + data interpretation
- **RAG operations**: Document parsing and data extraction

### **Example 3: Marketing Campaign with Images**

#### **Request Text**
```
"Create a marketing campaign using these brand assets and product images."
```

#### **Attachments**
- `brand_logo.png` (2MB) - Brand logo image
- `product_photo.jpg` (3MB) - Product image
- `campaign_brief.docx` (0.25MB) - Campaign instructions

#### **Analysis Results**
- **Text Domain**: Creative (medium confidence)
- **Attachment Domain**: Creative (high confidence - 0.8)
- **Text Task Type**: Creative Generation (medium confidence)
- **Attachment Task Type**: Creative Generation (high confidence - 0.8)
- **Final Routing**: Creative domain + Creative Generation task
- **Model Selection**: Claude 4 Sonnet + Gemini Pro (multimodal + creative)

#### **Why This Works**
The text mentions "marketing campaign" but the attachments confirm:
- **Creative domain**: Images + marketing brief
- **Multimodal requirements**: Image processing + text generation
- **Creative generation**: Campaign creation from visual assets

### **Example 4: Legal Document Review**

#### **Request Text**
```
"Review this contract for compliance with new regulations and identify potential risks."
```

#### **Attachments**
- `contract_agreement.pdf` (10MB) - Legal contract
- `compliance_checklist.xlsx` (2MB) - Compliance requirements

#### **Analysis Results**
- **Text Domain**: Legal (high confidence)
- **Attachment Domain**: Legal (high confidence - 0.9)
- **Text Task Type**: Complex Reasoning (high confidence)
- **Attachment Task Type**: RAG Operations (high confidence - 0.8)
- **Final Routing**: Legal domain + Complex Reasoning task
- **Model Selection**: Claude 4.1 Opus (expert legal analysis)

#### **Why This Works**
The text clearly indicates legal work, and attachments confirm:
- **Legal domain**: Contract + compliance documents
- **Expert complexity**: Large legal documents require specialized analysis
- **RAG operations**: Document parsing and compliance checking

### **Example 5: Healthcare Research Data**

#### **Request Text**
```
"Analyze this clinical trial data and provide insights on patient outcomes."
```

#### **Attachments**
- `clinical_trial_results.csv` (5MB) - Clinical data
- `patient_consent_forms.pdf` (1.5MB) - Patient documents

#### **Analysis Results**
- **Text Domain**: Healthcare (high confidence)
- **Attachment Domain**: Healthcare (high confidence - 0.9)
- **Text Task Type**: Research Analysis (medium confidence)
- **Attachment Task Type**: Complex Reasoning (high confidence - 0.8)
- **Final Routing**: Healthcare domain + Complex Reasoning task
- **Model Selection**: Claude 4.1 Opus (expert healthcare analysis)

#### **Why This Works**
The text mentions clinical trials, and attachments confirm:
- **Healthcare domain**: Clinical data + patient documents
- **Expert complexity**: Medical data analysis requires specialized knowledge
- **Data analysis**: CSV data + document processing

## 🎯 Routing Decision Matrix

### **Domain Detection Priority**
1. **Attachment Domain** (highest priority - 0.9 confidence)
2. **Text Domain** (medium priority - 0.7 confidence)
3. **Combined Analysis** (balanced approach)

### **Task Type Detection Priority**
1. **Attachment Task Type** (highest priority - 0.9 confidence)
2. **Text Task Type** (medium priority - 0.7 confidence)
3. **Combined Analysis** (balanced approach)

### **Complexity Assessment Priority**
1. **Attachment Complexity** (highest priority - file size, type, content)
2. **Text Complexity** (medium priority - keywords, length, structure)
3. **Domain Complexity** (context priority - industry requirements)

## 🔧 Technical Implementation

### **Attachment Analysis Methods**

#### **1. Domain Detection**
```typescript
private analyzeAttachmentsForDomain(attachments: any[], reasoning: string[]): { domain: string | null; score: number }
```
- **Filename Analysis**: Extracts domain keywords from attachment names
- **Extension Analysis**: Identifies file types that suggest domains
- **Size Analysis**: Large files suggest complex domains
- **Confidence Scoring**: Higher scores override text-based analysis

#### **2. Task Type Detection**
```typescript
private analyzeAttachmentsForTaskType(attachments: any[], reasoning: string[]): { taskType: string | null; score: number }
```
- **File Type Mapping**: Maps file types to task types
- **Content Analysis**: Analyzes file content for task indicators
- **Size Correlation**: Large files suggest complex tasks
- **Multi-file Analysis**: Combines multiple attachment signals

#### **3. Complexity Assessment**
```typescript
private assessAttachmentComplexityForRouting(attachments: any[], reasoning: string[]): 'simple' | 'moderate' | 'complex' | 'expert'
```
- **Size Analysis**: Total file size and individual file sizes
- **Type Analysis**: Code, data, image, document complexity
- **Combination Analysis**: Multiple file types suggest higher complexity
- **Domain Correlation**: Industry-specific complexity requirements

### **Integration with Routing Service**

#### **1. Enhanced Model Selection**
```typescript
// Perform semantic analysis if not explicitly provided
if (!taskType || !complexity) {
  semanticAnalysis = await semanticAnalysisService.analyzeRequest(
    request.content, 
    metadata, 
    request.attachments  // Pass attachments for analysis
  );
  
  taskType = semanticAnalysis.taskType;
  complexity = semanticAnalysis.complexity;
}
```

#### **2. Domain-Specific Routing**
```typescript
// Get domain-specific routing recommendations
const domainConfig = semanticAnalysis ? 
  semanticAnalysisService.getDomainRoutingRecommendations(semanticAnalysis.domain) : null;

// Try domain-specific models if available
if (domainConfig && semanticAnalysis) {
  for (const modelId of domainConfig.preferredModels) {
    const model = availableModels.find(m => m.id === modelId);
    if (model && this.meetsDomainRequirements(model, domainConfig, semanticAnalysis)) {
      return model;
    }
  }
}
```

## 📈 Benefits of Enhanced Routing

### **1. More Accurate Domain Detection**
- **Text**: "Please analyze this"
- **Attachments**: `financial_report.pdf`, `revenue_data.csv`
- **Result**: Financial domain (not general)

### **2. Better Task Type Identification**
- **Text**: "Help me with this"
- **Attachments**: `main.py`, `requirements.txt`
- **Result**: Code generation task (not general)

### **3. Improved Complexity Assessment**
- **Text**: "Simple question"
- **Attachments**: `10MB_contract.pdf`, `5MB_data.csv`
- **Result**: Expert complexity (not simple)

### **4. Optimal Model Selection**
- **Domain**: Technical (from code files)
- **Task**: Code generation (from Python files)
- **Complexity**: Expert (from large files)
- **Model**: Claude 4.1 Opus (expert code analysis)

### **5. Better Resource Allocation**
- **Small files**: Route to faster, cost-effective models
- **Large files**: Route to expert, high-quality models
- **Code files**: Route to code-specialized models
- **Image files**: Route to multimodal models

## 🚀 Future Enhancements

### **1. Content Analysis**
- **PDF Text Extraction**: Analyze actual document content
- **Image OCR**: Extract text from images for analysis
- **Code Parsing**: Analyze code structure and complexity
- **Data Schema Analysis**: Understand data file structure

### **2. Machine Learning Integration**
- **Historical Pattern Learning**: Learn from previous routing decisions
- **User Preference Learning**: Adapt to user's preferred models
- **Performance Correlation**: Route based on model performance history
- **Cost Optimization**: Learn cost-effective routing patterns

### **3. Advanced File Processing**
- **File Content Analysis**: Deep analysis of file contents
- **Metadata Extraction**: Extract additional context from files
- **Security Scanning**: Identify sensitive content for special handling
- **Format Validation**: Ensure file integrity and compatibility

---

This enhanced routing system transforms the LLM Router from a **text-only analyzer** to a **comprehensive content analyzer** that understands both what users are asking for AND what they're actually working with. 🎯✨
