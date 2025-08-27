import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SystemRole, TenantRole } from '@prisma/client';

@Injectable()
export class PaymentsApprovalGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const token: string | undefined = req.headers['x-approval-token'];
    if (!token) throw new ForbiddenException('X-Approval-Token header is required');

    try {
      const payload = this.jwt.verify(token as string);
      const { systemRole, tenantRole, tenantId, sub } = payload || {};
      const paramTenant: string | undefined = req.params?.tenantId;

      const isSuperAdmin = systemRole === SystemRole.SUPERADMIN;
      const isModeratorOrAdmin = tenantRole === TenantRole.MODERATOR || tenantRole === TenantRole.ADMIN;

      if (!isSuperAdmin && !isModeratorOrAdmin) {
        throw new ForbiddenException('Approval token does not have required role (MODERATOR/ADMIN/SUPERADMIN)');
      }
      if (!isSuperAdmin && paramTenant && tenantId && tenantId !== paramTenant) {
        throw new ForbiddenException('Approval token tenant mismatch');
      }

      // Anexa aprovador para auditoria (byUserId)
      req.approvalUser = { id: sub, systemRole, tenantRole, tenantId };
      return true;
    } catch (err: unknown) {
      if (err instanceof Error && (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError')) {
        throw new UnauthorizedException('Invalid or expired X-Approval-Token');
      }
      throw err;
    }
  }
}
