"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkipTenant = exports.SKIP_TENANT_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.SKIP_TENANT_KEY = 'skipTenant';
const SkipTenant = () => (0, common_1.SetMetadata)(exports.SKIP_TENANT_KEY, true);
exports.SkipTenant = SkipTenant;
