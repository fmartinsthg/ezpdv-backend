"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantOptional = exports.TENANT_OPTIONAL = void 0;
const common_1 = require("@nestjs/common");
exports.TENANT_OPTIONAL = "TENANT_OPTIONAL";
const TenantOptional = () => (0, common_1.SetMetadata)(exports.TENANT_OPTIONAL, true);
exports.TenantOptional = TenantOptional;
