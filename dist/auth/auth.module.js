"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const passport_1 = require("@nestjs/passport");
const config_1 = require("@nestjs/config");
const auth_service_1 = require("./auth.service");
const jwt_strategy_1 = require("./jwt.strategy");
const auth_controller_1 = require("./auth.controller");
const users_module_1 = require("../users/users.module");
// ✅ Importe e exporte os guards aqui para ficarem disponíveis aos módulos que importarem o AuthModule
const jwt_guard_1 = require("./jwt.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const tenant_context_guard_1 = require("../common/tenant/tenant-context.guard");
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            users_module_1.UsersModule,
            passport_1.PassportModule.register({ defaultStrategy: "jwt" }),
            jwt_1.JwtModule.registerAsync({
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                useFactory: (config) => ({
                    secret: config.get("JWT_SECRET") ??
                        config.get("AUTH_JWT_SECRET") ??
                        "ezpdv-secret", // fallback de dev
                    signOptions: { expiresIn: "1d" },
                }),
            }),
        ],
        controllers: [auth_controller_1.AuthController],
        providers: [
            auth_service_1.AuthService,
            jwt_strategy_1.JwtStrategy,
            // ✅ disponibiliza os guards como providers
            jwt_guard_1.JwtAuthGuard,
            roles_guard_1.RolesGuard,
            tenant_context_guard_1.TenantContextGuard,
        ],
        // ✅ exporta tudo que os outros módulos precisam
        exports: [
            auth_service_1.AuthService,
            jwt_1.JwtModule, // -> entrega JwtService
            passport_1.PassportModule,
            jwt_guard_1.JwtAuthGuard,
            roles_guard_1.RolesGuard,
            tenant_context_guard_1.TenantContextGuard,
        ],
    })
], AuthModule);
