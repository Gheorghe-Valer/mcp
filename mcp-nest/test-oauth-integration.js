const https = require('https');

// Create an agent that accepts self-signed certificates
const agent = new https.Agent({
  rejectUnauthorized: false
});

// Function to make POST requests
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

async function testOAuthIntegration() {
  console.log('🧪 Testing OAuth 2.0 OData Integration\n');

  try {
    // Step 1: Initialize session
    console.log('📡 Initializing MCP session...');
    const initResponse = await makeRequest('/mcp', {
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' }
      },
      id: 1
    });
    console.log('✅ Session initialized:', initResponse.result?.serverInfo?.name);
    console.log('📋 Available capabilities:', Object.keys(initResponse.result?.capabilities || {}));
    console.log();

    // Step 2: List available OData systems
    console.log('🗂️  Testing list_odata_systems...');
    const systemsResponse = await makeRequest('/mcp', {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'list_odata_systems',
        arguments: {}
      },
      id: 2
    });
    console.log('Systems response:', systemsResponse);
    console.log();

    // Step 3: If we have systems, try to connect to the catalog service
    if (systemsResponse.result?.content?.[0]?.text) {
      const systemsData = JSON.parse(systemsResponse.result.content[0].text);
      console.log('📊 Available systems:', systemsData.systems?.length || 0);
      
      if (systemsData.systems?.length > 0) {
        const catalogSystem = systemsData.systems.find(s => s.id === 'catalog-service');
        if (catalogSystem) {
          console.log('🔐 Testing connection to catalog service...');
          const connectResponse = await makeRequest('/mcp', {
            jsonrpc: '2.0',
            method: 'tools/call',
            params: {
              name: 'connect_odata_system',
              arguments: { systemId: 'catalog-service' }
            },
            id: 3
          });
          console.log('Connection response:', connectResponse);
          
          if (connectResponse.result?.content?.[0]?.text) {
            const connectionData = JSON.parse(connectResponse.result.content[0].text);
            if (connectionData.success) {
              console.log('✅ Successfully connected to catalog service!');
              
              // Step 4: Test metadata discovery
              console.log('\n🔍 Testing metadata discovery...');
              const metadataResponse = await makeRequest('/mcp', {
                jsonrpc: '2.0',
                method: 'tools/call',
                params: {
                  name: 'get_system_metadata',
                  arguments: { systemId: 'catalog-service' }
                },
                id: 4
              });
              
              if (metadataResponse.result?.content?.[0]?.text) {
                const metadata = JSON.parse(metadataResponse.result.content[0].text);
                console.log('✅ Metadata discovered!');
                console.log('📈 Entities:', metadata.summary?.entitiesCount || 0);
                console.log('📊 Entity Sets:', metadata.summary?.entitySetsCount || 0);
                
                // Step 5: Try to query Books entity
                const booksEntitySet = metadata.entitySets?.find(e => e.name === 'Books');
                if (booksEntitySet) {
                  console.log('\n📚 Testing Books entity query...');
                  const queryResponse = await makeRequest('/mcp', {
                    jsonrpc: '2.0',
                    method: 'tools/call',
                    params: {
                      name: 'query_odata_entity',
                      arguments: { 
                        systemId: 'catalog-service',
                        entitySetName: 'Books',
                        top: 5
                      }
                    },
                    id: 5
                  });
                  
                  if (queryResponse.result?.content?.[0]?.text) {
                    const queryData = JSON.parse(queryResponse.result.content[0].text);
                    console.log('✅ Books query successful!');
                    console.log('📖 Records returned:', queryData.recordsReturned);
                    if (queryData.data?.value && queryData.data.value.length > 0) {
                      console.log('📝 First book title:', queryData.data.value[0].title || 'N/A');
                    }
                  }
                }
              }
            } else {
              console.log('❌ Failed to connect:', connectionData.message);
            }
          }
        } else {
          console.log('⚠️  Catalog service not found in systems list');
        }
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testOAuthIntegration().then(() => {
  console.log('\n🏁 Test completed!');
}).catch(console.error);