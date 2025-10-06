"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdempotencyCtx = exports.Idempotent = exports.IDEMPOTENCY_FORBIDDEN = exports.IDEMPOTENCY_SCOPE_META = void 0;
const common_1 = require("@nestjs/common");
exports.IDEMPOTENCY_SCOPE_META = "IDEMPOTENCY_SCOPE_META";
exports.IDEMPOTENCY_FORBIDDEN = '__IDEMPOTENCY_FORBIDDEN__';
/**
 * Marca o handler com o(s) escopo(s) aceito(s) para idempotência.
 * Aceita string única ou array de strings. O Interceptor fará a
 * canonicalização (sinônimos) e a validação final.
 */
const Idempotent = (scopes) => (0, common_1.SetMetadata)(exports.IDEMPOTENCY_SCOPE_META, Array.isArray(scopes) ? scopes : [scopes]);
exports.Idempotent = Idempotent;
/**
 * Param decorator para acessar o contexto de idempotência preparado pelo Interceptor.
 * Ex.: `create(@IdempotencyCtx() idem?: IdempotencyContext)`
 */
exports.IdempotencyCtx = (0, common_1.createParamDecorator)((_data, ctx) => {
    const req = ctx.switchToHttp().getRequest();
    return req?.idempotency;
});
