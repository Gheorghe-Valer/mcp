const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');

async function testServicesDirectly() {
  console.log('🧪 Testing OAuth 2.0 OData Services Directly\n');

  try {
    // Create NestJS app context for testing
    const app = await NestFactory.createApplicationContext(AppModule);
    
    // Get the services we want to test
    const { MultiODataClientService } = require('./dist/mcp/services/multi-odata-client.service');
    const { MetadataDiscoveryService } = require('./dist/mcp/services/metadata-discovery.service');
    
    const multiODataClient = app.get(MultiODataClientService);
    const metadataDiscovery = app.get(MetadataDiscoveryService);

    // Step 1: List available systems
    console.log('🗂️  Listing available OData systems...');
    const systems = multiODataClient.getAllSystems();
    console.log(`✅ Found ${systems.length} systems:`);
    systems.forEach(system => {
      console.log(`  - ${system.name} (${system.id})`);
      console.log(`    URL: ${system.baseUrl}`);
      console.log(`    Auth: ${system.authType}`);
    });
    console.log();

    // Step 2: Test connection to catalog service
    const catalogSystem = systems.find(s => s.id === 'catalog-service');
    if (catalogSystem) {
      console.log('🔐 Testing connection to catalog service...');
      const connected = await multiODataClient.connect('catalog-service');
      console.log(`✅ Connection result: ${connected}`);
      
      const connectionInfo = multiODataClient.getConnectionInfo('catalog-service');
      console.log('📊 Connection info:', {
        connected: connectionInfo?.connected,
        authType: connectionInfo?.authType,
        baseUrl: connectionInfo?.baseUrl
      });
      console.log();

      if (connected) {
        // Step 3: Test metadata discovery
        console.log('🔍 Testing metadata discovery...');
        try {
          const metadata = await metadataDiscovery.discoverSystemMetadata('catalog-service');
          console.log('✅ Metadata discovered!');
          console.log(`📈 Entities: ${metadata.entities.length}`);
          console.log(`📊 Entity Sets: ${metadata.entitySets.length}`);
          console.log(`⚙️  Functions: ${metadata.functions.length}`);
          
          console.log('\n📋 Available Entity Sets:');
          metadata.entitySets.forEach(entitySet => {
            console.log(`  - ${entitySet.name} (${entitySet.entityType})`);
          });
          console.log();

          // Step 4: Try to query Books entity
          const booksEntitySet = metadata.entitySets.find(e => e.name === 'Books');
          if (booksEntitySet) {
            console.log('📚 Testing Books entity query...');
            try {
              const result = await multiODataClient.queryEntitySet('catalog-service', 'Books', { top: 3 });
              console.log('✅ Books query successful!');
              
              const data = result.d?.results || result.d || result;
              console.log(`📖 Records returned: ${Array.isArray(data) ? data.length : 1}`);
              
              if (Array.isArray(data) && data.length > 0) {
                console.log('\n📝 Sample book data:');
                const firstBook = data[0];
                Object.keys(firstBook).slice(0, 5).forEach(key => {
                  console.log(`  ${key}: ${firstBook[key]}`);
                });
              }
            } catch (queryError) {
              console.log('❌ Books query failed:', queryError.message);
            }
          } else {
            console.log('⚠️  Books entity set not found');
          }

        } catch (metadataError) {
          console.log('❌ Metadata discovery failed:', metadataError.message);
        }
      }
    } else {
      console.log('⚠️  Catalog service not found');
    }

    await app.close();

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testServicesDirectly().then(() => {
  console.log('\n🏁 Test completed!');
}).catch(console.error);