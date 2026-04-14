export interface WorkScheduleItem {
  id: string;
  employeeId: string;
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
  saturday: number;
  sunday: number;
  weeklyHours: number;
  effectiveFrom: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  /**
   * Derived field — `true` iff this row is the schedule currently in
   * effect for the employee (the latest one with
   * `effectiveFrom <= today`). The service computes this at read time.
   */
  isCurrent: boolean;
}

export interface WorkScheduleHistoryResponse {
  employeeId: string;
  items: WorkScheduleItem[];
  total: number;
}
