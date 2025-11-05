"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlatformModule = void 0;
// src/platform/platform.module.ts
const common_1 = require("@nestjs/common");
const prisma_module_1 = require("../prisma/prisma.module");
const tenants_module_1 = require("./tenants/tenants.module");
const memberships_module_1 = require("./memberships/memberships.module");
const tenant_users_module_1 = require("./tenants/users/tenant-users.module");
let PlatformModule = class PlatformModule {
};
exports.PlatformModule = PlatformModule;
exports.PlatformModule = PlatformModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, tenants_module_1.TenantsModule, memberships_module_1.MembershipsModule, tenant_users_module_1.TenantUsersModule],
    })
], PlatformModule);
