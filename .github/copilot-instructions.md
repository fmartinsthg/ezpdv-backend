# Copilot Instructions for EzPDV Backend

## Project Overview

- **EzPDV Backend** is a multi-tenant retail/restaurant backend built with NestJS and Prisma.
- The codebase is organized by domain (e.g., `auth`, `category`, `orders`, `products`, `users`), each with its own controller, service, module, and DTOs.
- Data access is handled via Prisma ORM, with the schema in `prisma/schema.prisma` and migrations in `prisma/migrations/`.
- Tenant isolation is enforced in all queries; only superadmins can access data across tenants.

## Key Patterns & Conventions

- **DTOs**: All input validation is handled via DTOs using `class-validator` decorators. Update DTOs often extend their Create counterparts with `PartialType`.
- **Guards & Decorators**: Role-based access is enforced using custom guards and decorators in `src/common/` and `src/auth/`.
- **Service Methods**: Always require the `user` (from JWT) to enforce tenant boundaries. Example: `findAll(user: AuthUser, ...)`.
- **Error Handling**: Use NestJS exceptions (`NotFoundException`, `BadRequestException`, etc.) for all error cases.
- **Prisma**: All Prisma queries must filter by `tenantId` unless explicitly for superadmin use.

## Developer Workflows

- **Run locally**: `npm install` then `npm run start:dev`
- **Prisma**: Use `npx prisma migrate dev` for migrations, `npx prisma studio` for DB browsing.
- **Testing**: (Add details here if tests exist)
- **Debugging**: Use VS Code launch configs or `npm run start:debug`.

## Integration Points

- **Authentication**: JWT-based, with roles and tenant info in the token.
- **Prisma**: Centralized in `src/prisma/prisma.service.ts`.
- **Category/Product/Order**: Cross-entity queries are always tenant-scoped.

## Examples

- To add a new resource, follow the structure in `src/products/` or `src/category/`.
- For a new endpoint, add to the controller and service, always passing the `user` for tenant checks.

## References

- See `README.md` for a high-level summary.
- Prisma schema: `prisma/schema.prisma`
- Example service: `src/products/products.service.ts`
- Example guard: `src/common/guards/roles.guard.ts`

---

If any conventions or workflows are unclear, please ask for clarification or check with the project maintainers.
