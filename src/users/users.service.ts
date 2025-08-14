import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Role } from "@prisma/client";
import * as bcrypt from "bcrypt";

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany();
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email: email.toString() } });
  }

  async create(data: any) {
    try {
      if (!data.password) {
        throw new BadRequestException("Senha é obrigatória");
      }
      const salt = await bcrypt.genSalt();
      const hashedPassword = await bcrypt.hash(data.password, salt);

      // Validação do papel
      const role = data.role ? data.role.toUpperCase() : "USER";
      if (!Object.values(Role).includes(role)) {
        throw new BadRequestException(
          `Role inválido. Valores permitidos: ${Object.values(Role).join(", ")}`
        );
      }

      return await this.prisma.user.create({
        data: {
          ...data,
          password: hashedPassword,
          role,
        },
      });
    } catch (error: any) {
      throw new BadRequestException(error.message || "Erro ao criar usuário");
    }
  }

  async update(id: string, data: any) {
    return this.prisma.user.update({ where: { id }, data });
  }

  async delete(id: string) {
    return this.prisma.user.delete({ where: { id } });
  }
}
