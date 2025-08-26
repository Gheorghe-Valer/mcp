const https = require('https');
const { URL } = require('url');

// Create an agent that accepts self-signed certificates and handles SSL issues
const agent = new https.Agent({
  rejectUnauthorized: false,
  secureProtocol: 'TLSv1_2_method'
});

async function testMCPDirectly() {
  console.log('🔍 Testing MCP Protocol Directly\n');

  try {
    // Test 1: Basic server connectivity
    console.log('📡 Testing basic server connectivity...');
    const testBasic = await new Promise((resolve) => {
      const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/',
        method: 'GET',
        agent: agent,
        timeout: 5000
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body }));
      });

      req.on('error', (e) => resolve({ error: e.message }));
      req.on('timeout', () => resolve({ error: 'timeout' }));
      req.end();
    });

    console.log('Basic connectivity result:', testBasic);

    if (testBasic.error) {
      console.log('❌ Basic connectivity failed. Server might not be running on HTTPS properly.');
      return;
    }

    console.log('✅ Server is responding!\n');

    // Test 2: MCP Initialize
    console.log('📡 Testing MCP Initialize...');
    const initResponse = await makeSecureRequest('/mcp', {
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' }
      },
      id: 1
    });

    console.log('Initialize response:', JSON.stringify(initResponse, null, 2));

    if (initResponse.result) {
      console.log('✅ MCP session initialized successfully!\n');

      // Test 3: List OData Systems
      console.log('📡 Testing list_odata_systems...');
      const listResponse = await makeSecureRequest('/mcp', {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'list_odata_systems',
          arguments: {}
        },
        id: 2
      });

      console.log('List systems response:', JSON.stringify(listResponse, null, 2));

      if (listResponse.result?.content?.[0]?.text) {
        const systemsData = JSON.parse(listResponse.result.content[0].text);
        console.log('\n📊 Parsed systems data:');
        console.log('Systems found:', systemsData.systems?.length || 0);
        if (systemsData.systems?.length > 0) {
          console.log('✅ SUCCESS! Systems are available:');
          systemsData.systems.forEach((system, i) => {
            console.log(`  ${i + 1}. ${system.name} (${system.id})`);
          });
        } else {
          console.log('❌ No systems found in response');
        }
      } else {
        console.log('❌ Invalid response format for list_odata_systems');
      }
    } else {
      console.log('❌ MCP initialization failed');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

function makeSecureRequest(path, data) {
  return new Promise((resolve) => {
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Content-Length': Buffer.byteLength(postData)
      },
      agent: agent,
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
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
          resolve({ parseError: e.message, raw: body });
        }
      });
    });

    req.on('error', (e) => resolve({ error: e.message }));
    req.on('timeout', () => resolve({ error: 'Request timeout' }));
    
    req.write(postData);
    req.end();
  });
}

testMCPDirectly().then(() => {
  console.log('\n🏁 Test completed!');
}).catch(console.error);