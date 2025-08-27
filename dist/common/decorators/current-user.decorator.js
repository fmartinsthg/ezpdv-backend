"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentUser = void 0;
const common_1 = require("@nestjs/common");
/**
 * @CurrentUser()
 * Retorna o usuário autenticado anexado pelo JwtAuthGuard.
 * Ajuste se seu guard usa uma chave diferente de `req.user`.
 */
exports.CurrentUser = (0, common_1.createParamDecorator)((_data, ctx) => {
    const req = ctx.switchToHttp().getRequest();
    return req.user ?? null;
});
