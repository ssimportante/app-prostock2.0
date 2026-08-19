const fs = require('fs');
let code = fs.readFileSync('src/components/sales/SalesTerminal.tsx', 'utf8');

code = code.replace(
`  const handlePrintReceipt = async (sale: SaleWithId) => {
    try {
        const printer = new BluetoothThermalPrinter();
        await printer.connect();
        const itemsMap = new Map<string, ItemWithId>(items.map(i => [i.id, i]));
        const receiptBytes = generateReceipt(sale, itemsMap, settings);
        await printer.print(receiptBytes);
        toast({ title: 'Printing...', description: 'Receipt sent to printer.' });
    } catch (error) {
        console.error('Print failed:', error);
        toast({ variant: 'destructive', title: 'Print Error', description: (error as Error).message });
    }
  };`,
`  const handlePrintReceipt = async (sale: SaleWithId) => {
    try {
        const printer = new BluetoothThermalPrinter();
        const savedPrinterName = localStorage.getItem('pos_preferred_printer') || undefined;
        const deviceName = await printer.connect(savedPrinterName);
        if (!deviceName) return; // User cancelled
        const itemsMap = new Map<string, ItemWithId>(items.map(i => [i.id, i]));
        const receiptBytes = generateReceipt(sale, itemsMap, settings);
        await printer.print(receiptBytes);
        toast({ title: 'Printing...', description: 'Receipt sent to printer.' });
    } catch (error) {
        console.error('Print failed:', error);
        toast({ variant: 'destructive', title: 'Print Error', description: (error as Error).message });
    }
  };`
);

fs.writeFileSync('src/components/sales/SalesTerminal.tsx', code);
