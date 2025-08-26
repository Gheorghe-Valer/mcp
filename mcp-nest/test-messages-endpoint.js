const http = require('http');

function makeHTTPRequest(path, data) {
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
      },
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ raw: body });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.on('timeout', () => {
      reject(new Error('Request timeout'));
    });

    req.write(postData);
    req.end();
  });
}

async function testMessagesEndpoint() {
  console.log('🧪 Testing Messages Endpoint for Direct Tool Calls\n');

  try {
    // Test different endpoints
    const endpoints = ['/messages', '/mcp'];
    
    for (const endpoint of endpoints) {
      console.log(`📡 Testing ${endpoint} endpoint...`);
      
      try {
        const response = await makeHTTPRequest(endpoint, {
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'list_odata_systems',
            arguments: {}
          },
          id: 1
        });
        
        console.log(`✅ Response from ${endpoint}:`, JSON.stringify(response, null, 2));
        
        if (response.result?.content?.[0]?.text) {
          const systemsData = JSON.parse(response.result.content[0].text);
          console.log(`📊 Systems found: ${systemsData.systems?.length || 0}`);
          if (systemsData.systems?.length > 0) {
            console.log('🎉 SUCCESS! Found systems:');
            systemsData.systems.forEach(system => {
              console.log(`  - ${system.name} (${system.id})`);
            });
          }
        }
        
      } catch (error) {
        console.log(`❌ ${endpoint} failed:`, error.message);
      }
      
      console.log('\n' + '-'.repeat(50) + '\n');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testMessagesEndpoint().then(() => {
  console.log('🏁 Test completed!');
}).catch(console.error);