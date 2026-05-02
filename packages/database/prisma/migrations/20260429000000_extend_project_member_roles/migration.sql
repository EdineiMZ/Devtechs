-- Migration: Extend ProjectMemberRole enum with professional specializations.
-- Adds DESIGNER, QA_ENGINEER, SECURITY_ENGINEER, DEVOPS so the member roster
-- reflects the actual team composition (devs, designers, security engineers, etc.).
-- PostgreSQL requires ADD VALUE statements outside a transaction block; each
-- value addition is DDL-only and does not affect existing rows.

ALTER TYPE "ProjectMemberRole" ADD VALUE IF NOT EXISTS 'DESIGNER';
ALTER TYPE "ProjectMemberRole" ADD VALUE IF NOT EXISTS 'QA_ENGINEER';
ALTER TYPE "ProjectMemberRole" ADD VALUE IF NOT EXISTS 'SECURITY_ENGINEER';
ALTER TYPE "ProjectMemberRole" ADD VALUE IF NOT EXISTS 'DEVOPS';
