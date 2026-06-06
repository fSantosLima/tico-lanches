-- Redefine Sale as a daily aggregate: truncate existing dev data, then alter the table.

-- Step 1: Drop existing sale data (authorized — this is dev data)
TRUNCATE TABLE "Sale";

-- Step 2: Drop old column
ALTER TABLE "Sale" DROP COLUMN "value";

-- Step 3: Add new required columns
ALTER TABLE "Sale" ADD COLUMN "date" DATE NOT NULL;
ALTER TABLE "Sale" ADD COLUMN "quantity" INTEGER NOT NULL;
ALTER TABLE "Sale" ADD COLUMN "unitPrice" DOUBLE PRECISION NOT NULL;
ALTER TABLE "Sale" ADD COLUMN "unitCost" DOUBLE PRECISION NOT NULL;
ALTER TABLE "Sale" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now();

-- Step 4: Add unique constraint
CREATE UNIQUE INDEX "Sale_userId_productId_date_key" ON "Sale"("userId", "productId", "date");
