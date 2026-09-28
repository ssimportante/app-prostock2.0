# ProStock Business Logic Specification

> All calculations, workflows, and data integrity rules. Use this to reimplement logic in Base44's formula/action system.

---

## 1. Cost Calculation (Item Form)

Cost is auto-calculated when saving an item. The logic differs for simple vs composite items.

### 1.1 Simple Item Cost

```
INPUT: marketPrice (purchase price for pack), purchaseQuantity (units in pack), taxIds[]
OUTPUT: cost (per-unit cost)

FUNCTION calculateSimpleCost(marketPrice, purchaseQuantity, taxIds):
    priceWithTaxes = marketPrice
    
    IF taxIds is not empty:
        taxes = fetchTaxDocs(taxIds)
        additiveTaxes = taxes WHERE taxType == 'additive' OR taxType is undefined
        compoundedTaxes = taxes WHERE taxType == 'compounded'
        
        totalAdditiveRate = SUM(additiveTaxes.rate)
        priceWithTaxes = marketPrice * (1 + totalAdditiveRate / 100)
        
        SORT compoundedTaxes BY name ASC
        FOR EACH tax IN compoundedTaxes:
            priceWithTaxes = priceWithTaxes * (1 + tax.rate / 100)
    
    IF priceWithTaxes > 0 AND purchaseQuantity > 0:
        cost = priceWithTaxes / purchaseQuantity
    ELSE:
        cost = 0
    
    RETURN roundTo(cost, 4)
```

### 1.2 Composite Item Cost

```
INPUT: components[] (itemId, quantity), yield, taxIds[]
OUTPUT: cost (per-unit cost after yield)

FUNCTION calculateCompositeCost(components, yield, taxIds):
    baseCost = 0
    FOR EACH component IN components:
        componentItem = fetchItem(component.itemId)
        baseCost += componentItem.cost * component.quantity
    
    costWithTaxes = baseCost
    IF taxIds is not empty:
        // Same tax logic as simple items
        taxes = fetchTaxDocs(taxIds)
        additiveTaxes = taxes WHERE taxType == 'additive' OR taxType is undefined
        compoundedTaxes = taxes WHERE taxType == 'compounded'
        
        totalAdditiveRate = SUM(additiveTaxes.rate)
        costWithTaxes = baseCost * (1 + totalAdditiveRate / 100)
        
        SORT compoundedTaxes BY name ASC
        FOR EACH tax IN compoundedTaxes:
            costWithTaxes = costWithTaxes * (1 + tax.rate / 100)
    
    recipeYield = yield OR 1
    cost = costWithTaxes / recipeYield
    
    RETURN roundTo(cost, 4)
```

### Tax Application Rules
- **Additive taxes**: Sum all additive rates, apply as `price * (1 + totalRate / 100)`
- **Compounded taxes**: Apply sequentially (each compounds on the previous), sorted by name ascending
- If `taxType` is undefined, it defaults to `'additive'`

---

## 2. Stock Value Calculations (Dashboard)

### 2.1 Total Stock Value

```
FUNCTION calculateStockValue(items):
    totalStockValue = 0
    ingredientValue = 0
    packagingValue = 0
    
    FOR EACH item IN items WHERE item.trackStock == true:
        totalStock = SUM(item.stockBatches.quantity)
        itemValue = roundTo(totalStock) * item.cost
        totalStockValue += itemValue
        
        IF item.categoryId == ingredientCategoryId:
            ingredientValue += itemValue
        ELSE IF item.categoryId == packagingCategoryId:
            packagingValue += itemValue
    
    RETURN { totalStockValue, ingredientValue, packagingValue }
```

**Category lookup:** Find categories by name (case-insensitive):
- `"ingredient"` or `"ingredients"` → ingredient category
- `"packaging"` → packaging category

### 2.2 Low Stock Detection

```
FUNCTION getLowStockItems(items):
    RETURN items WHERE:
        item.trackStock == true
        AND item.lowStockThreshold > 0
        AND item.stockBatches is not empty
        AND SUM(item.stockBatches.quantity) > 0
        AND SUM(item.stockBatches.quantity) <= item.lowStockThreshold
```

### 2.3 Expiring Items Detection

```
FUNCTION getExpiringItems(items, monthsAhead):
    expiring = []
    thresholdDate = addMonths(now(), monthsAhead)  // typically 3 months
    
    FOR EACH item IN items WHERE item.trackStock AND item.stockBatches not empty:
        FOR EACH batch IN item.stockBatches:
            effectiveExpiryDate = null
            
            IF batch.expiryDate exists:
                effectiveExpiryDate = new Date(batch.expiryDate)
            ELSE IF batch.roastDate exists:
                effectiveExpiryDate = addMonths(new Date(batch.roastDate), 3)
                // Coffee: roast date + 3 months = effective expiry
            
            IF effectiveExpiryDate is not null:
                IF effectiveExpiryDate > now() AND thresholdDate > effectiveExpiryDate:
                    expiring.push({
                        itemName: item.name,
                        quantity: batch.quantity,
                        effectiveExpiryDate: effectiveExpiryDate.toISOString(),
                        unit: item.soldBy == 'volume' ? 'g/ml' : 'units'
                    })
    
    SORT expiring BY effectiveExpiryDate ASC
    RETURN expiring
```

---

## 3. COGS & Food Cost Percentage (Dashboard)

### 3.1 COGS Calculation

```
FUNCTION calculateCOGS(sales, items):
    itemsMap = Map(items by id)
    totalCogs = 0
    
    FOR EACH sale IN sales:
        FOR EACH saleItem IN sale.items:
            item = itemsMap.get(saleItem.itemId)
            IF item is null: CONTINUE
            
            effectiveQty = saleItem.quantity - (saleItem.refundedQuantity || 0)
            IF effectiveQty <= 0: CONTINUE
            
            IF item.inventoryType == 'simple':
                totalCogs += item.cost * effectiveQty
            ELSE IF item.inventoryType == 'composite':
                FOR EACH component IN item.components:
                    compItem = itemsMap.get(component.itemId)
                    IF compItem:
                        yieldVal = item.yield || 1
                        totalCogs += compItem.cost * component.quantity * (effectiveQty / yieldVal)
    
    RETURN totalCogs
```

### 3.2 Food Cost Percentage

```
FUNCTION calculateFoodCostPercentage(sales, items):
    totalRevenue = SUM(sale.total for all sales)
    totalCogs = calculateCOGS(sales, items)
    
    IF totalRevenue > 0:
        RETURN (totalCogs / totalRevenue) * 100
    ELSE:
        RETURN 0
```

---

## 4. Inventory Movement Analysis (Dashboard)

Categorizes stock movement into ingredient vs packaging, and tracks consumption, waste, and pull-outs.

```
FUNCTION calculateMovement(sales, wasteEvents, items, categories):
    ingredientCategoryId = findCategoryByName('ingredient' or 'ingredients')
    packagingCategoryId = findCategoryByName('packaging')
    itemsMap = Map(items by id)
    
    movement = {
        ingredient: { stock: 0, consumed: 0, waste: 0, pullOut: 0 },
        packaging: { stock: 0, consumed: 0, waste: 0, pullOut: 0 }
    }
    
    // Stock values from current inventory
    FOR EACH item IN items WHERE trackStock:
        stockValue = SUM(item.stockBatches.quantity) * item.cost
        IF item.categoryId == ingredientCategoryId:
            movement.ingredient.stock += stockValue
        ELSE IF item.categoryId == packagingCategoryId:
            movement.packaging.stock += stockValue
    
    // Waste/pull-out values
    FOR EACH event IN wasteEvents:
        item = itemsMap.get(event.itemId)
        IF item is null: CONTINUE
        
        IF item.categoryId == ingredientCategoryId:
            IF event.eventType == 'waste': movement.ingredient.waste += event.cost
            ELSE: movement.ingredient.pullOut += event.cost
        ELSE IF item.categoryId == packagingCategoryId:
            IF event.eventType == 'waste': movement.packaging.waste += event.cost
            ELSE: movement.packaging.pullOut += event.cost
    
    // Consumption from sales
    FOR EACH sale IN sales:
        FOR EACH saleItem IN sale.items:
            item = itemsMap.get(saleItem.itemId)
            IF item is null: CONTINUE
            effectiveQty = saleItem.quantity - (saleItem.refundedQuantity || 0)
            IF effectiveQty <= 0: CONTINUE
            
            processItem = (targetItem, multiplier) => {
                costValue = targetItem.cost * multiplier
                IF targetItem.categoryId == ingredientCategoryId:
                    movement.ingredient.consumed += costValue
                ELSE IF targetItem.categoryId == packagingCategoryId:
                    movement.packaging.consumed += costValue
            }
            
            IF item.inventoryType == 'simple':
                processItem(item, effectiveQty)
            ELSE IF item.inventoryType == 'composite':
                FOR EACH component IN item.components:
                    compItem = itemsMap.get(component.itemId)
                    IF compItem:
                        yieldVal = item.yield || 1
                        processItem(compItem, component.quantity * (effectiveQty / yieldVal))
    
    RETURN movement
```

---

## 5. Waste/Pull-out Summary (Dashboard)

```
FUNCTION calculateWasteSummary(wasteEvents):
    totalWasteValue = SUM(event.cost WHERE event.eventType == 'waste' OR event.eventType is undefined)
    totalPullOutValue = SUM(event.cost WHERE event.eventType == 'pull-out')
    RETURN { totalWasteValue, totalPullOutValue }
```

---

## 6. Stock Deduction — Sales Terminal (FIFO)

When a sale is completed, stock is deducted using FIFO (First In, First Out) by expiry date.

### 6.1 Simple Item Deduction

```
FUNCTION deductStock(item, quantityToDeduct):
    IF NOT item.trackStock: RETURN
    
    totalStock = SUM(item.stockBatches.quantity)
    IF totalStock < quantityToDeduct:
        THROW Error("Not enough stock for " + item.name)
    
    // Sort batches by expiry date (earliest first)
    sortedBatches = item.stockBatches.sort((a, b) => {
        IF a.expiryDate AND b.expiryDate:
            RETURN new Date(a.expiryDate) - new Date(b.expiryDate)
        IF a.expiryDate: RETURN -1  // batches with expiry go first
        IF b.expiryDate: RETURN 1
        RETURN 0
    })
    
    remaining = quantityToDeduct
    FOR EACH batch IN sortedBatches:
        IF remaining <= 0: BREAK
        deduct = MIN(remaining, batch.quantity)
        batch.quantity = roundTo(batch.quantity - deduct)
        remaining = roundTo(remaining - deduct)
    
    // Remove empty batches
    item.stockBatches = item.stockBatches.filter(batch => batch.quantity > 0)
```

### 6.2 Composite Item Deduction

For composite items, stock is deducted from each component ingredient (not the composite item itself).

```
FUNCTION deductCompositeStock(compositeItem, quantitySold, allItems):
    yieldVal = compositeItem.yield || 1
    factor = quantitySold / yieldVal
    
    FOR EACH component IN compositeItem.components:
        componentItem = allItems.get(component.itemId)
        IF componentItem AND componentItem.trackStock:
            deductStock(componentItem, component.quantity * factor)
```

### 6.3 Sale Creation (Batched Write)

```
FUNCTION completeSale(cart, saleDate, userId, items):
    // 1. Deduct stock for all cart items
    FOR EACH cartItem IN cart:
        item = items.get(cartItem.id)
        IF item.inventoryType == 'simple' AND item.trackStock:
            deductStock(item, cartItem.quantity)
        ELSE IF item.inventoryType == 'composite':
            deductCompositeStock(item, cartItem.quantity, items)
    
    // 2. Create sale document
    sale = {
        date: Timestamp.fromDate(saleDate),
        total: cartTotal,
        subtotal: cartSubtotal,
        userId: userId,
        status: 'pending',
        ticketNumber: random 3-digit string,
        items: cart.map(ci => ({
            itemId: ci.id,
            quantity: ci.quantity,
            price: ci.price,
            discount: ci.discount  // if exists
        })),
        discount: overallDiscount,  // if exists
        deliveryFee: deliveryFee  // if delivery
    }
    
    // 3. Batch write: create sale + update all modified items
    batch.set(saleRef, sale)
    FOR EACH modifiedItem:
        batch.update(itemRef, { stockBatches: modifiedItem.stockBatches })
    batch.commit()
```

### 6.4 Sale Deletion (Stock Restoration)

Deleting a sale restores stock to the items.

```
FUNCTION deleteSale(sale, allItems):
    FOR EACH saleItem IN sale.items:
        item = allItems.get(saleItem.itemId)
        
        IF item.inventoryType == 'simple' AND item.trackStock:
            restoreStock(item, saleItem.quantity)
        ELSE IF item.inventoryType == 'composite':
            FOR EACH component IN item.components:
                compItem = allItems.get(component.itemId)
                IF compItem AND compItem.trackStock:
                    restoreStock(compItem, component.quantity * saleItem.quantity)
    
    // Delete the sale document
    delete(saleRef)

FUNCTION restoreStock(item, quantity):
    IF NOT item.trackStock: RETURN
    IF item.stockBatches.length > 0:
        item.stockBatches[0].quantity += quantity  // add to first batch
    ELSE:
        item.stockBatches.push({
            id: 'restored-' + Date.now(),
            quantity: quantity,
            purchaseDate: today's ISO date
        })
```

---

## 7. Receive Stock Workflow

### 7.1 Receiving New Stock

```
FUNCTION receiveStock(itemId, quantity, purchaseDate, dateType, date):
    item = fetchItem(itemId)
    
    newBatch = {
        id: 'batch-{timestamp}-{random}',
        quantity: roundTo(quantity),
        purchaseDate: purchaseDate.toISOString().split('T')[0]  // YYYY-MM-DD
    }
    
    IF dateType == 'expiry':
        newBatch.expiryDate = format(date, 'yyyy-MM-dd')
    ELSE IF dateType == 'roast':
        newBatch.roastDate = format(date, 'yyyy-MM-dd')
    
    // 1. Add batch to item's stockBatches array
    item.stockBatches.push(newBatch)
    batch.update(itemRef, { stockBatches: item.stockBatches })
    
    // 2. Create stock receipt log
    receipt = {
        date: Timestamp.fromDate(purchaseDate),
        userId: currentUserId,
        itemId: itemId,
        itemName: item.name,
        quantity: newBatch.quantity,
        unit: item.soldBy == 'volume' ? 'g/ml' : 'units',
        batchId: newBatch.id,
        batchDetails: {
            date: newBatch.expiryDate || newBatch.roastDate,
            dateType: dateType  // 'expiry' or 'roast'
        }
    }
    batch.set(receiptRef, receipt)
    batch.commit()
```

### 7.2 Item Category Filtering for Stock Forms

Items are filtered by category type for the receive/waste forms:

```
FUNCTION filterItemsByType(items, categories, type):
    packagingCategoryId = categories.find(c => c.name.toLowerCase() == 'packaging')?.id
    productCategoryId = categories.find(c => c.name.toLowerCase() == 'product' || c.name.toLowerCase() == 'products')?.id
    
    IF type == 'packaging':
        RETURN items WHERE item.categoryId == packagingCategoryId
    IF type == 'product':
        RETURN items WHERE item.categoryId == productCategoryId OR item.isSellable == true
    // 'ingredient' = everything else
    RETURN items WHERE item.categoryId != packagingCategoryId AND item.categoryId != productCategoryId AND NOT item.isSellable
```

---

## 8. Waste Recording Workflow

### 8.1 Simple Item Waste

```
FUNCTION recordWaste(itemId, batchId, quantity, reason, recordedByName, eventType):
    item = fetchItem(itemId)
    batch = item.stockBatches.find(b => b.id == batchId)
    
    IF quantity > batch.quantity:
        THROW Error("Cannot remove more than available in batch")
    
    // Deduct from specific batch
    updatedBatches = item.stockBatches.map(b =>
        b.id == batchId ? { ...b, quantity: roundTo(b.quantity - quantity) } : b
    ).filter(b => b.quantity > 0)
    
    // Create waste event
    wasteEvent = {
        date: now(),
        itemId: itemId,
        itemName: item.name,
        quantity: quantity,
        cost: item.cost * quantity,
        unit: item.soldBy == 'volume' ? 'g/ml' : 'units',
        userId: currentUserId,
        recordedByName: recordedByName,
        reason: reason,
        eventType: eventType,  // 'waste' or 'pull-out'
        batchId: batchId
    }
    
    batch.update(itemRef, { stockBatches: updatedBatches })
    batch.set(wasteEventRef, wasteEvent)
    batch.commit()
```

### 8.2 Composite Item Waste (Recursive Ingredient Deduction)

For composite items, waste proportionally deducts from all component ingredients using FIFO.

```
FUNCTION recordCompositeWaste(compositeItem, quantity, reason, recordedByName, eventType):
    updates = Map()
    
    FUNCTION deductRecursive(targetItem, qty):
        IF targetItem.inventoryType == 'simple':
            IF NOT targetItem.trackStock: RETURN
            
            updateObj = updates.get(targetItem.id) || clone(targetItem.stockBatches)
            remaining = roundTo(qty)
            
            // Sort by FIFO (earliest expiry/purchase first)
            updateObj.stockBatches.sort((a, b) => {
                dateA = a.expiryDate || a.purchaseDate || '9999-12-31'
                dateB = b.expiryDate || b.purchaseDate || '9999-12-31'
                RETURN dateA.localeCompare(dateB)
            })
            
            FOR EACH batch IN updateObj.stockBatches:
                IF remaining <= 0: BREAK
                deduct = MIN(batch.quantity, remaining)
                batch.quantity = roundTo(batch.quantity - deduct)
                remaining = roundTo(remaining - deduct)
            
            updateObj.stockBatches = updateObj.stockBatches.filter(b => b.quantity > 0)
            updates.set(targetItem.id, updateObj)
            
        ELSE IF targetItem.inventoryType == 'composite':
            yieldVal = targetItem.yield || 1
            factor = qty / yieldVal
            FOR EACH component IN targetItem.components:
                compItem = allItems.get(component.itemId)
                IF compItem: deductRecursive(compItem, component.quantity * factor)
    
    deductRecursive(compositeItem, quantity)
    
    // Create waste event (same structure as simple, but without batchId)
    wasteEvent = {
        date: now(),
        itemId: compositeItem.id,
        itemName: compositeItem.name,
        quantity: quantity,
        cost: compositeItem.cost * quantity,
        unit: compositeItem.soldBy == 'volume' ? 'g/ml' : 'units',
        userId: currentUserId,
        recordedByName: recordedByName,
        reason: reason,
        eventType: eventType
        // No batchId for composite items
    }
    
    // Batch write all updates + waste event
    FOR EACH update IN updates:
        batch.update(itemRef, { stockBatches: update.stockBatches })
    batch.set(wasteEventRef, wasteEvent)
    batch.commit()
```

---

## 9. Stock Receipt Deletion (Stock Activity)

Deleting a stock receipt removes the corresponding batch quantity from the item.

```
FUNCTION deleteStockReceipt(receipt):
    item = fetchItem(receipt.itemId)
    batchToDelete = item.stockBatches.find(b => b.id == receipt.batchId)
    
    IF batchToDelete is null:
        // Legacy receipt without matching batch — just delete the receipt
        delete(receiptRef)
        RETURN
    
    IF batchToDelete.quantity < receipt.quantity:
        THROW Error("Stock from this batch has been partially consumed or wasted")
    
    // Reduce batch quantity by receipt amount
    updatedBatches = item.stockBatches.map(b =>
        b.id == receipt.batchId ? { ...b, quantity: b.quantity - receipt.quantity } : b
    ).filter(b => b.quantity > 0)
    
    batch.update(itemRef, { stockBatches: updatedBatches })
    batch.delete(receiptRef)
    batch.commit()
```

---

## 10. Waste Event Deletion (Stock Restoration)

Deleting a waste event restores the quantity back to the item's stock.

```
FUNCTION deleteWasteEvent(wasteEvent):
    item = fetchItem(wasteEvent.itemId)
    
    IF wasteEvent.batchId is null:
        // Legacy event — just delete
        delete(wasteEventRef)
        RETURN
    
    batchToRestore = item.stockBatches.find(b => b.id == wasteEvent.batchId)
    
    IF batchToRestore exists:
        // Restore quantity to existing batch
        updatedBatches = item.stockBatches.map(b =>
            b.id == wasteEvent.batchId ? { ...b, quantity: b.quantity + wasteEvent.quantity } : b
        )
    ELSE:
        // Batch was removed — recreate it
        newBatch = { id: wasteEvent.batchId, quantity: wasteEvent.quantity }
        updatedBatches = [...item.stockBatches, newBatch]
    
    batch.update(itemRef, { stockBatches: updatedBatches })
    batch.delete(wasteEventRef)
    batch.commit()
```

---

## 11. Master Inventory Reconciliation (DataManager)

The most complex operation. Rebuilds every item's stock batches from historical data by replaying all receipts and consumption in chronological order.

```
FUNCTION runGlobalInventoryReconciliation(targetItemId?):
    items = fetchAllItems()
    sales = fetchAllSales()
    receipts = fetchAllReceipts()
    wasteEvents = fetchAllWasteEvents()
    
    FOR EACH item IN items WHERE item.trackStock:
        IF targetItemId AND item.id != targetItemId: CONTINUE
        
        // Step 1: Rebuild original batches from receipts (sorted by date)
        originalBatches = receipts
            .filter(r => r.itemId == item.id)
            .map(r => ({
                id: r.batchId || r.id,
                quantity: r.quantity,
                purchaseDate: r.date.toISOString().split('T')[0],
                expiryDate: r.batchDetails.dateType == 'expiry' ? r.batchDetails.date : undefined,
                roastDate: r.batchDetails.dateType == 'roast' ? r.batchDetails.date : undefined
            }))
            .sort(by earliest expiry/purchase date)  // FIFO order
        
        // Step 2: Calculate total historical consumption
        totalConsumption = 0
        
        // From sales (direct + proportional via composite recipes)
        FOR EACH sale IN sales:
            FOR EACH saleItem IN sale.items:
                product = items.get(saleItem.itemId)
                effectiveQty = saleItem.quantity - (saleItem.refundedQuantity || 0)
                IF effectiveQty <= 0: CONTINUE
                
                IF saleItem.itemId == item.id:
                    totalConsumption += effectiveQty
                ELSE IF product.inventoryType == 'composite':
                    usage = product.components.find(c => c.itemId == item.id)
                    IF usage:
                        yieldVal = product.yield || 1
                        totalConsumption += usage.quantity * (effectiveQty / yieldVal)
        
        // From waste (direct + proportional via composite recipes)
        FOR EACH waste IN wasteEvents:
            wastedItem = items.get(waste.itemId)
            IF waste.itemId == item.id:
                totalConsumption += waste.quantity
            ELSE IF wastedItem.inventoryType == 'composite':
                usage = wastedItem.components.find(c => c.itemId == item.id)
                IF usage:
                    yieldVal = wastedItem.yield || 1
                    totalConsumption += usage.quantity * (waste.quantity / yieldVal)
        
        // Step 3: Apply FIFO deduction
        remainingToDeduct = roundTo(totalConsumption)
        resultingBatches = []
        
        FOR EACH batch IN originalBatches:
            IF remainingToDeduct > 0:
                deduct = MIN(batch.quantity, remainingToDeduct)
                left = roundTo(batch.quantity - deduct)
                remainingToDeduct = roundTo(remainingToDeduct - deduct)
                IF left > 0:
                    resultingBatches.push({ ...batch, quantity: left })
            ELSE:
                resultingBatches.push(batch)
        
        // Update item with reconciled batches
        update(itemRef, { stockBatches: resultingBatches })
```

---

## 12. Rounding Utility

All numeric stock operations use 4-decimal rounding to prevent floating-point errors:

```
FUNCTION roundTo(value, decimals = 4):
    multiplier = Math.pow(10, decimals)
    RETURN Math.round((value + Number.EPSILON) * multiplier) / multiplier
```

---

## 13. Currency Formatting

```
FUNCTION formatCurrency(amount, currency):
    RETURN Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency  // e.g., 'USD', 'PHP'
    }).format(amount)
```

---

## 14. Cart Total Calculation (Sales Terminal)

```
FUNCTION calculateCartTotal(cart, discountType, discountValue, isDelivery, deliveryFee):
    // Gross subtotal
    cartSubtotal = SUM(item.price * item.quantity for all cart items)
    
    // Net subtotal (after item-level discounts)
    cartNetSubtotal = SUM(
        (item.price * item.quantity) - (item.discount?.amount || 0)
        for all cart items
    )
    
    // Overall discount
    IF discountType == 'none': discountAmount = 0
    ELSE IF discountType == 'percent': discountAmount = (cartNetSubtotal * discountValue) / 100
    ELSE IF discountType == 'fixed': discountAmount = MIN(discountValue, cartNetSubtotal)
    
    // Delivery fee
    finalDeliveryFee = isDelivery ? deliveryFee : 0
    
    // Final total
    cartTotal = MAX(0, cartNetSubtotal - discountAmount + finalDeliveryFee)
    
    RETURN { cartSubtotal, cartNetSubtotal, discountAmount, cartTotal }
```

### Item-Level Discount Calculation

```
FUNCTION calculateItemDiscount(item, type, value):
    itemGross = item.price * item.quantity
    IF type == 'percent':
        amount = (itemGross * value) / 100
    ELSE IF type == 'fixed':
        amount = MIN(value, itemGross)
    RETURN { type, value, amount }
```

---

## 15. KDS / Bar Display Logic

### Order Filtering by Station Type

```
FUNCTION filterOrdersByStation(sales, items, stationType):
    activeSales = sales WHERE status IN ['pending', 'preparing']
    
    FOR EACH sale IN activeSales:
        IF stationType == 'kitchen':
            sale.items = sale.items.filter(item =>
                item.itemType == 'food' OR (item.itemType is null AND item.itemType != 'beverage')
            )
        ELSE IF stationType == 'bar':
            sale.items = sale.items.filter(item => item.itemType == 'beverage')
    
    RETURN activeSales.filter(sale => sale.items.length > 0)
```

### Wait Time & Urgency

```
FUNCTION getWaitTime(saleDate):
    RETURN formatDistanceToNow(saleDate)  // e.g., "5 minutes"

FUNCTION getUrgencyLevel(waitMs):
    IF waitMs > 15 * 60 * 1000:  // > 15 minutes
        RETURN 'urgent'  // red, pulsing
    ELSE IF waitMs > 8 * 60 * 1000:  // > 8 minutes
        RETURN 'warning'  // amber
    ELSE:
        RETURN 'normal'  // default
```

### Order Status Updates

```
FUNCTION updateOrderStatus(saleId, newStatus):
    updateData = { status: newStatus }
    IF newStatus == 'completed':
        updateData.completedAt = Timestamp.now()
    update(saleRef, updateData)
```

---

## 16. Item "As Of" Historical Stock Calculation

The Items page supports viewing stock levels as of a historical date by replaying all receipts, sales, and waste events up to that date.

```
FUNCTION calculateStockAsOf(item, asOfDate, sales, receipts, wasteEvents):
    // Get all receipts up to asOfDate
    relevantReceipts = receipts
        .filter(r => r.itemId == item.id AND r.date <= asOfDate)
        .map(r => ({ quantity: r.quantity, date: r.date }))
    
    // Get all consumption up to asOfDate
    totalConsumed = 0
    FOR EACH sale WHERE sale.date <= asOfDate:
        FOR EACH saleItem WHERE saleItem.itemId == item.id:
            totalConsumed += saleItem.quantity - (saleItem.refundedQuantity || 0)
        // Also check composite items that use this item as a component
    
    FOR EACH waste WHERE waste.itemId == item.id AND waste.date <= asOfDate:
        totalConsumed += waste.quantity
    
    totalReceived = SUM(relevantReceipts.quantity)
    stockAsOf = totalReceived - totalConsumed
    
    RETURN stockAsOf
```
