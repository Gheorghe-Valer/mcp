# SAPUI5 to MCP Tools via Gemini AI - Workflow Guide

## Overview

This n8n workflow creates a bridge between your SAPUI5 application and the MCP (Model Context Protocol) tools running at `https://nest.open-hand.org`, using Gemini AI to intelligently route requests and format responses.

## Workflow Features

### 🎯 **SAPUI5 Integration**
- **Webhook endpoint**: `/sapui5-chat` (POST)
- **CORS enabled** for browser-based SAPUI5 applications
- **Structured input/output** for seamless integration

### 🤖 **Gemini AI Intelligence**
- **Tool selection**: AI determines the best MCP tool for each request
- **Context awareness**: Understands available OData services and tools
- **Response formatting**: Converts technical responses to business-friendly language

### 🔧 **MCP Tools Integration**
- **Dynamic tool discovery**: Lists all available MCP tools
- **System connection**: Connects to OData systems automatically
- **Service discovery**: Gets available OData services
- **Tool execution**: Executes the appropriate MCP tool based on AI decision

## Request Format (from SAPUI5)

```javascript
// POST to: https://n8n.open-hand.org/webhook/sapui5-chat
{
  "query": "Show me all products from the Northwind service",
  "userId": "user123",
  "sessionId": "optional-session-id",
  "context": {
    "currentView": "ProductsList",
    "filters": {...}
  },
  "type": "query"
}
```

## Response Format (to SAPUI5)

```javascript
{
  "success": true,
  "data": {
    "response": "Here are the products from Northwind...",
    "type": "ai_response|tool_result|error",
    "query": "Original user query",
    "confidence": 0.95,
    "toolUsed": "system_query_entity",
    "suggestions": [
      "Would you like to filter by category?",
      "Should I show product details?"
    ]
  },
  "metadata": {
    "workflowId": "sapui5-mcp-gemini-1698765432123",
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

## Available MCP Tools

The workflow automatically discovers and can use these MCP tools:

### System Management
- `system_connect` - Connect to OData systems
- `system_get_services` - List available services
- `system_query_entity` - Query entity data

### OData Operations  
- `odata_service_info` - Get service metadata
- `filter_[EntitySet]_for_[System]` - Filter entity data
- `get_[Entity]_for_[System]` - Get single entity
- `count_[EntitySet]_for_[System]` - Count entities

## Example Queries from SAPUI5

### 1. **Service Discovery**
```javascript
{
  "query": "What OData services are available?",
  "userId": "manager1"
}
```

### 2. **Data Query**
```javascript
{
  "query": "Show me all customers from the business partner service",
  "userId": "sales_rep",
  "context": {
    "module": "customer_management"
  }
}
```

### 3. **Filtered Query**
```javascript
{
  "query": "Get all products with price greater than 50",
  "userId": "analyst",
  "context": {
    "currentFilters": {"minPrice": 50}
  }
}
```

### 4. **Metadata Request**
```javascript
{
  "query": "What fields are available in the Products entity?",
  "userId": "developer"
}
```

## Workflow Nodes Explanation

### 1. **SAPUI5 Webhook Trigger**
- Receives POST requests from SAPUI5 application
- CORS-enabled for browser access
- Validates input structure

### 2. **Process SAPUI5 Input**
- Extracts and validates query parameters
- Generates unique workflow ID for tracking
- Prepares data for processing

### 3. **Initialize MCP Session**
- Establishes connection with MCP server
- Initializes protocol communication
- Sets up client information

### 4. **List Available MCP Tools**
- Discovers all available MCP tools dynamically
- Gets tool descriptions and schemas
- Provides context for AI decision-making

### 5. **Connect to OData Systems**
- Connects to configured OData systems
- Validates system connectivity
- Prepares for data operations

### 6. **Get Available OData Services**
- Lists available OData services
- Provides service metadata
- Enables service-specific queries

### 7. **Gemini AI Tool Selector**
- Analyzes user query in context of available tools
- Determines best tool and arguments
- Provides confidence score and alternatives

### 8. **Execute MCP Tool or Provide Guidance**
- **Tool Execution**: Runs the selected MCP tool
- **General Guidance**: Provides help when no specific tool is needed

### 9. **Format Response**
- Converts technical responses to business language
- Structures data for SAPUI5 consumption
- Adds metadata and suggestions

## Error Handling

The workflow includes comprehensive error handling:

- **Invalid input**: Clear error messages
- **MCP connection issues**: Fallback responses
- **Tool execution failures**: Alternative suggestions
- **AI parsing errors**: Safe defaults

## Setup in n8n

1. **Import the workflow**:
   ```bash
   # Import n8n-workflow-enhanced.json into your n8n instance
   ```

2. **Configure Gemini AI**:
   - Add your Google API key in n8n credentials
   - Configure the Gemini AI nodes

3. **Set webhook URL**:
   - Note the webhook URL: `https://your-n8n.domain/webhook/sapui5-chat`
   - Configure SAPUI5 to call this endpoint

4. **Test the workflow**:
   ```bash
   curl -X POST https://your-n8n.domain/webhook/sapui5-chat \
     -H "Content-Type: application/json" \
     -d '{
       "query": "What services are available?",
       "userId": "test_user"
     }'
   ```

## Integration with SAPUI5

### Frontend Code Example

```javascript
// In your SAPUI5 controller
sap.ui.define([
  "sap/ui/core/mvc/Controller"
], function (Controller) {
  "use strict";

  return Controller.extend("your.app.controller.Chat", {
    
    queryMCPTools: async function(userQuery) {
      try {
        const response = await fetch("https://your-n8n.domain/webhook/sapui5-chat", {
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
        } else {
          this.handleError(result);
        }
        
      } catch (error) {
        console.error("MCP Tools query failed:", error);
        this.showErrorMessage("Unable to process your request. Please try again.");
      }
    },

    displayResponse: function(response) {
      // Update your UI with the AI-formatted response
      this.getView().byId("responseText").setText(response);
    },

    showSuggestions: function(suggestions) {
      // Display follow-up questions to the user
      const suggestionsList = this.getView().byId("suggestionsList");
      suggestionsList.destroyItems();
      
      suggestions.forEach(suggestion => {
        suggestionsList.addItem(new sap.m.StandardListItem({
          title: suggestion,
          type: "Active",
          press: () => this.queryMCPTools(suggestion)
        }));
      });
    }
  });
});
```

This workflow provides a complete bridge between your SAPUI5 application and the MCP tools, with Gemini AI providing intelligent routing and response formatting.