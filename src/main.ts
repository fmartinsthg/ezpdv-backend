import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { ConfigService } from "@nestjs/config";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Habilita validações automáticas com class-validator + class-transformer
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, 
      whitelist: true, 
      forbidNonWhitelisted: true, 
      stopAtFirstError: false, 
      exceptionFactory: (errors) => {
        const formattedErrors = errors.map(err => {
          return {
            field: err.property,
            messages: err.constraints
              ? Object.values(err.constraints)
              : [],
          };
        });
        return new BadRequestException(formattedErrors);
      },
    }),
  );

  const configService = app.get(ConfigService);
  const port = configService.get("PORT") || 3333;

  const config = new DocumentBuilder()
    .setTitle("EzPDV API")
    .setDescription("Documentação da API do EzPDV")
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("docs", app, document);

  await app.listen(port);
  console.log(`🚀 Servidor rodando em http://localhost:${port}`);
}
bootstrap();
