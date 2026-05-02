import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import type { AttachVpsDto } from './dto/attach-vps.dto';
import {
  HostingerApiService,
  type ActuatorOutcome,
  type HostingerAction,
  type HostingerBackup,
  type HostingerFirewallGroup,
  type HostingerMetricsResponse,
  type HostingerOsTemplate,
  type HostingerPtrRecord,
  type HostingerSnapshot,
  type HostingerSshKey,
  type HostingerVm,
  type ReinstallVmInput,
} from './hostinger-api.service';

/**
 * Audit action constants for the VPS module. Mirrors the convention
 * used by `services/auth-service/src/common/constants/audit-actions.ts`,
 * but kept local to developer-service so the service stays free of a
 * cross-service dependency.
 */
export const VpsAuditAction = {
  VPS_ATTACHED: 'VPS_ATTACHED',
  VPS_DETACHED: 'VPS_DETACHED',
  VPS_START: 'VPS_START',
  VPS_STOP: 'VPS_STOP',
  VPS_RESTART: 'VPS_RESTART',
  VPS_SNAPSHOT: 'VPS_SNAPSHOT',
  VPS_SNAPSHOT_DELETE: 'VPS_SNAPSHOT_DELETE',
  VPS_SNAPSHOT_RESTORE: 'VPS_SNAPSHOT_RESTORE',
  VPS_BACKUP_RESTORE: 'VPS_BACKUP_RESTORE',
  VPS_REINSTALL: 'VPS_REINSTALL',
  VPS_PTR_UPDATE: 'VPS_PTR_UPDATE',
} as const;

export type VpsAuditActionType =
  (typeof VpsAuditAction)[keyof typeof VpsAuditAction];

export interface VpsListItem {
  id: string;
  vmId: string;
  label: string;
  hostname: string;
  plan: string;
  dataCenter: string;
  ipv4: string;
  notes: string | null;
  addedAt: Date;
  client: { id: string; name: string; email: string };
  /**
   * Live state pulled from Hostinger. `null` when the upstream lookup
   * fails — the UI shows "—" rather than killing the whole list.
   */
  upstream: HostingerVm | null;
}

export interface VpsDetail {
  vps: VpsListItem;
  metrics: HostingerMetricsResponse | null;
}

@Injectable()
export class VpsService {
  private readonly logger = new Logger(VpsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly hostinger: HostingerApiService,
  ) {}

  // ---------------------------------------------------------------------------
  // Attach / detach
  // ---------------------------------------------------------------------------

  async attach(dto: AttachVpsDto, operatorId: string, ipAddress: string | null): Promise<VpsListItem> {
    // Validate the VM exists on Hostinger before recording the link;
    // otherwise the row would point at an ID that nobody can act on.
    const upstream = await this.hostinger.getVM(dto.vmId);
    if (!upstream) {
      throw new NotFoundException(`Hostinger VM ${dto.vmId} not found`);
    }

    // Verify the client exists.
    const client = await this.prisma.user.findUnique({
      where: { id: dto.clientId },
      select: { id: true, name: true, email: true },
    });
    if (!client) {
      throw new NotFoundException(`Client ${dto.clientId} not found`);
    }

    // Refuse if this VM is already attached anywhere.
    const existing = await this.prisma.clientVPS.findUnique({
      where: { vmId: dto.vmId },
      select: { id: true, clientId: true },
    });
    if (existing) {
      throw new ConflictException(
        `VM ${dto.vmId} is already attached to client ${existing.clientId}. Detach it first.`,
      );
    }

    const created = await this.prisma.clientVPS.create({
      data: {
        clientId: dto.clientId,
        projectId: dto.projectId ?? null,
        vmId: dto.vmId,
        label: dto.label?.trim() || upstream.hostname,
        hostname: upstream.hostname,
        plan: upstream.plan,
        dataCenter: upstream.dataCenter,
        ipv4: upstream.ipv4,
        notes: dto.notes?.trim() || null,
        addedBy: operatorId,
        monthlyPrice: dto.monthlyPrice ?? null,
        billingDayOfMonth: dto.billingDayOfMonth ?? 1,
        suspendAfterDays: dto.suspendAfterDays ?? 3,
      },
    });

    await this.audit(
      VpsAuditAction.VPS_ATTACHED,
      operatorId,
      created.id,
      { vmId: dto.vmId, clientId: dto.clientId },
      ipAddress,
    );

    return this.toListItem(created, client, upstream);
  }

  async detach(id: string, operatorId: string, ipAddress: string | null): Promise<void> {
    const vps = await this.prisma.clientVPS.findUnique({
      where: { id },
      select: { id: true, vmId: true, clientId: true },
    });
    if (!vps) {
      throw new NotFoundException(`VPS link ${id} not found`);
    }
    await this.prisma.clientVPS.delete({ where: { id } });

    await this.audit(
      VpsAuditAction.VPS_DETACHED,
      operatorId,
      id,
      { vmId: vps.vmId, clientId: vps.clientId },
      ipAddress,
    );
  }

  // ---------------------------------------------------------------------------
  // Read paths
  // ---------------------------------------------------------------------------

  /**
   * List every linked VPS, enriched with the live Hostinger state. The
   * upstream calls are made in parallel and tolerated individually so a
   * single failed VM doesn't break the whole table.
   */
  async list(): Promise<VpsListItem[]> {
    const rows = await this.prisma.clientVPS.findMany({
      orderBy: { addedAt: 'desc' },
      include: {
        client: { select: { id: true, name: true, email: true } },
      },
    });

    const enriched = await Promise.all(
      rows.map(async (row) => {
        let upstream: HostingerVm | null = null;
        try {
          upstream = await this.hostinger.getVM(row.vmId);
        } catch (err) {
          this.logger.warn(
            `Failed to fetch upstream state for VM ${row.vmId}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
        return this.toListItem(row, row.client, upstream);
      }),
    );

    return enriched;
  }

  async detail(id: string): Promise<VpsDetail> {
    const row = await this.prisma.clientVPS.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, email: true } },
      },
    });
    if (!row) {
      throw new NotFoundException(`VPS link ${id} not found`);
    }

    // Fetch live VM state and metrics in parallel — fetching sequentially
    // would double the latency since both are independent Hostinger calls.
    const [upstream, metrics] = await Promise.all([
      this.hostinger.getVM(row.vmId).catch((err: unknown) => {
        this.logger.warn(
          `Failed to fetch upstream state for VM ${row.vmId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        return null as HostingerVm | null;
      }),
      this.hostinger.getVMMetrics(row.vmId).catch((err: unknown) => {
        this.logger.warn(
          `Failed to fetch metrics for VM ${row.vmId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        return null as HostingerMetricsResponse | null;
      }),
    ]);

    return {
      vps: this.toListItem(row, row.client, upstream),
      metrics,
    };
  }

  async actions(id: string, page = 1, pageSize = 50): Promise<{ actions: HostingerAction[]; total: number }> {
    const row = await this.requireOwnedVm(id);
    return this.hostinger.getVMActions(row.vmId, page, pageSize);
  }

  async backups(id: string): Promise<HostingerBackup[]> {
    const row = await this.requireOwnedVm(id);
    return this.hostinger.listBackups(row.vmId);
  }

  async snapshots(id: string): Promise<HostingerSnapshot[]> {
    const row = await this.requireOwnedVm(id);
    return this.hostinger.listSnapshots(row.vmId);
  }

  async metrics(id: string): Promise<HostingerMetricsResponse> {
    const row = await this.requireOwnedVm(id);
    return this.hostinger.getVMMetrics(row.vmId);
  }

  // ---------------------------------------------------------------------------
  // Actuator paths
  // ---------------------------------------------------------------------------

  async start(
    id: string,
    operatorId: string,
    ipAddress: string | null,
  ): Promise<ActuatorOutcome & { vmId: string }> {
    const row = await this.requireOwnedVm(id);
    const outcome = await this.hostinger.startVM(row.vmId);
    await this.audit(
      VpsAuditAction.VPS_START,
      operatorId,
      id,
      { vmId: row.vmId, alreadyInState: outcome.alreadyInState },
      ipAddress,
    );
    return { ...outcome, vmId: row.vmId };
  }

  async stop(
    id: string,
    operatorId: string,
    ipAddress: string | null,
  ): Promise<ActuatorOutcome & { vmId: string }> {
    const row = await this.requireOwnedVm(id);
    const outcome = await this.hostinger.stopVM(row.vmId);
    await this.audit(
      VpsAuditAction.VPS_STOP,
      operatorId,
      id,
      { vmId: row.vmId, alreadyInState: outcome.alreadyInState },
      ipAddress,
    );
    return { ...outcome, vmId: row.vmId };
  }

  async restart(
    id: string,
    operatorId: string,
    ipAddress: string | null,
  ): Promise<ActuatorOutcome & { vmId: string }> {
    const row = await this.requireOwnedVm(id);
    const outcome = await this.hostinger.restartVM(row.vmId);
    await this.audit(
      VpsAuditAction.VPS_RESTART,
      operatorId,
      id,
      { vmId: row.vmId, alreadyInState: outcome.alreadyInState },
      ipAddress,
    );
    return { ...outcome, vmId: row.vmId };
  }

  async snapshot(
    id: string,
    label: string | undefined,
    operatorId: string,
    ipAddress: string | null,
  ): Promise<HostingerSnapshot> {
    const row = await this.requireOwnedVm(id);
    const finalLabel = label?.trim() || `manual-${new Date().toISOString()}`;
    const snap = await this.hostinger.createSnapshot(row.vmId, finalLabel);
    await this.audit(
      VpsAuditAction.VPS_SNAPSHOT,
      operatorId,
      id,
      { vmId: row.vmId, snapshotId: snap.id, label: finalLabel },
      ipAddress,
    );
    return snap;
  }

  // ---------------------------------------------------------------------------
  // Snapshot management (delete / restore)
  // ---------------------------------------------------------------------------

  async deleteSnapshot(
    id: string,
    snapshotId: string,
    operatorId: string,
    ipAddress: string | null,
  ): Promise<void> {
    const row = await this.requireOwnedVm(id);
    await this.hostinger.deleteSnapshot(row.vmId, snapshotId);
    await this.audit(
      VpsAuditAction.VPS_SNAPSHOT_DELETE,
      operatorId,
      id,
      { vmId: row.vmId, snapshotId },
      ipAddress,
    );
  }

  async restoreSnapshot(
    id: string,
    snapshotId: string,
    operatorId: string,
    ipAddress: string | null,
  ): Promise<void> {
    const row = await this.requireOwnedVm(id);
    await this.hostinger.restoreFromSnapshot(row.vmId, snapshotId);
    await this.audit(
      VpsAuditAction.VPS_SNAPSHOT_RESTORE,
      operatorId,
      id,
      { vmId: row.vmId, snapshotId },
      ipAddress,
    );
  }

  // ---------------------------------------------------------------------------
  // Backup restore
  // ---------------------------------------------------------------------------

  async restoreBackup(
    id: string,
    backupId: string,
    operatorId: string,
    ipAddress: string | null,
  ): Promise<void> {
    const row = await this.requireOwnedVm(id);
    await this.hostinger.restoreFromBackup(row.vmId, backupId);
    await this.audit(
      VpsAuditAction.VPS_BACKUP_RESTORE,
      operatorId,
      id,
      { vmId: row.vmId, backupId },
      ipAddress,
    );
  }

  // ---------------------------------------------------------------------------
  // Reinstall
  // ---------------------------------------------------------------------------

  async reinstall(
    id: string,
    input: ReinstallVmInput,
    operatorId: string,
    ipAddress: string | null,
  ): Promise<void> {
    const row = await this.requireOwnedVm(id);
    await this.hostinger.reinstallVM(row.vmId, input);
    await this.audit(
      VpsAuditAction.VPS_REINSTALL,
      operatorId,
      id,
      { vmId: row.vmId, templateId: input.templateId },
      ipAddress,
    );
  }

  // ---------------------------------------------------------------------------
  // PTR records
  // ---------------------------------------------------------------------------

  async getPtrRecords(id: string): Promise<HostingerPtrRecord[]> {
    const row = await this.requireOwnedVm(id);
    return this.hostinger.getPtrRecords(row.vmId);
  }

  async updatePtr(
    id: string,
    ipAddress: string,
    ptr: string,
    operatorId: string,
    reqIp: string | null,
  ): Promise<HostingerPtrRecord> {
    const row = await this.requireOwnedVm(id);
    const result = await this.hostinger.updatePtrRecord(row.vmId, ipAddress, ptr);
    await this.audit(
      VpsAuditAction.VPS_PTR_UPDATE,
      operatorId,
      id,
      { vmId: row.vmId, ipAddress, ptr },
      reqIp,
    );
    return result;
  }

  // ---------------------------------------------------------------------------
  // Account-level Hostinger resources (not tied to a specific VM)
  // ---------------------------------------------------------------------------

  listSshKeys(): Promise<HostingerSshKey[]> {
    return this.hostinger.listSshKeys();
  }

  listOsTemplates(): Promise<HostingerOsTemplate[]> {
    return this.hostinger.listOsTemplates();
  }

  listFirewallGroups(): Promise<HostingerFirewallGroup[]> {
    return this.hostinger.listFirewallGroups();
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async requireOwnedVm(id: string): Promise<{ id: string; vmId: string }> {
    const row = await this.prisma.clientVPS.findUnique({
      where: { id },
      select: { id: true, vmId: true },
    });
    if (!row) {
      throw new NotFoundException(`VPS link ${id} not found`);
    }
    return row;
  }

  private toListItem(
    row: {
      id: string;
      vmId: string;
      label: string;
      hostname: string;
      plan: string;
      dataCenter: string;
      ipv4: string;
      notes: string | null;
      addedAt: Date;
    },
    client: { id: string; name: string; email: string },
    upstream: HostingerVm | null,
  ): VpsListItem {
    return {
      id: row.id,
      vmId: row.vmId,
      label: row.label,
      hostname: row.hostname,
      plan: row.plan,
      dataCenter: row.dataCenter,
      ipv4: row.ipv4,
      notes: row.notes,
      addedAt: row.addedAt,
      client,
      upstream,
    };
  }

  private async audit(
    action: VpsAuditActionType,
    userId: string,
    resourceId: string,
    meta: Record<string, unknown>,
    ipAddress: string | null,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action,
          module: 'DEVELOPER',
          userId,
          resourceId,
          meta: meta as object,
          ipAddress: ipAddress ?? undefined,
        },
      });
    } catch (err) {
      // Audit failures must never break the actual action — log and swallow.
      this.logger.warn(
        `Audit write for ${action} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
