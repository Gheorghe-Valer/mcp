import { Injectable } from "@nestjs/common";
import { Resolver, Tool } from "@nestjs-mcp/server";

@Injectable()
@Resolver()
export class McpResolver {
  @Tool({
    name: "server_health_check",
    description: "Check if the server is operational",
  })
  healthCheck() {
    return {
      content: [
        {
          type: "text",
          text: "Server is operational. All systems running normally.",
        },
      ],
    };
  }

  @Tool({
    name: "get_server_info",
    description: "Get basic information about the server",
  })
  getServerInfo() {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              name: "MCP NestJS Server for SAP OData Tools",
              version: "1.0.0",
              timestamp: new Date().toISOString(),
              transport: "HTTP",
            },
            null,
            2,
          ),
        },
      ],
    };
  }
}
