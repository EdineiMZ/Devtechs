import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { ProductsService } from './products.service';

@Controller('products')
@UseGuards(PermissionGuard)
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @RequirePermission('licenses:audit:view')
  list(): Promise<unknown[]> {
    return this.products.list();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('dev:config:edit')
  create(@Body() dto: CreateProductDto): Promise<unknown> {
    return this.products.create(dto);
  }

  @Patch(':id')
  @RequirePermission('dev:config:edit')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<unknown> {
    return this.products.update(id, dto);
  }
}
