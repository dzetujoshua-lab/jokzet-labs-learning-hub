-- CreateEnum
CREATE TYPE "BosPayment" AS ENUM ('CASH', 'MOMO', 'BANK', 'CREDIT');

-- CreateEnum
CREATE TYPE "BosStockReason" AS ENUM ('OPENING', 'RESTOCK', 'SALE', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "BosCustomer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BosCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BosSupplier" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BosSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BosProduct" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "supplierId" TEXT,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'pc',
    "costPesewas" INTEGER NOT NULL,
    "pricePesewas" INTEGER NOT NULL,
    "stockQty" INTEGER NOT NULL DEFAULT 0,
    "reorderLevel" INTEGER NOT NULL DEFAULT 5,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BosProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BosSale" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customerId" TEXT,
    "date" DATE NOT NULL,
    "payment" "BosPayment" NOT NULL DEFAULT 'CASH',
    "totalPesewas" INTEGER NOT NULL,
    "paidPesewas" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BosSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BosSaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPricePesewas" INTEGER NOT NULL,
    "unitCostPesewas" INTEGER NOT NULL,

    CONSTRAINT "BosSaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BosStockMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "supplierId" TEXT,
    "delta" INTEGER NOT NULL,
    "reason" "BosStockReason" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BosStockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BosExpense" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "supplierId" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "date" DATE NOT NULL,
    "amountPesewas" INTEGER NOT NULL,
    "payment" "BosPayment" NOT NULL DEFAULT 'CASH',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BosExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BosCustomer_userId_idx" ON "BosCustomer"("userId");

-- CreateIndex
CREATE INDEX "BosSupplier_userId_idx" ON "BosSupplier"("userId");

-- CreateIndex
CREATE INDEX "BosProduct_userId_idx" ON "BosProduct"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BosProduct_userId_sku_key" ON "BosProduct"("userId", "sku");

-- CreateIndex
CREATE INDEX "BosSale_userId_date_idx" ON "BosSale"("userId", "date");

-- CreateIndex
CREATE INDEX "BosSaleItem_saleId_idx" ON "BosSaleItem"("saleId");

-- CreateIndex
CREATE INDEX "BosSaleItem_productId_idx" ON "BosSaleItem"("productId");

-- CreateIndex
CREATE INDEX "BosStockMovement_productId_createdAt_idx" ON "BosStockMovement"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "BosExpense_userId_date_idx" ON "BosExpense"("userId", "date");

-- AddForeignKey
ALTER TABLE "BosCustomer" ADD CONSTRAINT "BosCustomer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BosSupplier" ADD CONSTRAINT "BosSupplier_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BosProduct" ADD CONSTRAINT "BosProduct_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BosProduct" ADD CONSTRAINT "BosProduct_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "BosSupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BosSale" ADD CONSTRAINT "BosSale_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BosSale" ADD CONSTRAINT "BosSale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "BosCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BosSaleItem" ADD CONSTRAINT "BosSaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "BosSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BosSaleItem" ADD CONSTRAINT "BosSaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "BosProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BosStockMovement" ADD CONSTRAINT "BosStockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "BosProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BosStockMovement" ADD CONSTRAINT "BosStockMovement_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "BosSupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BosExpense" ADD CONSTRAINT "BosExpense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BosExpense" ADD CONSTRAINT "BosExpense_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "BosSupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

