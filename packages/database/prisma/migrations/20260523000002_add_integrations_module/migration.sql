-- Migration: add_integrations_module
-- Adds INTEGRATIONS to PermissionModule enum for API key management permissions.

ALTER TYPE "PermissionModule" ADD VALUE IF NOT EXISTS 'INTEGRATIONS';
