const https = require('https');

// Create an agent that accepts self-signed certificates
const agent = new https.Agent({
  rejectUnauthorized: false
});

let sessionId = null;

function makeRequest(path, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Accept': 'application/json, text/event-stream'
      },
      agent: agent
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          // Handle SSE format
          if (body.startsWith('event: message\ndata: ')) {
            const jsonData = body.replace('event: message\ndata: ', '').trim();
            resolve(JSON.parse(jsonData));
          } else {
            resolve(JSON.parse(body));
          }
        } catch (e) {
          resolve({ raw: body });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

async function debugMCPSession() {
  console.log('🔍 MCP Session Debug Helper\n');
  console.log('This will show you the exact requests to use in Postman:\n');

  try {
    // Step 1: Initialize
    console.log('📝 STEP 1: Initialize Session');
    console.log('POST https://localhost:3000/mcp');
    console.log('Headers: Content-Type: application/json, Accept: application/json, text/event-stream');
    console.log('Body:');
    const initRequest = {
      "jsonrpc": "2.0",
      "method": "initialize",
      "params": {
        "protocolVersion": "2024-11-05",
        "capabilities": {},
        "clientInfo": {
          "name": "postman-client",
          "version": "1.0.0"
        }
      },
      "id": 1
    };
    console.log(JSON.stringify(initRequest, null, 2));

    const initResponse = await makeRequest('/mcp', initRequest);
    console.log('\nResponse:');
    console.log(JSON.stringify(initResponse, null, 2));
    console.log('\n' + '='.repeat(80) + '\n');

    // Step 2: List Systems - Show exact request format
    console.log('📝 STEP 2: List OData Systems');
    console.log('POST https://localhost:3000/mcp');
    console.log('Headers: Content-Type: application/json, Accept: application/json, text/event-stream');
    console.log('Body:');
    const listRequest = {
      "jsonrpc": "2.0",
      "method": "tools/call",
      "params": {
        "name": "list_odata_systems",
        "arguments": {}
      },
      "id": 2
    };
    console.log(JSON.stringify(listRequest, null, 2));

    const listResponse = await makeRequest('/mcp', listRequest);
    console.log('\nResponse:');
    console.log(JSON.stringify(listResponse, null, 2));

    // If we get the systems, continue with connect
    if (listResponse.result?.content?.[0]?.text) {
      const systemsData = JSON.parse(listResponse.result.content[0].text);
      if (systemsData.systems?.length > 0) {
        console.log('\n' + '='.repeat(80) + '\n');
        console.log('📝 STEP 3: Connect to Catalog Service');
        console.log('POST https://localhost:3000/mcp');
        console.log('Body:');
        const connectRequest = {
          "jsonrpc": "2.0",
          "method": "tools/call",
          "params": {
            "name": "connect_odata_system",
            "arguments": {
              "systemId": "catalog-service"
            }
          },
          "id": 3
        };
        console.log(JSON.stringify(connectRequest, null, 2));

        const connectResponse = await makeRequest('/mcp', connectRequest);
        console.log('\nResponse:');
        console.log(JSON.stringify(connectResponse, null, 2));
      }
    }

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

console.log('🧪 Starting MCP Debug Session...\n');
debugMCPSession().then(() => {
  console.log('\n🏁 Debug completed! Use the exact requests shown above in Postman.');
}).catch(console.error);