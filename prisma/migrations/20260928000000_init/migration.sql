-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "categoryId" TEXT NOT NULL,
    "subcategoryId" TEXT,
    "stationId" TEXT,
    "sku" TEXT NOT NULL DEFAULT '',
    "barcode" TEXT NOT NULL DEFAULT '',
    "isSellable" BOOLEAN NOT NULL DEFAULT false,
    "saleType" TEXT,
    "itemType" TEXT,
    "beverageSize" TEXT,
    "soldBy" TEXT NOT NULL DEFAULT 'each',
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "marketPrice" DOUBLE PRECISION,
    "purchaseQuantity" DOUBLE PRECISION,
    "inventoryType" TEXT NOT NULL DEFAULT 'simple',
    "trackStock" BOOLEAN NOT NULL DEFAULT false,
    "stockBatches" JSONB NOT NULL DEFAULT '[]',
    "lowStockThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "components" JSONB NOT NULL DEFAULT '[]',
    "yield" DOUBLE PRECISION,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "taxIds" JSONB NOT NULL DEFAULT '[]',
    "posRepresentationType" TEXT NOT NULL DEFAULT 'color',
    "posColor" TEXT NOT NULL DEFAULT '#cccccc',
    "posShape" TEXT NOT NULL DEFAULT 'square',
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subcategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "Subcategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Station" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Station_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tax" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxType" TEXT,

    CONSTRAINT "Tax_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "photoURL" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "passwordHash" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_uid_key" ON "User"("uid");

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotal" DOUBLE PRECISION,
    "deliveryFee" DOUBLE PRECISION,
    "discount" JSONB,
    "userId" TEXT,
    "status" TEXT,
    "ticketNumber" TEXT,
    "completedAt" TIMESTAMP(3),
    "items" JSONB NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockReceipt" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL DEFAULT '',
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'units',
    "batchId" TEXT NOT NULL,
    "batchDetails" JSONB,
    "recordedByName" TEXT,

    CONSTRAINT "StockReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WasteEvent" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL DEFAULT '',
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'units',
    "userId" TEXT NOT NULL,
    "recordedByName" TEXT NOT NULL DEFAULT '',
    "batchId" TEXT,
    "reason" TEXT NOT NULL DEFAULT '',
    "eventType" TEXT NOT NULL DEFAULT 'waste',

    CONSTRAINT "WasteEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL,
    "defaultSaleType" TEXT NOT NULL DEFAULT 'dine-in',
    "currency" TEXT NOT NULL DEFAULT 'USD',

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);
