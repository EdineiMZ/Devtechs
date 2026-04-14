import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@devtechs/database';
import {
  STORAGE,
  generateKey,
  type StorageAdapter,
} from '@devtechs/storage';

import { PrismaService } from '../../prisma/prisma.service';

import type { CreateEmployeeDto } from './dto/create-employee.dto';
import type {
  DocumentDeleteResponse,
  DocumentUploadResponse,
  EmployeeDetail,
  EmployeeDocumentDto,
  EmployeeListItem,
  PaginatedEmployees,
} from './dto/employee-response.dto';
import type { QueryEmployeesDto } from './dto/query-employees.dto';
import type { UpdateEmployeeDto } from './dto/update-employee.dto';
import type {
  EmployeeDocumentTypeLiteral,
  UploadEmployeeDocumentDto,
} from './dto/upload-document.dto';

/**
 * Prisma include clause shared by every fetch path so `toListItem` /
 * `toDetail` can assume the nested shape.
 */
const EMPLOYEE_WITH_RELATIONS = {
  position: { select: { id: true, name: true, level: true } },
  department: { select: { id: true, name: true } },
  manager: { select: { id: true, name: true, email: true } },
} satisfies Prisma.EmployeeInclude;

const EMPLOYEE_DETAIL_INCLUDE = {
  ...EMPLOYEE_WITH_RELATIONS,
  subordinates: { select: { id: true, name: true, email: true } },
  documents: { orderBy: { uploadedAt: 'desc' as const } },
} satisfies Prisma.EmployeeInclude;

type EmployeeWithRelations = Prisma.EmployeeGetPayload<{
  include: typeof EMPLOYEE_WITH_RELATIONS;
}>;

type EmployeeWithFullDetail = Prisma.EmployeeGetPayload<{
  include: typeof EMPLOYEE_DETAIL_INCLUDE;
}>;

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE) private readonly storage: StorageAdapter,
  ) {}

  // ===================================================================
  // List + pagination
  // ===================================================================

  async list(query: QueryEmployeesDto): Promise<PaginatedEmployees> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;

    const where: Prisma.EmployeeWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.positionId) where.positionId = query.positionId;
    if (query.managerId) where.managerId = query.managerId;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // Single transaction so count + page stay consistent under
    // concurrent writes.
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.employee.count({ where }),
      this.prisma.employee.findMany({
        where,
        include: EMPLOYEE_WITH_RELATIONS,
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map((r) => this.toListItem(r)),
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  // ===================================================================
  // Detail
  // ===================================================================

  async get(id: string): Promise<EmployeeDetail> {
    const row = await this.prisma.employee.findUnique({
      where: { id },
      include: EMPLOYEE_DETAIL_INCLUDE,
    });
    if (!row) throw new NotFoundException('Employee not found');

    // Enrich every document with a short-lived signed URL. The
    // signed URL is scoped to this read-only detail fetch; the raw
    // `fileKey` stays on the row for programmatic use.
    const documents: EmployeeDocumentDto[] = await Promise.all(
      row.documents.map(async (doc) => ({
        ...this.toDocumentDto(doc),
        downloadUrl: await this.safeSignedUrl(doc.fileKey, 15 * 60),
      })),
    );

    return this.toDetail(row, documents);
  }

  // ===================================================================
  // Create
  // ===================================================================

  async create(dto: CreateEmployeeDto): Promise<EmployeeDetail> {
    await this.assertUniqueFields(dto.email, dto.cpf);
    await this.assertRelationsExist(dto);

    const row = await this.prisma.employee.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone ?? null,
        cpf: dto.cpf,
        birthDate: new Date(dto.birthDate),
        hireDate: new Date(dto.hireDate),
        positionId: dto.positionId,
        departmentId: dto.departmentId,
        managerId: dto.managerId ?? null,
        userId: dto.userId ?? null,
        status: 'ACTIVE',
      },
      include: EMPLOYEE_DETAIL_INCLUDE,
    });

    this.logger.log(`Created employee ${row.email} (${row.id})`);
    return this.toDetail(row, row.documents.map((d) => this.toDocumentDto(d)));
  }

  // ===================================================================
  // Update
  // ===================================================================

  async update(id: string, dto: UpdateEmployeeDto): Promise<EmployeeDetail> {
    const existing = await this.prisma.employee.findUnique({
      where: { id },
      select: { id: true, email: true, cpf: true },
    });
    if (!existing) throw new NotFoundException('Employee not found');

    // Uniqueness check — only if the caller is actually changing
    // one of the unique fields, and only against OTHER rows.
    if (dto.email && dto.email !== existing.email) {
      await this.assertUniqueEmailExcept(id, dto.email);
    }
    if (dto.cpf && dto.cpf !== existing.cpf) {
      await this.assertUniqueCpfExcept(id, dto.cpf);
    }

    // Validate any relation IDs the caller is pointing at.
    await this.assertRelationsExist({
      positionId: dto.positionId,
      departmentId: dto.departmentId,
      managerId: dto.managerId,
    });

    // Guard against pointing `managerId` at self — that creates a
    // cycle at depth 1 and breaks hierarchy traversal downstream.
    if (dto.managerId && dto.managerId === id) {
      throw new BadRequestException('An employee cannot be their own manager');
    }

    const data: Prisma.EmployeeUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.cpf !== undefined) data.cpf = dto.cpf;
    if (dto.birthDate !== undefined) data.birthDate = new Date(dto.birthDate);
    if (dto.hireDate !== undefined) data.hireDate = new Date(dto.hireDate);
    if (dto.dismissDate !== undefined) {
      data.dismissDate = dto.dismissDate ? new Date(dto.dismissDate) : null;
    }
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.positionId !== undefined) {
      data.position = { connect: { id: dto.positionId } };
    }
    if (dto.departmentId !== undefined) {
      data.department = { connect: { id: dto.departmentId } };
    }
    if (dto.managerId !== undefined) {
      data.manager = dto.managerId
        ? { connect: { id: dto.managerId } }
        : { disconnect: true };
    }

    const row = await this.prisma.employee.update({
      where: { id },
      data,
      include: EMPLOYEE_DETAIL_INCLUDE,
    });

    this.logger.log(`Updated employee ${row.email} (${row.id})`);
    return this.toDetail(row, row.documents.map((d) => this.toDocumentDto(d)));
  }

  // ===================================================================
  // Soft delete — mark as DISMISSED, set dismissDate.
  // ===================================================================

  async remove(id: string): Promise<{ message: string; id: string }> {
    const existing = await this.prisma.employee.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!existing) throw new NotFoundException('Employee not found');

    if (existing.status === 'DISMISSED') {
      // Idempotent: second delete is a no-op with a friendly message.
      return { message: 'Employee was already dismissed', id };
    }

    await this.prisma.employee.update({
      where: { id },
      data: {
        status: 'DISMISSED',
        dismissDate: new Date(),
      },
    });

    this.logger.log(`Dismissed employee ${id}`);
    return { message: 'Employee dismissed (soft delete)', id };
  }

  // ===================================================================
  // Document upload
  // ===================================================================

  async uploadDocument(
    employeeId: string,
    dto: UploadEmployeeDocumentDto,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  ): Promise<DocumentUploadResponse> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    if (!file?.buffer) {
      throw new BadRequestException('File is required');
    }

    // Store under a per-employee folder so listing/backup is easy
    // and documents never collide with those of another employee.
    const key = generateKey(
      `rh/employees/${employeeId}/documents`,
      file.originalname,
    );

    const upload = await this.storage.upload(key, file.buffer, file.mimetype);

    const row = await this.prisma.employeeDocument.create({
      data: {
        employeeId,
        name: dto.name,
        type: dto.type as EmployeeDocumentTypeLiteral,
        fileKey: upload.key,
        fileSize: file.size,
        mimeType: file.mimetype,
      },
    });

    this.logger.log(
      `Uploaded document ${row.id} (${dto.type}) for employee ${employeeId}`,
    );

    return {
      message: 'Document uploaded successfully',
      document: this.toDocumentDto(row),
    };
  }

  // ===================================================================
  // Document delete
  // ===================================================================

  async deleteDocument(
    employeeId: string,
    documentId: string,
  ): Promise<DocumentDeleteResponse> {
    const doc = await this.prisma.employeeDocument.findUnique({
      where: { id: documentId },
      select: { id: true, employeeId: true, fileKey: true },
    });
    if (!doc) {
      throw new NotFoundException('Document not found');
    }
    if (doc.employeeId !== employeeId) {
      // Refuse to delete a document that belongs to a different
      // employee — prevents accidental cross-tenant deletes via
      // mis-quoted IDs in the URL.
      throw new BadRequestException(
        'Document does not belong to the given employee',
      );
    }

    // Remove the row first; then delete from storage. If the storage
    // call fails we've already removed the DB pointer, but we log
    // the orphan for a later garbage-collection sweep.
    await this.prisma.employeeDocument.delete({ where: { id: documentId } });
    try {
      await this.storage.delete(doc.fileKey);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Orphaned storage object for deleted document ${documentId}: ${doc.fileKey} — ${reason}`,
      );
    }

    return {
      message: 'Document deleted',
      documentId,
    };
  }

  // ===================================================================
  // Helpers
  // ===================================================================

  private async assertUniqueFields(email: string, cpf: string): Promise<void> {
    const existing = await this.prisma.employee.findFirst({
      where: { OR: [{ email }, { cpf }] },
      select: { id: true, email: true, cpf: true },
    });
    if (existing) {
      if (existing.email === email) {
        throw new ConflictException('Email is already in use');
      }
      if (existing.cpf === cpf) {
        throw new ConflictException('CPF is already in use');
      }
    }
  }

  private async assertUniqueEmailExcept(id: string, email: string): Promise<void> {
    const existing = await this.prisma.employee.findFirst({
      where: { email, NOT: { id } },
      select: { id: true },
    });
    if (existing) throw new ConflictException('Email is already in use');
  }

  private async assertUniqueCpfExcept(id: string, cpf: string): Promise<void> {
    const existing = await this.prisma.employee.findFirst({
      where: { cpf, NOT: { id } },
      select: { id: true },
    });
    if (existing) throw new ConflictException('CPF is already in use');
  }

  /**
   * Verify every relation id the caller passed in points at an
   * existing row. Cheaper to fail here with a clean 400 than to
   * let Prisma raise a `P2025 foreign key` error.
   */
  private async assertRelationsExist(input: {
    positionId?: string;
    departmentId?: string;
    managerId?: string;
  }): Promise<void> {
    const checks: Promise<void>[] = [];
    if (input.positionId) {
      checks.push(
        this.prisma.position
          .findUnique({ where: { id: input.positionId }, select: { id: true } })
          .then((row) => {
            if (!row) throw new BadRequestException(`Unknown positionId: ${input.positionId}`);
          }),
      );
    }
    if (input.departmentId) {
      checks.push(
        this.prisma.department
          .findUnique({ where: { id: input.departmentId }, select: { id: true } })
          .then((row) => {
            if (!row) throw new BadRequestException(`Unknown departmentId: ${input.departmentId}`);
          }),
      );
    }
    if (input.managerId) {
      checks.push(
        this.prisma.employee
          .findUnique({ where: { id: input.managerId }, select: { id: true } })
          .then((row) => {
            if (!row) throw new BadRequestException(`Unknown managerId: ${input.managerId}`);
          }),
      );
    }
    await Promise.all(checks);
  }

  private async safeSignedUrl(
    key: string,
    expiresInSeconds: number,
  ): Promise<string | undefined> {
    try {
      return await this.storage.getSignedUrl(key, expiresInSeconds);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to sign URL for ${key}: ${reason}`);
      return undefined;
    }
  }

  // ---- Response mappers ----

  private toListItem(row: EmployeeWithRelations): EmployeeListItem {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      status: row.status,
      hireDate: row.hireDate.toISOString(),
      dismissDate: row.dismissDate ? row.dismissDate.toISOString() : null,
      position: {
        id: row.position.id,
        name: row.position.name,
        level: row.position.level,
      },
      department: {
        id: row.department.id,
        name: row.department.name,
      },
      manager: row.manager
        ? { id: row.manager.id, name: row.manager.name, email: row.manager.email }
        : null,
    };
  }

  private toDetail(
    row: EmployeeWithFullDetail,
    documents: EmployeeDocumentDto[],
  ): EmployeeDetail {
    const base = this.toListItem(row);
    return {
      ...base,
      phone: row.phone,
      cpf: row.cpf,
      birthDate: row.birthDate.toISOString(),
      userId: row.userId,
      documents,
      subordinates: row.subordinates.map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email,
      })),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toDocumentDto(doc: {
    id: string;
    name: string;
    type: string;
    fileKey: string;
    fileSize: number | null;
    mimeType: string | null;
    uploadedAt: Date;
  }): EmployeeDocumentDto {
    return {
      id: doc.id,
      name: doc.name,
      type: doc.type,
      fileKey: doc.fileKey,
      fileSize: doc.fileSize,
      mimeType: doc.mimeType,
      uploadedAt: doc.uploadedAt.toISOString(),
    };
  }
}
