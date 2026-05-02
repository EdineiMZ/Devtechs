/**
 * Output shapes for the projects controller. Interfaces (not
 * classes) — ValidationPipe doesn't run on responses.
 */

export interface UserSummary {
  id: string;
  name: string;
  email: string;
}

export interface MilestoneDto {
  id: string;
  title: string;
  description: string | null;
  order: number;
  completedAt: string | null;
  dueDate: string | null;
  createdAt: string;
}

export interface ProjectListItem {
  id: string;
  name: string;
  description: string | null;
  status: string;
  startDate: string;
  endDate: string | null;
  githubRepo: string | null;
  progressPercent: number;
  owner: UserSummary;
  client: UserSummary | null;
  memberCount: number;
  taskCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMemberDto {
  user: UserSummary;
  role: string;
  joinedAt: string;
}

export interface ProjectDetail extends ProjectListItem {
  members: ProjectMemberDto[];
  milestones: MilestoneDto[];
}

export interface PaginatedProjects {
  items: ProjectListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// ---------------------------------------------------------------------
// Board / sprint shapes used by the read endpoints
// ---------------------------------------------------------------------

export interface BoardTaskDto {
  id: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  status: string;
  order: number;
  assignee: UserSummary | null;
  reporter: UserSummary;
  estimatedHours: number | null;
  loggedHours: number;
  dueDate: string | null;
  labels: string[];
  parentId: string | null;
  subtaskCount: number;
  timeEntryCount: number;
  sprintId: string | null;
}

export interface BoardColumnDto {
  id: string;
  name: string;
  order: number;
  wipLimit: number | null;
  taskCount: number;
  /** True iff `wipLimit !== null && taskCount > wipLimit`. */
  overWipLimit: boolean;
  tasks: BoardTaskDto[];
}

export interface BoardResponse {
  board: {
    id: string;
    projectId: string;
    name: string;
  };
  columns: BoardColumnDto[];
}

export interface BurndownDataPoint {
  date: string;
  /** Hours actually remaining at end-of-day (totalHours - cumulativeLogged). */
  remaining: number;
  /** Hours the ideal trajectory says should remain at this date. */
  ideal: number;
  /** Hours logged on this specific day (not cumulative). */
  loggedOnDay: number;
}

export interface ActiveSprintResponse {
  sprint: {
    id: string;
    name: string;
    goal: string | null;
    startDate: string;
    endDate: string;
    status: string;
  };
  tasks: BoardTaskDto[];
  burndown: {
    totalHours: number;
    loggedHours: number;
    remainingHours: number;
    points: BurndownDataPoint[];
  };
}
