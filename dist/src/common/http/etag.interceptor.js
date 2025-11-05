"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EtagInterceptor = void 0;
const common_1 = require("@nestjs/common");
const operators_1 = require("rxjs/operators");
let EtagInterceptor = class EtagInterceptor {
    intercept(ctx, next) {
        const res = ctx.switchToHttp().getResponse();
        return next.handle().pipe((0, operators_1.tap)((body) => {
            const v = (body?.version ?? body?.order?.version ?? null);
            if (Number.isInteger(v)) {
                res.setHeader('ETag', `W/"${v}"`);
            }
        }));
    }
};
exports.EtagInterceptor = EtagInterceptor;
exports.EtagInterceptor = EtagInterceptor = __decorate([
    (0, common_1.Injectable)()
], EtagInterceptor);
