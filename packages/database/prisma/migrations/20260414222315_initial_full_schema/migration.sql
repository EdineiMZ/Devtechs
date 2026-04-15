-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'DISMISSED');

-- CreateEnum
CREATE TYPE "PositionLevel" AS ENUM ('JUNIOR', 'MID', 'SENIOR', 'LEAD', 'MANAGER', 'DIRECTOR');

-- CreateEnum
CREATE TYPE "EmployeeDocumentType" AS ENUM ('CONTRACT', 'ID', 'CERTIFICATE', 'OTHER');

-- CreateEnum
CREATE TYPE "VacationRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VacationRequestType" AS ENUM ('VACATION', 'SICK_LEAVE', 'PERSONAL', 'MATERNITY', 'PATERNITY', 'OTHER');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProjectMemberRole" AS ENUM ('OWNER', 'MANAGER', 'DEVELOPER', 'VIEWER');

-- CreateEnum
CREATE TYPE "SprintStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('STORY', 'BUG', 'TASK', 'EPIC');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE');

-- AlterEnum
ALTER TYPE "PermissionModule" ADD VALUE 'AUTH';

-- CreateTable
CREATE TABLE "rh_employees" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "cpf" TEXT NOT NULL,
    "birthDate" DATE NOT NULL,
    "hireDate" DATE NOT NULL,
    "dismissDate" DATE,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "positionId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "managerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rh_employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rh_positions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "level" "PositionLevel" NOT NULL,
    "salary" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rh_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rh_departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "managerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rh_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rh_employee_documents" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "EmployeeDocumentType" NOT NULL DEFAULT 'OTHER',
    "fileKey" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rh_employee_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rh_vacation_requests" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "VacationRequestType" NOT NULL DEFAULT 'VACATION',
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "daysCount" INTEGER NOT NULL,
    "status" "VacationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "notes" TEXT,
    "rejectionReason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rh_vacation_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rh_work_schedules" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "monday" INTEGER NOT NULL DEFAULT 0,
    "tuesday" INTEGER NOT NULL DEFAULT 0,
    "wednesday" INTEGER NOT NULL DEFAULT 0,
    "thursday" INTEGER NOT NULL DEFAULT 0,
    "friday" INTEGER NOT NULL DEFAULT 0,
    "saturday" INTEGER NOT NULL DEFAULT 0,
    "sunday" INTEGER NOT NULL DEFAULT 0,
    "effectiveFrom" DATE NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rh_work_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rh_performance_reviews" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "period" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rh_performance_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNING',
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "clientId" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ProjectMemberRole" NOT NULL DEFAULT 'DEVELOPER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("projectId","userId")
);

-- CreateTable
CREATE TABLE "project_sprints" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goal" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "SprintStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_sprints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_boards" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_boards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_columns" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "wipLimit" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_tasks" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sprintId" TEXT,
    "columnId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "TaskType" NOT NULL DEFAULT 'TASK',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "assigneeId" TEXT,
    "reporterId" TEXT NOT NULL,
    "estimatedHours" DECIMAL(10,2),
    "loggedHours" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "dueDate" DATE,
    "order" INTEGER NOT NULL DEFAULT 0,
    "labels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_time_entries" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "description" TEXT,
    "hours" DECIMAL(10,2) NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rh_employees_userId_key" ON "rh_employees"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "rh_employees_email_key" ON "rh_employees"("email");

-- CreateIndex
CREATE UNIQUE INDEX "rh_employees_cpf_key" ON "rh_employees"("cpf");

-- CreateIndex
CREATE INDEX "rh_employees_status_idx" ON "rh_employees"("status");

-- CreateIndex
CREATE INDEX "rh_employees_departmentId_idx" ON "rh_employees"("departmentId");

-- CreateIndex
CREATE INDEX "rh_employees_positionId_idx" ON "rh_employees"("positionId");

-- CreateIndex
CREATE INDEX "rh_employees_managerId_idx" ON "rh_employees"("managerId");

-- CreateIndex
CREATE INDEX "rh_employees_hireDate_idx" ON "rh_employees"("hireDate");

-- CreateIndex
CREATE UNIQUE INDEX "rh_positions_name_key" ON "rh_positions"("name");

-- CreateIndex
CREATE INDEX "rh_positions_level_idx" ON "rh_positions"("level");

-- CreateIndex
CREATE UNIQUE INDEX "rh_departments_name_key" ON "rh_departments"("name");

-- CreateIndex
CREATE INDEX "rh_departments_managerId_idx" ON "rh_departments"("managerId");

-- CreateIndex
CREATE INDEX "rh_employee_documents_employeeId_idx" ON "rh_employee_documents"("employeeId");

-- CreateIndex
CREATE INDEX "rh_employee_documents_type_idx" ON "rh_employee_documents"("type");

-- CreateIndex
CREATE INDEX "rh_vacation_requests_employeeId_idx" ON "rh_vacation_requests"("employeeId");

-- CreateIndex
CREATE INDEX "rh_vacation_requests_status_idx" ON "rh_vacation_requests"("status");

-- CreateIndex
CREATE INDEX "rh_vacation_requests_type_idx" ON "rh_vacation_requests"("type");

-- CreateIndex
CREATE INDEX "rh_vacation_requests_startDate_endDate_idx" ON "rh_vacation_requests"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "rh_vacation_requests_reviewedById_idx" ON "rh_vacation_requests"("reviewedById");

-- CreateIndex
CREATE INDEX "rh_work_schedules_employeeId_idx" ON "rh_work_schedules"("employeeId");

-- CreateIndex
CREATE INDEX "rh_work_schedules_effectiveFrom_idx" ON "rh_work_schedules"("effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "rh_work_schedules_employeeId_effectiveFrom_key" ON "rh_work_schedules"("employeeId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "rh_performance_reviews_employeeId_idx" ON "rh_performance_reviews"("employeeId");

-- CreateIndex
CREATE INDEX "rh_performance_reviews_period_idx" ON "rh_performance_reviews"("period");

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- CreateIndex
CREATE INDEX "projects_ownerId_idx" ON "projects"("ownerId");

-- CreateIndex
CREATE INDEX "projects_clientId_idx" ON "projects"("clientId");

-- CreateIndex
CREATE INDEX "project_members_userId_idx" ON "project_members"("userId");

-- CreateIndex
CREATE INDEX "project_members_role_idx" ON "project_members"("role");

-- CreateIndex
CREATE INDEX "project_sprints_projectId_idx" ON "project_sprints"("projectId");

-- CreateIndex
CREATE INDEX "project_sprints_projectId_status_idx" ON "project_sprints"("projectId", "status");

-- CreateIndex
CREATE INDEX "project_boards_projectId_idx" ON "project_boards"("projectId");

-- CreateIndex
CREATE INDEX "project_columns_boardId_order_idx" ON "project_columns"("boardId", "order");

-- CreateIndex
CREATE INDEX "project_tasks_columnId_order_idx" ON "project_tasks"("columnId", "order");

-- CreateIndex
CREATE INDEX "project_tasks_projectId_status_idx" ON "project_tasks"("projectId", "status");

-- CreateIndex
CREATE INDEX "project_tasks_sprintId_idx" ON "project_tasks"("sprintId");

-- CreateIndex
CREATE INDEX "project_tasks_assigneeId_status_idx" ON "project_tasks"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "project_tasks_parentId_idx" ON "project_tasks"("parentId");

-- CreateIndex
CREATE INDEX "project_time_entries_taskId_date_idx" ON "project_time_entries"("taskId", "date");

-- CreateIndex
CREATE INDEX "project_time_entries_userId_date_idx" ON "project_time_entries"("userId", "date");

-- AddForeignKey
ALTER TABLE "rh_employees" ADD CONSTRAINT "rh_employees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rh_employees" ADD CONSTRAINT "rh_employees_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "rh_positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rh_employees" ADD CONSTRAINT "rh_employees_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "rh_departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rh_employees" ADD CONSTRAINT "rh_employees_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "rh_employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rh_departments" ADD CONSTRAINT "rh_departments_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "rh_employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rh_employee_documents" ADD CONSTRAINT "rh_employee_documents_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "rh_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rh_vacation_requests" ADD CONSTRAINT "rh_vacation_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "rh_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rh_vacation_requests" ADD CONSTRAINT "rh_vacation_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "rh_employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rh_work_schedules" ADD CONSTRAINT "rh_work_schedules_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "rh_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rh_performance_reviews" ADD CONSTRAINT "rh_performance_reviews_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "rh_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_sprints" ADD CONSTRAINT "project_sprints_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_boards" ADD CONSTRAINT "project_boards_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_columns" ADD CONSTRAINT "project_columns_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "project_boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "project_sprints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "project_columns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "project_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_time_entries" ADD CONSTRAINT "project_time_entries_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "project_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_time_entries" ADD CONSTRAINT "project_time_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
