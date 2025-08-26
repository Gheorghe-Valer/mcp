import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { readFileSync } from "fs";
import { join } from "path";

async function bootstrap() {
  let httpsOptions: any = null;
  
  // Enable HTTPS in development with self-signed certificates
  if (process.env.NODE_ENV !== 'production') {
    try {
      httpsOptions = {
        key: readFileSync(join(__dirname, '..', 'certs', 'key.pem')),
        cert: readFileSync(join(__dirname, '..', 'certs', 'cert.pem')),
      };
    } catch (error) {
      console.warn('HTTPS certificates not found, running in HTTP mode');
    }
  }

  const createOptions: any = {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  };

  if (httpsOptions) {
    createOptions.httpsOptions = httpsOptions;
  }

  const app = await NestFactory.create(AppModule, createOptions);
  
  // Enable CORS for cross-origin requests from Claude Chat
  app.enableCors({
    origin: ['https://claude.ai', 'https://chat.claude.ai', 'http://localhost:*', 'https://localhost:*', 'https://n8n.open-hand.org'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  const protocol = httpsOptions ? 'https' : 'http';
  
  await app.listen(port);
  
  console.log(`🚀 MCP Server running on ${protocol}://localhost:${port}`);
  console.log(`📡 MCP Endpoints:`);
  console.log(`   Streamable: ${protocol}://localhost:${port}/mcp`);
  console.log(`   SSE: ${protocol}://localhost:${port}/sse`);
}
bootstrap();
