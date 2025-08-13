"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const swagger_1 = require("@nestjs/swagger");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    // Habilita validações automáticas com class-validator + class-transformer
    app.useGlobalPipes(new common_1.ValidationPipe({
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
            return new common_1.BadRequestException(formattedErrors);
        },
    }));
    const configService = app.get(config_1.ConfigService);
    const port = configService.get("PORT") || 3333;
    const config = new swagger_1.DocumentBuilder()
        .setTitle("EzPDV API")
        .setDescription("Documentação da API do EzPDV")
        .setVersion("1.0")
        .addBearerAuth()
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup("docs", app, document);
    await app.listen(port);
    console.log(`🚀 Servidor rodando em http://localhost:${port}`);
}
bootstrap();
