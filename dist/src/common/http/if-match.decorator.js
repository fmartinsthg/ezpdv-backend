"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IfMatch = void 0;
// src/common/http/if-match.decorator.ts
const common_1 = require("@nestjs/common");
exports.IfMatch = (0, common_1.createParamDecorator)((_data, ctx) => {
    const req = ctx.switchToHttp().getRequest();
    const v = req.headers['if-match'];
    if (v == null)
        return undefined; // permita opcional
    const num = Number(v);
    if (!Number.isInteger(num) || num < 0)
        throw new common_1.BadRequestException('Invalid If-Match version');
    return num;
});
