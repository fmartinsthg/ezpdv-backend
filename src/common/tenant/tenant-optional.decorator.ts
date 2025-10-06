import { SetMetadata } from "@nestjs/common";

export const TENANT_OPTIONAL = "TENANT_OPTIONAL";
export const TenantOptional = () => SetMetadata(TENANT_OPTIONAL, true);
