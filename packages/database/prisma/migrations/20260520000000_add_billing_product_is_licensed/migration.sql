-- AddColumn: isLicensed to billing_products
ALTER TABLE "billing_products" ADD COLUMN "isLicensed" BOOLEAN NOT NULL DEFAULT false;
