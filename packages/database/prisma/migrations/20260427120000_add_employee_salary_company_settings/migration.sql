-- Migration: add_employee_salary_company_settings
-- Adds individual salary field to rh_employees and a singleton company_settings table.

-- 1. Employee individual salary
ALTER TABLE "rh_employees" ADD COLUMN "salary" DECIMAL(14,2);

-- 2. CompanySettings singleton table
CREATE TABLE "company_settings" (
    "id"                        TEXT NOT NULL,
    "singleton"                 BOOLEAN NOT NULL DEFAULT true,
    "name"                      TEXT NOT NULL,
    "tradeName"                 TEXT,
    "cnpj"                      TEXT,
    "stateRegistration"         TEXT,
    "municipalRegistration"     TEXT,
    "email"                     TEXT,
    "phone"                     TEXT,
    "website"                   TEXT,
    "addressStreet"             TEXT,
    "addressNumber"             TEXT,
    "addressComplement"         TEXT,
    "addressNeighborhood"       TEXT,
    "addressCity"               TEXT,
    "addressState"              TEXT,
    "addressZip"                TEXT,
    "paymentAddressStreet"      TEXT,
    "paymentAddressNumber"      TEXT,
    "paymentAddressComplement"  TEXT,
    "paymentAddressNeighborhood" TEXT,
    "paymentAddressCity"        TEXT,
    "paymentAddressState"       TEXT,
    "paymentAddressZip"         TEXT,
    "logoKey"                   TEXT,
    "invoiceFooter"             TEXT,
    "createdAt"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                 TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_settings_singleton_key" ON "company_settings"("singleton");
