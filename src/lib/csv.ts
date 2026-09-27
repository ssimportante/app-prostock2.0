
import { Item } from "@/types";

const CSV_HEADERS: (keyof Item | 'initialQuantity' | 'initialExpiryDate' | 'initialRoastDate' | 'categoryName' | 'subcategoryName')[] = [
    'sku', 'name', 'description', 'categoryId', 'categoryName', 'subcategoryId', 'subcategoryName', 'stationId', 'barcode',
    'isSellable', 'saleType', 'itemType', 'beverageSize', 'soldBy',
    'price', 'cost', 'marketPrice', 'purchaseQuantity',
    'inventoryType', 'trackStock', 'lowStockThreshold', 'initialQuantity', 'initialExpiryDate', 'initialRoastDate',
    'components', 'tags', 'stockBatches', 'posRepresentationType', 'posColor', 'posShape', 'imageUrl'
];

export function exportCsvTemplate() {
  const csvContent = CSV_HEADERS.join(',');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', 'prostock_import_template.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToCsv(data: any[], fileName: string) {
    if (data.length === 0) {
        console.log("No data to export");
        return;
    }

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')]; // Add header row

    for (const row of data) {
        const values = headers.map(header => {
            const value = row[header];
            if (value === null || value === undefined) {
                return '';
            }
            const stringValue = String(value);

            // Quote if it contains comma, double quote or newline
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
        });
        csvRows.push(values.join(','));
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${fileName}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export function importFromCsv(file: File, onComplete: (data: any[]) => void) {
  const reader = new FileReader();
  reader.onload = (event) => {
    const csvData = event.target?.result as string;
    const { data } = parseCsv(csvData);
    onComplete(data);
  };
  reader.readAsText(file);
}

function parseCsv(csv: string) {
    const lines = csv.split(/\r\n|\n/);
    if (lines.length === 0) return { data: [] };
    
    const headers = lines[0].split(',').map(h => h.trim());
    const data: Partial<Item & { initialQuantity: number; initialExpiryDate: string; initialRoastDate: string;}>[] = [];
    
    // Regex to correctly split CSV row, handling quoted fields with commas.
    const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i]) continue;
        
        const values = lines[i].split(regex);
        const obj: any = {};
        
        for (let j = 0; j < headers.length; j++) {
            const header = headers[j];
            if (!header) continue;

            let value: any = values[j] ? values[j].trim() : '';

            // Remove quotes and handle escaped quotes
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.substring(1, value.length - 1).replace(/""/g, '"');
            }

            const numFields = ['price', 'cost', 'lowStockThreshold', 'marketPrice', 'purchaseQuantity', 'initialQuantity'];
            const boolFields = ['isSellable', 'trackStock'];
            const jsonFields = ['components', 'stockBatches', 'tags'];

            if (value === '') {
                 if (numFields.includes(header)) {
                    value = 0;
                 } else if (jsonFields.includes(header)) {
                    value = [];
                 } else {
                    obj[header] = undefined;
                    continue;
                 }
            }
            
            if (numFields.includes(header)) {
                value = parseFloat(value) || 0;
            } else if (boolFields.includes(header)) {
                const lowerValue = value.toLowerCase();
                value = lowerValue === 'true' || lowerValue === 'yes';
            } else if (jsonFields.includes(header)) {
                try {
                    value = JSON.parse(value);
                } catch {
      console.error("An error occurred");
                    value = [];
                }
            }
            obj[header] = value;
        }
        data.push(obj);
    }
    return { data };
}
