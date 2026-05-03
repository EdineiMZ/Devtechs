import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

import type { ServiceStatus } from './monitor.service';

export interface AutoRestartedEvent {
  service: string;
  displayName: string;
  ts: string;
}

/**
 * Lightweight in-process event bus for the monitor module.
 * Uses RxJS Subjects (already a project dependency) instead of
 * requiring @nestjs/event-emitter.
 */
@Injectable()
export class MonitorEventBus {
  readonly update$ = new Subject<ServiceStatus>();
  readonly statusChange$ = new Subject<ServiceStatus>();
  readonly autoRestarted$ = new Subject<AutoRestartedEvent>();
}
