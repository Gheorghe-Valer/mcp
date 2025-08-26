# SSL Certificate Setup for Claude Chat

## Quick Solution ⚡

Since Claude Chat requires HTTPS URLs, you need to trust the SSL certificate. Here are the steps:

### Method 1: Browser Trust (Quickest)

1. **Open your browser** and navigate to: `https://localhost:3000`
2. **You'll see a security warning** - this is expected for self-signed certificates
3. **Click "Advanced"** (Chrome) or similar option
4. **Click "Proceed to localhost (unsafe)"** or "Accept the Risk and Continue"
5. **You should see "Hello World!"** - this means the certificate is now trusted
6. **Now try Claude Chat** - it should accept the HTTPS connection

### Method 2: System Certificate Trust (Permanent)

**For Windows:**

1. **Export the certificate**:
   ```bash
   # The certificate is already at:
   C:\Users\Gheorghe Valer\Documents\Projects\mcp\mcp-nest\certs\cert.pem
   ```

2. **Install the certificate**:
   - Press `Win + R`, type `certlm.msc`, press Enter
   - Navigate to "Trusted Root Certification Authorities" → "Certificates"
   - Right-click → "All Tasks" → "Import"
   - Browse to `cert.pem` and import it
   - Choose "Place certificates in: Trusted Root Certification Authorities"

3. **Restart your browser** and test

### Method 3: Alternative Local Domain (Advanced)

**Use a local development domain:**

1. **Edit hosts file** (`C:\Windows\System32\drivers\etc\hosts`):
   ```
   127.0.0.1 mcp-server.local
   ```

2. **Update server configuration** to use `mcp-server.local`

3. **Get a proper certificate** for the domain

## Claude Chat Configuration

After trusting the certificate, use this configuration in Claude Chat:

```json
{
  "name": "SAP OData MCP Server",
  "description": "SAP OData access via MCP",
  "url": "https://localhost:3000/mcp",
  "transport": "streamable",
  "ssl_verify": false
}
```

## Verification Steps

1. **Test in browser**: `https://localhost:3000` should show "Hello World!" without warnings
2. **Test MCP endpoint**: `https://localhost:3000/mcp` should show "Invalid or missing session ID"
3. **Check certificate**: Browser should show "Connection is secure" (or similar)

## Troubleshooting

### Still getting certificate errors?

1. **Clear browser cache** completely
2. **Try incognito/private browsing** mode
3. **Restart browser** after installing certificate
4. **Try different browser** (Chrome, Firefox, Edge)

### Claude Chat still won't connect?

1. **Verify HTTPS works** in browser first
2. **Check Claude Chat settings** - look for SSL/certificate options
3. **Try the browser trust method** if system trust doesn't work
4. **Check firewall** isn't blocking the connection

### Certificate details:
- **Valid for**: localhost, *.localhost, 127.0.0.1, ::1
- **Valid until**: 1 year from creation
- **Type**: Self-signed X.509 certificate
- **Algorithm**: RSA 2048-bit with SHA-256

## Alternative: Use ngrok (Cloud Tunnel)

If local certificates don't work, you can expose your server through ngrok:

```bash
# Install ngrok (https://ngrok.com/)
ngrok http 3000

# Use the https://xxxxx.ngrok.io URL in Claude Chat
```

This gives you a real HTTPS URL with a valid certificate that Claude Chat will definitely accept.

## Success Indicators ✅

You'll know it's working when:
- Browser shows `https://localhost:3000` without security warnings
- Claude Chat connects without SSL errors
- MCP tools appear in Claude Chat interface