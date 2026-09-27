import { collection, getDocs, writeBatch, doc, addDoc } from 'firebase/firestore';

export async function importItems(
    firestore: any,
    data: any[]
): Promise<{ created: number; categoriesCreated: number; subcategoriesCreated: number }> {
    // 1. Fetch existing categories into a name->id map
    const categoriesSnap = await getDocs(collection(firestore, 'categories'));
    const categoryMap = new Map<string, string>();
    categoriesSnap.docs.forEach(d => {
        categoryMap.set((d.data().name || '').toLowerCase().trim(), d.id);
    });

    // 2. Fetch existing subcategories into a "name|categoryId"->id map
    const subcategoriesSnap = await getDocs(collection(firestore, 'subcategories'));
    const subcategoryMap = new Map<string, string>();
    subcategoriesSnap.docs.forEach(d => {
        const sd = d.data();
        subcategoryMap.set(`${(sd.name || '').toLowerCase().trim()}|${sd.categoryId}`, d.id);
    });

    let categoriesCreated = 0;
    let subcategoriesCreated = 0;

    // 3. Resolve / auto-create categories and subcategories for each row
    for (const row of data) {
        if (row.categoryName) {
            const key = String(row.categoryName).toLowerCase().trim();
            if (categoryMap.has(key)) {
                row.categoryId = categoryMap.get(key);
            } else {
                const newCatRef = await addDoc(collection(firestore, 'categories'), {
                    name: String(row.categoryName).trim(),
                    color: '#3b82f6',
                    itemCount: 0,
                });
                categoryMap.set(key, newCatRef.id);
                row.categoryId = newCatRef.id;
                categoriesCreated++;
            }
        }

        if (row.subcategoryName && row.categoryId) {
            const key = `${String(row.subcategoryName).toLowerCase().trim()}|${row.categoryId}`;
            if (subcategoryMap.has(key)) {
                row.subcategoryId = subcategoryMap.get(key);
            } else {
                const newSubRef = await addDoc(collection(firestore, 'subcategories'), {
                    name: String(row.subcategoryName).trim(),
                    categoryId: row.categoryId,
                });
                subcategoryMap.set(key, newSubRef.id);
                row.subcategoryId = newSubRef.id;
                subcategoriesCreated++;
            }
        }
    }

    // 4. Create items in batches of 30
    const chunkSize = 30;
    for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        const batch = writeBatch(firestore);
        for (const row of chunk) {
            if (!row.name) continue;

            // Convert initialQuantity helper fields to stockBatches
            const initialQty = Number(row.initialQuantity || 0);
            if (initialQty > 0 && (!row.stockBatches || row.stockBatches.length === 0)) {
                const stockBatch: Record<string, any> = {
                    id: `batch-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                    quantity: initialQty,
                    purchaseDate: new Date().toISOString().split('T')[0],
                };
                if (row.initialExpiryDate) stockBatch.expiryDate = row.initialExpiryDate;
                if (row.initialRoastDate) stockBatch.roastDate = row.initialRoastDate;
                row.stockBatches = [stockBatch];
            }

            // Remove helper / non-schema fields
            delete row.initialQuantity;
            delete row.initialExpiryDate;
            delete row.initialRoastDate;
            delete row.categoryName;
            delete row.subcategoryName;

            // Ensure required fields have defaults
            row.description = row.description || '';
            row.sku = row.sku || '';
            row.barcode = row.barcode || '';
            row.soldBy = row.soldBy || 'each';
            row.inventoryType = row.inventoryType || 'simple';
            row.trackStock = row.trackStock !== undefined ? row.trackStock : true;
            row.lowStockThreshold = row.lowStockThreshold || 0;
            row.price = row.price || 0;
            row.cost = row.cost || 0;
            row.components = row.components || [];
            row.tags = row.tags || [];
            row.stockBatches = row.stockBatches || [];
            row.taxIds = row.taxIds || [];
            row.posRepresentationType = row.posRepresentationType || 'color';
            row.posColor = row.posColor || '';
            row.posShape = row.posShape || '';
            row.imageUrl = row.imageUrl || '';
            row.isSellable = row.isSellable !== undefined ? row.isSellable : true;

            const itemRef = doc(collection(firestore, 'items'));
            batch.set(itemRef, row);
        }
        await batch.commit();
    }

    return { created: data.length, categoriesCreated, subcategoriesCreated };
}
