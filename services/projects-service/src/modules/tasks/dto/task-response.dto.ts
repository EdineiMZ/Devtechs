import type { BoardTaskDto, UserSummary } from '../../projects/dto/project-response.dto';

/** Re-export so tasks consumers don't have to import from the projects module. */
export type { BoardTaskDto, UserSummary };

export interface TaskDetail extends BoardTaskDto {
  projectId: string;
  columnId: string;
  createdAt: string;
  updatedAt: string;
}

export interface MoveTaskResponse {
  message: string;
  task: BoardTaskDto;
  /** True iff the move would have pushed the destination column over its WIP limit. */
  wipWarning: boolean;
}

export interface TimeEntryDto {
  id: string;
  taskId: string;
  userId: string;
  hours: number;
  date: string;
  description: string | null;
  createdAt: string;
}

export interface CreateTimeEntryResponse {
  message: string;
  timeEntry: TimeEntryDto;
  /** New rolled-up `loggedHours` on the task after this entry. */
  taskLoggedHours: number;
}
