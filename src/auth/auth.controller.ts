import { Controller, Post, Body } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginUserDto } from "../users/dto/login-user.dto";
import { Public } from "../common/decorators/public.decorator";
import { SkipTenant } from "../common/tenant/skip-tenant.decorator";
import { ApiTags, ApiOperation } from "@nestjs/swagger";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @SkipTenant()
  @Post("login")
  @ApiOperation({ summary: "Login (rota pública, sem tenant)" })
  login(@Body() dto: LoginUserDto) {
    return this.authService.login(dto);
  }
}
