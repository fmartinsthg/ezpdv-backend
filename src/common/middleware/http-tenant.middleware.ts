import {
  BadRequestException,
  Injectable,
  NestMiddleware,
} from "@nestjs/common";

@Injectable()
export class HttpTenantMiddleware implements NestMiddleware {
  use(req: any, _res: any, next: () => void) {
    const raw = req.headers["x-tenant-id"];
    if (!raw || typeof raw !== "string" || !raw.length) {
      throw new BadRequestException("X-Tenant-Id é obrigatório.");
    }
    req.tenantId = raw;
    next();
  }
}
