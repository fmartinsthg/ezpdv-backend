// src/app.controller.ts
import { Controller, Get } from "@nestjs/common";

@Controller()
export class AppController {
  @Get()
  getHello() {
    return { message: "API do EzPDV está no ar!" };
  }
}
