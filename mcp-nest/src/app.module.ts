import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { SystemModule } from "./system/system.module";
import { TestToolsController } from "./test-tools.controller";

@Module({
  imports: [SystemModule],
  controllers: [AppController, TestToolsController],
  providers: [AppService],
})
export class AppModule {}
