"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enforceTenantGuard = enforceTenantGuard;
// src/prisma/tenant.middleware.ts
const common_1 = require("@nestjs/common");
/** Modelos multi-tenant que DEVEM ser escopados por tenantId */
const GUARDED_MODELS = new Set([
    'Category',
    'Product',
    'Sale',
    'FinancialTransaction',
    'Order',
    'OrderItem',
    'Payment',
    'PaymentIntent',
    'PaymentAttempt',
    'PixCharge',
    'InventoryItem',
    'Recipe',
    'RecipeLine',
    'StockMovement',
    'IdempotencyKey',
    'WebhookEndpoint',
    'WebhookEvent',
    'WebhookDelivery',
]);
function hasTenantInData(data) {
    return !!(data && typeof data === 'object' && typeof data.tenantId === 'string' && data.tenantId.length);
}
function hasTenantInWhere(where) {
    if (!where || typeof where !== 'object')
        return false;
    if (typeof where.tenantId === 'string' && where.tenantId.length)
        return true;
    const ops = ['AND', 'OR', 'NOT'];
    for (const op of ops) {
        const val = where[op];
        if (Array.isArray(val) && val.some(hasTenantInWhere))
            return true;
        if (val && !Array.isArray(val) && hasTenantInWhere(val))
            return true;
    }
    return false;
}
function enforceTenantGuard() {
    return async (params, next) => {
        const { model, action, args } = params;
        if (!model || !GUARDED_MODELS.has(model)) {
            return next(params);
        }
        // Leitura: exigir where com tenantId
        if (['findMany', 'count', 'aggregate', 'groupBy', 'findFirst', 'findUnique'].includes(action)) {
            if (!hasTenantInWhere(args?.where)) {
                throw new common_1.BadRequestException(`Operação ${action} em ${model} requer filtro por tenantId no where.`);
            }
        }
        // Escrita: create / createMany exigem tenantId no data
        if (action === 'create') {
            const data = args?.data;
            if (Array.isArray(data)) {
                if (!data.every(hasTenantInData)) {
                    throw new common_1.BadRequestException(`createMany ${model} requer tenantId em todos os itens de data.`);
                }
            }
            else if (!hasTenantInData(data)) {
                throw new common_1.BadRequestException(`create ${model} requer tenantId no data.`);
            }
        }
        if (action === 'createMany') {
            const data = args?.data;
            if (!Array.isArray(data) || !data.length || !data.every(hasTenantInData)) {
                throw new common_1.BadRequestException(`createMany ${model} requer tenantId em todos os itens de data.`);
            }
        }
        // update/updateMany/delete/deleteMany exigem tenantId no where (e não permitem alterar tenantId)
        if (['update', 'updateMany', 'delete', 'deleteMany'].includes(action)) {
            if (!hasTenantInWhere(args?.where)) {
                throw new common_1.BadRequestException(`${action} ${model} requer tenantId no where.`);
            }
            if (action.startsWith('update') && args?.data && 'tenantId' in args.data) {
                throw new common_1.BadRequestException(`Não é permitido alterar tenantId em ${action} ${model}.`);
            }
        }
        // upsert: where com tenantId + create com tenantId + não alterar tenantId no update
        if (action === 'upsert') {
            if (!hasTenantInWhere(args?.where)) {
                throw new common_1.BadRequestException(`upsert ${model} requer tenantId no where.`);
            }
            if (!hasTenantInData(args?.create)) {
                throw new common_1.BadRequestException(`upsert ${model} requer tenantId no create.`);
            }
            if (args?.update && 'tenantId' in args.update) {
                throw new common_1.BadRequestException(`Não é permitido alterar tenantId em upsert ${model} (update).`);
            }
        }
        return next(params);
    };
}
