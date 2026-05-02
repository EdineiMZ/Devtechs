import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { AttachVpsDto } from './dto/attach-vps.dto';
import { CreateSnapshotDto } from './dto/create-snapshot.dto';
import { ReinstallVpsDto } from './dto/reinstall-vps.dto';
import { UpdatePtrDto } from './dto/update-ptr.dto';
import type { VpsDetail, VpsListItem } from './vps.service';
import { VpsService } from './vps.service';

/**
 * REST surface for the VPS management module.
 *
 * Every route requires `dev:vps:manage`. The class-level guard means a
 * request without that permission gets 403 before any handler runs —
 * we never leak existence of a VM through error timing.
 *
 * Audit: every write path (attach/detach/start/stop/restart/snapshot)
 * writes a row to `audit_logs` from inside `VpsService`, so the
 * controller stays focused on shape and delegates the side-effect.
 */
@Controller('vps')
@UseGuards(PermissionGuard)
@RequirePermission('dev:vps:manage')
export class VpsController {
  constructor(private readonly vps: VpsService) {}

  @Get()
  list(): Promise<VpsListItem[]> {
    return this.vps.list();
  }

  @Post()
  attach(
    @Body() dto: AttachVpsDto,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ): Promise<VpsListItem> {
    return this.vps.attach(dto, user.id, req.ip ?? null);
  }

  @Get(':id')
  detail(@Param('id') id: string): Promise<VpsDetail> {
    return this.vps.detail(id);
  }

  @Delete(':id')
  async detach(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ): Promise<{ ok: true }> {
    await this.vps.detach(id, user.id, req.ip ?? null);
    return { ok: true };
  }

  @Post(':id/start')
  start(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.vps.start(id, user.id, req.ip ?? null);
  }

  @Post(':id/stop')
  stop(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.vps.stop(id, user.id, req.ip ?? null);
  }

  @Post(':id/restart')
  restart(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.vps.restart(id, user.id, req.ip ?? null);
  }

  @Get(':id/actions')
  actions(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const p = Math.max(1, Number.parseInt(page ?? '1', 10) || 1);
    const ps = Math.min(100, Math.max(1, Number.parseInt(pageSize ?? '50', 10) || 50));
    return this.vps.actions(id, p, ps);
  }

  @Get(':id/backups')
  backups(@Param('id') id: string) {
    return this.vps.backups(id);
  }

  @Post(':id/snapshots')
  createSnapshot(
    @Param('id') id: string,
    @Body() dto: CreateSnapshotDto,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.vps.snapshot(id, dto.label, user.id, req.ip ?? null);
  }

  @Get(':id/snapshots')
  listSnapshots(@Param('id') id: string) {
    return this.vps.snapshots(id);
  }

  @Get(':id/metrics')
  metrics(@Param('id') id: string) {
    return this.vps.metrics(id);
  }

  // ---------------------------------------------------------------------------
  // Snapshot: delete + restore
  // ---------------------------------------------------------------------------

  @Delete(':id/snapshots/:snapshotId')
  async deleteSnapshot(
    @Param('id') id: string,
    @Param('snapshotId') snapshotId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ): Promise<{ ok: true }> {
    await this.vps.deleteSnapshot(id, snapshotId, user.id, req.ip ?? null);
    return { ok: true };
  }

  @Post(':id/snapshots/:snapshotId/restore')
  async restoreSnapshot(
    @Param('id') id: string,
    @Param('snapshotId') snapshotId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ): Promise<{ ok: true }> {
    await this.vps.restoreSnapshot(id, snapshotId, user.id, req.ip ?? null);
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Backup restore
  // ---------------------------------------------------------------------------

  @Post(':id/backups/:backupId/restore')
  async restoreBackup(
    @Param('id') id: string,
    @Param('backupId') backupId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ): Promise<{ ok: true }> {
    await this.vps.restoreBackup(id, backupId, user.id, req.ip ?? null);
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Reinstall
  // ---------------------------------------------------------------------------

  @Post(':id/reinstall')
  async reinstall(
    @Param('id') id: string,
    @Body() dto: ReinstallVpsDto,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ): Promise<{ ok: true }> {
    await this.vps.reinstall(id, { templateId: dto.templateId, sshKeyIds: dto.sshKeyIds }, user.id, req.ip ?? null);
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // PTR records
  // ---------------------------------------------------------------------------

  @Get(':id/ptr')
  ptrRecords(@Param('id') id: string) {
    return this.vps.getPtrRecords(id);
  }

  @Put(':id/ptr')
  updatePtr(
    @Param('id') id: string,
    @Body() dto: UpdatePtrDto,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.vps.updatePtr(id, dto.ipAddress, dto.ptr, user.id, req.ip ?? null);
  }

  // ---------------------------------------------------------------------------
  // Account-level resources (SSH keys, OS templates, firewall)
  // These must be defined BEFORE ':id' routes to avoid NestJS matching
  // 'ssh-keys' / 'os-templates' / 'firewall' as the :id param.
  // ---------------------------------------------------------------------------

  @Get('resources/ssh-keys')
  sshKeys() {
    return this.vps.listSshKeys();
  }

  @Get('resources/os-templates')
  osTemplates() {
    return this.vps.listOsTemplates();
  }

  @Get('resources/firewall')
  firewallGroups() {
    return this.vps.listFirewallGroups();
  }
}
