import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseFilePipe,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';

import { CreateEmployeeDto } from './dto/create-employee.dto';
import type {
  DocumentDeleteResponse,
  DocumentUploadResponse,
  EmployeeDetail,
  PaginatedEmployees,
} from './dto/employee-response.dto';
import { QueryEmployeesDto } from './dto/query-employees.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { UploadEmployeeDocumentDto } from './dto/upload-document.dto';
import { EmployeesService } from './employees.service';

/** 10 MB hard cap on document uploads. */
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

/**
 * Employees CRUD — all routes gated by `JwtAuthGuard` (global) +
 * `PermissionGuard` with per-route `@RequirePermission()` metadata.
 *
 * The guard stack for each handler runs in this order:
 *   1. `JwtAuthGuard`  (APP_GUARD) — validates the JWT signature +
 *      expiry and populates `request.user`.
 *   2. `PermissionGuard` — reads `@RequirePermission()` metadata,
 *      resolves the user's effective permissions via auth-service
 *      (5-min Redis cache), 403s if any required key is missing.
 *
 * Permissions used here come from the Prisma seed: `rh:employees:view`,
 * `rh:employees:edit`, `rh:documents:upload`.
 */
@Controller('employees')
@UseGuards(PermissionGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  // -----------------------------------------------------------------
  // GET /employees — list with filters + pagination
  // -----------------------------------------------------------------
  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('rh:employees:view')
  list(@Query() query: QueryEmployeesDto): Promise<PaginatedEmployees> {
    return this.employeesService.list(query);
  }

  // -----------------------------------------------------------------
  // GET /employees/:id — detail + documents + subordinates
  // -----------------------------------------------------------------
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('rh:employees:view')
  get(@Param('id') id: string): Promise<EmployeeDetail> {
    return this.employeesService.get(id);
  }

  // -----------------------------------------------------------------
  // POST /employees — create
  // -----------------------------------------------------------------
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('rh:employees:edit')
  create(@Body() dto: CreateEmployeeDto): Promise<EmployeeDetail> {
    return this.employeesService.create(dto);
  }

  // -----------------------------------------------------------------
  // PUT /employees/:id — update
  // -----------------------------------------------------------------
  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('rh:employees:edit')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ): Promise<EmployeeDetail> {
    return this.employeesService.update(id, dto);
  }

  // -----------------------------------------------------------------
  // DELETE /employees/:id — soft delete
  // -----------------------------------------------------------------
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('rh:employees:edit')
  remove(@Param('id') id: string): Promise<{ message: string; id: string }> {
    return this.employeesService.remove(id);
  }

  // -----------------------------------------------------------------
  // POST /employees/:id/documents — upload (multipart/form-data)
  // -----------------------------------------------------------------
  @Post(':id/documents')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('rh:documents:upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadDocument(
    @Param('id') employeeId: string,
    @Body() dto: UploadEmployeeDocumentDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: MAX_DOCUMENT_BYTES })],
      }),
    )
    file: Express.Multer.File,
  ): Promise<DocumentUploadResponse> {
    return this.employeesService.uploadDocument(employeeId, dto, {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    });
  }

  // -----------------------------------------------------------------
  // DELETE /employees/:id/documents/:docId — delete document
  // -----------------------------------------------------------------
  @Delete(':id/documents/:docId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('rh:documents:upload')
  deleteDocument(
    @Param('id') employeeId: string,
    @Param('docId') documentId: string,
  ): Promise<DocumentDeleteResponse> {
    return this.employeesService.deleteDocument(employeeId, documentId);
  }
}
