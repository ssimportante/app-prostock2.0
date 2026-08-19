
import * as z from 'zod';

export const itemSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().nullable(),
  categoryId: z.string().min(1, 'Category is required.'),
  subcategoryId: z.string().optional().nullable(),
  stationId: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  soldBy: z.enum(['each', 'volume']),

  price: z.coerce.number().min(0, 'Price must be non-negative').optional(),
  marketPrice: z.coerce.number().optional().nullable(),
  purchaseQuantity: z.coerce.number().optional().nullable(),
  
  inventoryType: z.enum(['simple', 'composite']),
  
  trackStock: z.boolean(),
  lowStockThreshold: z.coerce.number().positive("Threshold must be a positive number").optional().nullable(),
  
  initialQuantity: z.coerce.number().positive("Quantity must be positive").optional(),
  initialPurchaseDate: z.date().optional(),
  initialExpiryDate: z.date().optional(),
  initialRoastDate: z.date().optional(),
  
  components: z.array(
    z.object({
      itemId: z.string().min(1, 'Component item is required.'),
      quantity: z.coerce.number().min(0.0001, 'Quantity must be positive'),
    })
  ).optional(),

  yield: z.coerce.number().positive("Yield must be positive").optional().nullable(),

  tags: z.array(z.object({ value: z.string() })).optional(),
  taxIds: z.array(z.string()).optional(),
  
  posRepresentationType: z.enum(['color', 'image']).optional(),
  posColor: z.string().optional(),
  imageUrl: z.string().optional().nullable(),
  
  isSellable: z.boolean(),
  saleType: z.string().optional().nullable(),
  itemType: z.string().optional().nullable(),
  beverageSize: z.string().optional().nullable(),

  cost: z.number().optional(), 
}).superRefine((data, ctx) => {
    if (data.isSellable) {
        if (!data.saleType) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Sale type is required for sellable items.", path: ["saleType"] });
        }
        if (!data.itemType) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Item type is required for sellable items.", path: ["itemType"] });
        }
    }
    if (data.itemType === 'beverage' && (!data.beverageSize || data.beverageSize.trim() === '')) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Beverage size is required.", path: ["beverageSize"] });
    }
    if (data.trackStock && (data.lowStockThreshold === undefined || data.lowStockThreshold === null)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Low stock threshold is required when tracking stock.", path: ["lowStockThreshold"] });
    }
    if (data.inventoryType === 'simple' && data.marketPrice && (!data.purchaseQuantity || data.purchaseQuantity <= 0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Purchase quantity must be positive if Market Price is set.", path: ["purchaseQuantity"] });
    }
    if (data.inventoryType === 'composite') {
        if (!data.components || data.components.length === 0) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Composite items must have at least one component.", path: ["components"] });
        }
        if (data.soldBy === 'volume' && !data.yield) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Standard recipe yield is required for composite items sold by volume.", path: ["yield"] });
        }
    }
});
