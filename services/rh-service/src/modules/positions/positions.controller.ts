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
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { PrismaService } from '../../prisma/prisma.service';

const POSITION_LEVELS = ['JUNIOR', 'MID', 'SENIOR', 'LEAD', 'MANAGER', 'DIRECTOR'] as const;
type PositionLevel = (typeof POSITION_LEVELS)[number];

class CreatePositionDto {
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @IsEnum(POSITION_LEVELS) level!: PositionLevel;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) salary?: number;
}

class UpdatePositionDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) name?: string;
  @IsOptional() @IsEnum(POSITION_LEVELS) level?: PositionLevel;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) salary?: number;
}

@Controller('positions')
@UseGuards(PermissionGuard)
export class PositionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission('rh:employees:view')
  @HttpCode(HttpStatus.OK)
  async list() {
    const rows = await this.prisma.position.findMany({
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { employees: true } } },
    });
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      level: p.level,
      description: p.description,
      salary: p.salary ? p.salary.toString() : null,
      employeeCount: p._count.employees,
    }));
  }

  @Get(':id')
  @RequirePermission('rh:employees:view')
  @HttpCode(HttpStatus.OK)
  async get(@Param('id') id: string) {
    const p = await this.prisma.position.findUniqueOrThrow({
      where: { id },
      include: { _count: { select: { employees: true } } },
    });
    return {
      id: p.id,
      name: p.name,
      level: p.level,
      description: p.description,
      salary: p.salary ? p.salary.toString() : null,
      employeeCount: p._count.employees,
    };
  }

  @Post()
  @RequirePermission('rh:employees:edit')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreatePositionDto) {
    const p = await this.prisma.position.create({
      data: {
        name: dto.name,
        level: dto.level,
        description: dto.description ?? null,
        salary: dto.salary !== undefined ? dto.salary : null,
      },
      include: { _count: { select: { employees: true } } },
    });
    return { id: p.id, name: p.name, level: p.level, description: p.description, salary: p.salary ? p.salary.toString() : null, employeeCount: p._count.employees };
  }

  @Put(':id')
  @RequirePermission('rh:employees:edit')
  @HttpCode(HttpStatus.OK)
  async update(@Param('id') id: string, @Body() dto: UpdatePositionDto) {
    const p = await this.prisma.position.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.level !== undefined ? { level: dto.level } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.salary !== undefined ? { salary: dto.salary } : {}),
      },
      include: { _count: { select: { employees: true } } },
    });
    return { id: p.id, name: p.name, level: p.level, description: p.description, salary: p.salary ? p.salary.toString() : null, employeeCount: p._count.employees };
  }

  @Delete(':id')
  @RequirePermission('rh:employees:edit')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    await this.prisma.position.delete({ where: { id } });
    return { message: 'Cargo excluído com sucesso.', id };
  }
}
