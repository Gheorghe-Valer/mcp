import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { McpServerModule } from "./mcp";
import { TestToolsController } from "./test-tools.controller";

@Module({
  imports: [McpServerModule],
  controllers: [AppController, TestToolsController],
  providers: [AppService],
})
export class AppModule {}
