import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany();
  }

  async findById(id: number) {
    return this.prisma.user.findUnique({ where: { id: id.toString() } });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email: email.toString() } });
  }

  async create(data: any) {
    return this.prisma.user.create({ data });
  }

  async update(id: number, data: any) {
    return this.prisma.user.update({ where: { id: id.toString() }, data });
  }

  async delete(id: number) {
    return this.prisma.user.delete({ where: { id: id.toString() } });
  }
}
