const fs = require('fs');
let code = fs.readFileSync('src/lib/bluetoothPrinter.ts', 'utf8');

code = code.replace(/async connect\(\) \{/, 'async connect(printerName?: string): Promise<string | null> {');
code = code.replace(
`      this.device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb', 
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
          '49535343-fe7d-4ae5-8fa9-9fafd205e455' // Common serial port UUID
        ]
      });`,
`      const options: any = {
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb', 
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
          '49535343-fe7d-4ae5-8fa9-9fafd205e455'
        ]
      };
      if (printerName) {
        options.filters = [{ name: printerName }];
      } else {
        options.acceptAllDevices = true;
      }
      this.device = await (navigator as any).bluetooth.requestDevice(options);`
);

code = code.replace(
`      if (!this.characteristic) {
        throw new Error('Could not find write characteristic on any service');
      }
    } catch (error: any) {`,
`      if (!this.characteristic) {
        throw new Error('Could not find write characteristic on any service');
      }
      return this.device?.name || 'Unknown Printer';
    } catch (error: any) {`
);

code = code.replace(
`      if (error.message && error.message.includes('disallowed by permissions policy')) {
        throw new Error('Bluetooth is restricted in this preview. Please click "Open in New Tab" at the top right to use the printer.');
      }
      throw error;`,
`      if (error.message && error.message.includes('disallowed by permissions policy')) {
        throw new Error('Bluetooth is restricted in this preview. Please click "Open in New Tab" at the top right to use the printer.');
      }
      if (error.message && error.message.includes('User cancelled the requestDevice() chooser')) {
        return null;
      }
      throw error;`
);

fs.writeFileSync('src/lib/bluetoothPrinter.ts', code);
