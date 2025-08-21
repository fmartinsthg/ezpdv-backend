import { Prisma } from '@prisma/client';

export function enforceTenantGuard(): Prisma.Middleware {
  return async (params, next) => {
    const guardedModels = ['Category', 'Product', 'Sale', 'FinancialTransaction'];

    if (guardedModels.includes(params.model!)) {
      if (['findMany', 'count', 'aggregate'].includes(params.action)) {
        // se tiver where, deve conter tenantId (ou OR/AND contendo tenantId)
        // aqui dá pra inspecionar params.args.where e validar; se não tiver, lançar erro
      }
      if (['create', 'update', 'upsert'].includes(params.action)) {
        // se tiver data, deve conter tenantId (create) ou where com tenantId (update)
      }
    }
    return next(params);
  };
}