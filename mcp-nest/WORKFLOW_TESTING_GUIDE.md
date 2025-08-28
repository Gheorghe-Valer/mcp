# n8n Workflow Testing Guide

## Webhook URL
Your workflow is now available at:
```
https://your-n8n-domain/webhook/sapui5-chat
```

## Test with cURL

### 1. Basic Service Discovery
```bash
curl -X POST https://your-n8n-domain/webhook/sapui5-chat \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What OData services are available?",
    "userId": "test_user"
  }'
```

### 2. Specific Data Query
```bash
curl -X POST https://your-n8n-domain/webhook/sapui5-chat \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Show me products from the Northwind service",
    "userId": "test_user",
    "sessionId": "test-session-123"
  }'
```

### 3. With Context (SAPUI5-style)
```bash
curl -X POST https://your-n8n-domain/webhook/sapui5-chat \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Get customer information",
    "userId": "sales_rep",
    "sessionId": "ui5-session-456",
    "context": {
      "currentView": "CustomerList",
      "module": "sales"
    }
  }'
```

## Expected Response Format
```json
{
  "success": true,
  "data": {
    "response": "Here are the available OData services...",
    "type": "ai_response",
    "query": "What OData services are available?",
    "confidence": 0.95,
    "toolUsed": "guidance",
    "suggestions": [
      "Show me products",
      "What customer data is available?"
    ]
  },
  "metadata": {
    "workflowId": "sapui5-mcp-1693234567890",
    "timestamp": "2024-08-27T14:30:00.000Z",
    "processingTime": 1250,
    "source": "n8n-mcp-gemini-workflow"
  },
  "status": {
    "code": 200,
    "message": "Request processed successfully"
  }
}
```

## SAPUI5 Integration Example
```javascript
// In your SAPUI5 controller
queryMCPWorkflow: async function(userQuery) {
  try {
    const response = await fetch("https://your-n8n-domain/webhook/sapui5-chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query: userQuery,
        userId: this.getCurrentUser(),
        sessionId: this.getSessionId(),
        context: {
          currentView: this.getView().getViewName(),
          timestamp: new Date().toISOString()
        }
      })
    });

    const result = await response.json();
    
    if (result.success) {
      this.displayResponse(result.data.response);
      this.showSuggestions(result.data.suggestions);
    }
  } catch (error) {
    console.error("Workflow query failed:", error);
  }
}
```

## What the Workflow Does

1. **Processes SAPUI5 input** - extracts query, user info, context
2. **Initializes MCP session** - connects to your MCP server
3. **Discovers available tools** - gets all MCP tools dynamically  
4. **Connects to OData systems** - establishes system connections
5. **Gets available services** - retrieves OData service metadata
6. **AI analysis** - Gemini AI decides best action for user query
7. **Conditional execution**:
   - **Tool execution**: Runs specific MCP tool if query is actionable
   - **Guidance**: Provides help and suggestions if query is general
8. **Response formatting** - Converts technical responses to business-friendly language
9. **SAPUI5 response** - Returns structured data ready for UI consumption

Your SAPUI5 to MCP bridge with Gemini AI is now fully operational! 🎉