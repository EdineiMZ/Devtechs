import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { PrismaService } from '../../prisma/prisma.service';

class CreateDepartmentDto {
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsString() managerId?: string;
}

class UpdateDepartmentDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsString() managerId?: string | null;
}

@Controller('departments')
@UseGuards(PermissionGuard)
export class DepartmentsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission('rh:employees:view')
  @HttpCode(HttpStatus.OK)
  async list() {
    const rows = await this.prisma.department.findMany({
      orderBy: { name: 'asc' },
      include: {
        manager: { select: { id: true, name: true } },
        _count: { select: { employees: true } },
      },
    });
    return rows.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      managerId: d.managerId,
      managerName: d.manager?.name ?? null,
      employeeCount: d._count.employees,
    }));
  }

  @Get(':id')
  @RequirePermission('rh:employees:view')
  @HttpCode(HttpStatus.OK)
  async get(@Param('id') id: string) {
    const d = await this.prisma.department.findUniqueOrThrow({
      where: { id },
      include: {
        manager: { select: { id: true, name: true, email: true } },
        _count: { select: { employees: true } },
      },
    });
    return {
      id: d.id,
      name: d.name,
      description: d.description,
      managerId: d.managerId,
      managerName: d.manager?.name ?? null,
      employeeCount: d._count.employees,
    };
  }

  @Post()
  @RequirePermission('rh:employees:edit')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateDepartmentDto) {
    const d = await this.prisma.department.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        managerId: dto.managerId ?? null,
      },
      include: {
        manager: { select: { id: true, name: true } },
        _count: { select: { employees: true } },
      },
    });
    return { id: d.id, name: d.name, description: d.description, managerId: d.managerId, managerName: d.manager?.name ?? null, employeeCount: d._count.employees };
  }

  @Put(':id')
  @RequirePermission('rh:employees:edit')
  @HttpCode(HttpStatus.OK)
  async update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    const d = await this.prisma.department.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.managerId !== undefined ? { managerId: dto.managerId } : {}),
      },
      include: {
        manager: { select: { id: true, name: true } },
        _count: { select: { employees: true } },
      },
    });
    return { id: d.id, name: d.name, description: d.description, managerId: d.managerId, managerName: d.manager?.name ?? null, employeeCount: d._count.employees };
  }

  @Delete(':id')
  @RequirePermission('rh:employees:edit')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    await this.prisma.department.delete({ where: { id } });
    return { message: 'Departamento excluído com sucesso.', id };
  }
}
