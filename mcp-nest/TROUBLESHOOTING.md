# Claude Chat MCP Connection Troubleshooting Guide

## Current Server Status ✅
Your MCP server is running on **both HTTP and HTTPS**:

- **HTTPS**: `https://localhost:3000/mcp` (with SSL certificates)
- **HTTP**: `http://localhost:3001/mcp` (no SSL, easier for testing)

## Troubleshooting Steps

### 1. 🔍 Test Connection Method

**Option A: Try HTTP First (Recommended)**
- URL: `http://localhost:3001/mcp`
- Transport: `Streamable HTTP`
- SSL Verification: `Not applicable`

**Option B: HTTPS (if Claude Chat supports self-signed certs)**
- URL: `https://localhost:3000/mcp`
- Transport: `Streamable HTTP`
- SSL Verification: `Disabled`

### 2. 🌐 Certificate Issues (HTTPS only)

If using HTTPS, you must trust the certificate first:

1. **Browser Trust**: 
   - Navigate to `https://localhost:3000` in your browser
   - Click "Advanced" → "Proceed to localhost (unsafe)"
   - This tells your system to trust the certificate

2. **System Certificate Trust** (Windows):
   ```cmd
   # Run as Administrator
   certlm.msc
   # Import cert.pem to "Trusted Root Certification Authorities"
   ```

### 3. 🔧 Claude Chat Configuration

**In Claude Chat Settings → Custom Connectors:**

```json
{
  "name": "SAP OData MCP Server",
  "description": "SAP OData access via MCP",
  "url": "http://localhost:3001/mcp",  // Start with HTTP
  "transport": "streamable",
  "timeout": 30000,
  "retries": 3
}
```

### 4. 🐛 Debug Connection Issues

**Check if Claude Chat can reach your server:**

1. **Server Logs**: Monitor the console where you ran `npm run start:dev`
   - You should see connection attempts when Claude Chat tries to connect
   - Look for `[MCP]` log entries

2. **Manual Test**: Test the endpoint manually:
   ```bash
   # Test basic connectivity
   curl http://localhost:3001/
   
   # Test MCP endpoint (will show "Invalid session ID" - this is normal)
   curl http://localhost:3001/mcp
   ```

3. **Network Issues**: 
   - Ensure no firewall is blocking ports 3000/3001
   - Check if other applications are using these ports

### 5. 🔄 Alternative Transport Method

If Streamable HTTP doesn't work, try SSE:

**SSE Configuration:**
- URL: `http://localhost:3001/sse`
- Transport: `Server-Sent Events`

### 6. 🚨 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "Connection refused" | Server not running - check `npm run start:dev` |
| "Certificate error" | Use HTTP version or trust certificate |
| "Timeout" | Check firewall/antivirus blocking ports |
| "Invalid response" | Wrong URL format - ensure `/mcp` suffix |
| "No tools found" | Server running but tools not registered |

### 7. 📊 Verify Server Health

**Test server endpoints:**
```bash
# Basic health check
curl http://localhost:3001/

# Should return: "Hello World!"
```

**Check MCP registration:**
Look for these lines in server logs:
```
Tool "sap_connect" found.
Tool "sap_get_services" found.
Tool "sap_get_service_metadata" found.
Tool "sap_query_entity_set" found.
```

### 8. 🔍 Alternative Testing Methods

**Use MCP Inspector (if available):**
```bash
npx @modelcontextprotocol/inspector http://localhost:3001/mcp
```

**Use Postman/Insomnia:**
- Create HTTP request to `http://localhost:3001/mcp`
- Method: POST
- Headers: `Content-Type: application/json`

### 9. 🎯 Claude Chat Specific Issues

**Known Limitations:**
1. Claude Chat might not support all MCP transport types
2. Self-signed certificates often cause issues
3. Local connections might be blocked by security policies

**Workarounds:**
1. **Use HTTP version**: `http://localhost:3001/mcp`
2. **Try different browsers**: Some browsers handle certificates differently
3. **Check Claude Chat documentation**: MCP support might be limited

### 10. 🔧 Quick Fixes

**If still not working, try:**

1. **Restart everything:**
   ```bash
   # Stop server (Ctrl+C)
   npm run start:dev
   ```

2. **Clear browser cache** and try connecting again

3. **Try from different network** (mobile hotspot) to rule out network issues

4. **Check Claude Chat status page** for known issues

### 11. 📞 Get Help

**Debug Information to Collect:**
- Server console logs
- Browser network tab (F12 → Network)
- Exact error message from Claude Chat
- Operating system and browser version

**Test Manually:**
```bash
# Test if both servers are running
curl http://localhost:3001/
curl -k https://localhost:3000/

# Test MCP endpoints
curl http://localhost:3001/mcp
curl -k https://localhost:3000/mcp
```

## Success Indicators ✅

You'll know it's working when:
1. No connection errors in Claude Chat
2. SAP tools appear in Claude Chat's tool list
3. Server logs show successful MCP connections
4. You can execute tools like `sap_connect`

## Next Steps After Connection

Once connected, test with:
1. "Use sap_connect to connect to SAP"
2. "Use sap_get_services to list available services"
3. "Use server_health_check to verify everything is working"