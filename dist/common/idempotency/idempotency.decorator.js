"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Idempotent = exports.IDEMPOTENCY_SCOPE_META = void 0;
const common_1 = require("@nestjs/common");
exports.IDEMPOTENCY_SCOPE_META = 'IDEMPOTENCY_SCOPE_META';
/** Marca o handler com o escopo requerido */
const Idempotent = (scopes) => (0, common_1.SetMetadata)(exports.IDEMPOTENCY_SCOPE_META, Array.isArray(scopes) ? scopes : [scopes]);
exports.Idempotent = Idempotent;
