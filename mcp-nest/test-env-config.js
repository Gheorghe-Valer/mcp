const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');

async function testEnvironmentConfig() {
  console.log('🔍 Testing Environment Configuration\n');

  try {
    const app = await NestFactory.createApplicationContext(AppModule);
    const { ConfigService } = require('@nestjs/config');
    const configService = app.get(ConfigService);

    console.log('📋 Environment Variables Check:');
    console.log('CATALOG_ODATA_URL:', configService.get('CATALOG_ODATA_URL') || 'NOT SET');
    console.log('CATALOG_OAUTH_TOKEN_URL:', configService.get('CATALOG_OAUTH_TOKEN_URL') || 'NOT SET');
    console.log('CATALOG_OAUTH_CLIENT_ID:', configService.get('CATALOG_OAUTH_CLIENT_ID') || 'NOT SET');
    console.log('CATALOG_OAUTH_CLIENT_SECRET:', configService.get('CATALOG_OAUTH_CLIENT_SECRET') ? 'SET (length: ' + configService.get('CATALOG_OAUTH_CLIENT_SECRET').length + ')' : 'NOT SET');
    console.log();

    // Test the MultiODataClientService directly
    const { MultiODataClientService } = require('./dist/mcp/services/multi-odata-client.service');
    const multiODataClient = app.get(MultiODataClientService);

    console.log('🗂️  Systems in MultiODataClientService:');
    const systems = multiODataClient.getAllSystems();
    console.log('Systems count:', systems.length);
    
    if (systems.length > 0) {
      systems.forEach((system, index) => {
        console.log(`${index + 1}. ${system.name} (${system.id})`);
        console.log(`   URL: ${system.baseUrl}`);
        console.log(`   Auth: ${system.authType}`);
        console.log(`   OAuth Token URL: ${system.oauth2?.tokenUrl || 'N/A'}`);
      });
    } else {
      console.log('⚠️  No systems found! This is the issue.');
    }

    await app.close();

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testEnvironmentConfig().then(() => {
  console.log('\n🏁 Environment test completed!');
}).catch(console.error);