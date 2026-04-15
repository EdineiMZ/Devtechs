-- =============================================================================
-- Migration: add_devops_module
--
-- Environments, pipelines, pipeline logs, deployments, and the
-- environment health-check history table. Mirrors the Prisma
-- schema in schema.prisma.
-- =============================================================================

-- CreateEnum
CREATE TYPE "EnvironmentType" AS ENUM ('PRODUCTION', 'STAGING', 'DEVELOPMENT');

-- CreateEnum
CREATE TYPE "EnvironmentStatus" AS ENUM ('HEALTHY', 'DEGRADED', 'DOWN', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PipelineProvider" AS ENUM ('GITHUB_ACTIONS', 'GITLAB_CI');

-- CreateEnum
CREATE TYPE "PipelineStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PipelineLogStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "DeploymentStatus" AS ENUM (
    'PENDING',
    'RUNNING',
    'SUCCESS',
    'FAILED',
    'ROLLED_BACK'
);

-- CreateTable
CREATE TABLE "devops_environments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "EnvironmentType" NOT NULL,
    "projectId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" "EnvironmentStatus" NOT NULL DEFAULT 'UNKNOWN',
    "lastCheckAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devops_environments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devops_environment_health_checks" (
    "id" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "status" "EnvironmentStatus" NOT NULL,
    "httpStatus" INTEGER,
    "responseTimeMs" INTEGER,
    "error" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devops_environment_health_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devops_pipelines" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "provider" "PipelineProvider" NOT NULL,
    "externalId" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "status" "PipelineStatus" NOT NULL DEFAULT 'QUEUED',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "triggeredBy" TEXT,
    "commitSha" TEXT NOT NULL,
    "commitMessage" TEXT,
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devops_pipelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devops_pipeline_logs" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "output" TEXT NOT NULL,
    "status" "PipelineLogStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "devops_pipeline_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devops_deployments" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "status" "DeploymentStatus" NOT NULL DEFAULT 'PENDING',
    "deployedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rolledBackAt" TIMESTAMP(3),
    "deployedBy" TEXT NOT NULL,

    CONSTRAINT "devops_deployments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "devops_environments_projectId_idx" ON "devops_environments"("projectId");
CREATE INDEX "devops_environments_status_idx" ON "devops_environments"("status");

CREATE INDEX "devops_environment_health_checks_environmentId_checkedAt_idx"
    ON "devops_environment_health_checks"("environmentId", "checkedAt");

CREATE UNIQUE INDEX "devops_pipelines_provider_externalId_key"
    ON "devops_pipelines"("provider", "externalId");
CREATE INDEX "devops_pipelines_projectId_status_idx" ON "devops_pipelines"("projectId", "status");
CREATE INDEX "devops_pipelines_status_idx" ON "devops_pipelines"("status");
CREATE INDEX "devops_pipelines_branch_idx" ON "devops_pipelines"("branch");
CREATE INDEX "devops_pipelines_startedAt_idx" ON "devops_pipelines"("startedAt");

CREATE INDEX "devops_pipeline_logs_pipelineId_startedAt_idx"
    ON "devops_pipeline_logs"("pipelineId", "startedAt");

CREATE INDEX "devops_deployments_pipelineId_idx" ON "devops_deployments"("pipelineId");
CREATE INDEX "devops_deployments_environmentId_deployedAt_idx"
    ON "devops_deployments"("environmentId", "deployedAt");
CREATE INDEX "devops_deployments_status_idx" ON "devops_deployments"("status");
CREATE INDEX "devops_deployments_deployedBy_idx" ON "devops_deployments"("deployedBy");

-- AddForeignKey
ALTER TABLE "devops_environments"
    ADD CONSTRAINT "devops_environments_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "devops_environment_health_checks"
    ADD CONSTRAINT "devops_environment_health_checks_environmentId_fkey"
    FOREIGN KEY ("environmentId") REFERENCES "devops_environments"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "devops_pipelines"
    ADD CONSTRAINT "devops_pipelines_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "devops_pipeline_logs"
    ADD CONSTRAINT "devops_pipeline_logs_pipelineId_fkey"
    FOREIGN KEY ("pipelineId") REFERENCES "devops_pipelines"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "devops_deployments"
    ADD CONSTRAINT "devops_deployments_pipelineId_fkey"
    FOREIGN KEY ("pipelineId") REFERENCES "devops_pipelines"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "devops_deployments"
    ADD CONSTRAINT "devops_deployments_environmentId_fkey"
    FOREIGN KEY ("environmentId") REFERENCES "devops_environments"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "devops_deployments"
    ADD CONSTRAINT "devops_deployments_deployedBy_fkey"
    FOREIGN KEY ("deployedBy") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
