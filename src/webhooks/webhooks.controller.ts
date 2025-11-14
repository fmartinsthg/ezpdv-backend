// src/webhooks/webhooks.controller.ts
import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Patch,
  Query,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { Roles } from "../common/decorators/roles.decorator";
import { TenantId } from "../common/tenant/tenant.decorator";
import {
  Idempotent,
  IDEMPOTENCY_FORBIDDEN,
} from "../common/idempotency/idempotency.decorator";
import { WebhooksService } from "./webhooks.service";
import { CreateEndpointDto } from "./dto/create-endpoint.dto";
import { UpdateEndpointDto } from "./dto/update-endpoint.dto";
import { ReplayDto } from "./dto/replay.dto";
import { ListDeliveriesDto } from "./dto/list-deliveries.dto";
import { presentEndpoint } from "./presenter";

@ApiTags("webhooks")
@ApiBearerAuth()
@Controller("tenants/:tenantId/webhooks")
export class WebhooksController {
  constructor(private readonly svc: WebhooksService) {}

  @ApiOperation({ summary: "Criar endpoint" })
  @Roles("SUPERADMIN", "ADMIN")
  @Idempotent("webhooks:endpoints:create")
  @Post("endpoints")
  async createEndpoint(
    @TenantId() tenantId: string,
    @Body() dto: CreateEndpointDto
  ) {
    const ep = await this.svc.createEndpoint(tenantId, dto);
    return presentEndpoint(ep);
  }

  @ApiOperation({ summary: "Listar endpoints" })
  @Roles("SUPERADMIN", "ADMIN")
  @Idempotent(IDEMPOTENCY_FORBIDDEN)
  @Get("endpoints")
  async listEndpoints(@TenantId() tenantId: string) {
    return this.svc.listEndpoints(tenantId);
  }

  @ApiOperation({ summary: "Atualizar endpoint (If-Match)" })
  @ApiHeader({ name: "If-Match", required: false })
  @Roles("SUPERADMIN", "ADMIN")
  @Patch("endpoints/:id")
  async patchEndpoint(
    @TenantId() tenantId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateEndpointDto,
    @Headers("if-match") ifMatch?: string
  ) {
    const ep = await this.svc.patchEndpoint(tenantId, id, dto, ifMatch);
    return presentEndpoint(ep);
  }

  @ApiOperation({ summary: "Rotacionar segredo (If-Match)" })
  @ApiHeader({ name: "If-Match", required: true })
  @Roles("SUPERADMIN", "ADMIN")
  @Post("endpoints/:id/rotate-secret")
  async rotateSecret(
    @TenantId() tenantId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("if-match") ifMatch: string
  ) {
    const ep = await this.svc.rotateSecret(tenantId, id, ifMatch);
    return presentEndpoint(ep);
  }

  @ApiOperation({ summary: "Replay por ids ou janela" })
  @Roles("SUPERADMIN", "ADMIN")
  @Idempotent("webhooks:replay")
  @Post("replay")
  async replay(@TenantId() tenantId: string, @Body() dto: ReplayDto) {
    return this.svc.replay(tenantId, dto);
  }

  @ApiOperation({ summary: "Listar entregas" })
  @Roles("SUPERADMIN", "ADMIN")
  @Idempotent(IDEMPOTENCY_FORBIDDEN)
  @Get("deliveries")
  async listDeliveries(
    @TenantId() tenantId: string,
    @Query() query: ListDeliveriesDto
  ) {
    return this.svc.listDeliveries(tenantId, query);
  }
}
