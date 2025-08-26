import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class SessionLoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SessionLoggerInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Log incoming request details
    this.logger.log('=== MCP REQUEST ===');
    this.logger.log(`Method: ${request.method}`);
    this.logger.log(`URL: ${request.url}`);
    this.logger.log(`Headers: ${JSON.stringify(request.headers, null, 2)}`);
    
    // Check for session ID in various headers
    const mcpSessionId = request.headers['mcp-session-id'];
    const xSessionId = request.headers['x-session-id'];
    const sessionId = request.headers['session-id'];
    
    this.logger.log(`MCP Session ID: ${mcpSessionId || 'NOT FOUND'}`);
    this.logger.log(`X-Session-ID: ${xSessionId || 'NOT FOUND'}`);
    this.logger.log(`Session-ID: ${sessionId || 'NOT FOUND'}`);
    
    if (request.body) {
      this.logger.log(`Body: ${JSON.stringify(request.body, null, 2)}`);
    }

    return next.handle().pipe(
      tap(() => {
        // Log response headers
        this.logger.log('=== MCP RESPONSE HEADERS ===');
        const responseHeaders = response.getHeaders();
        this.logger.log(`Response Headers: ${JSON.stringify(responseHeaders, null, 2)}`);
        
        // Check if response has session ID
        const respMcpSessionId = responseHeaders['mcp-session-id'];
        const respXSessionId = responseHeaders['x-session-id'];
        
        if (respMcpSessionId) {
          this.logger.log(`RESPONSE MCP Session ID: ${respMcpSessionId}`);
        }
        if (respXSessionId) {
          this.logger.log(`RESPONSE X-Session-ID: ${respXSessionId}`);
        }
      })
    );
  }
}