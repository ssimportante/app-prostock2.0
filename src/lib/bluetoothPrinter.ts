export class BluetoothThermalPrinter {
  private device: any = null;
  private server: any = null;
  private characteristic: any = null;

  async connect(printerName?: string): Promise<string | null> {
    if (!navigator.bluetooth) {
      throw new Error('Web Bluetooth API is not supported in this browser.');
    }

    try {
      const options: any = {
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
      this.device = await (navigator as any).bluetooth.requestDevice(options);

      this.server = await this.device.gatt?.connect() || null;
      if (!this.server) throw new Error('Could not connect to GATT server');

      const services = await this.server.getPrimaryServices();
      if (services.length === 0) throw new Error('No services found');

      // Try to find a characteristic that allows writing
      for (const service of services) {
        const characteristics = await service.getCharacteristics();
        this.characteristic = characteristics.find((c: any) => 
          c.properties.write || c.properties.writeWithoutResponse
        ) || null;
        if (this.characteristic) break;
      }

      if (!this.characteristic) {
        throw new Error('Could not find write characteristic on any service');
      }

    } catch (error: any) {
      if (error.message && error.message.includes('disallowed by permissions policy')) {
        throw new Error('Bluetooth is restricted in this preview. Please click "Open in New Tab" at the top right to use the printer.');
      }
      if (error.message && (error.message.includes('User cancelled') || error.message.includes('Connection attempt failed'))) {
        return null;
      }
      console.error('Bluetooth connection failed', error);
      throw error;
    }
  }

  async print(uint8array: Uint8Array) {
    if (!this.characteristic) {
      throw new Error('Printer not connected');
    }
    
    const CHUNK_SIZE = 100;
    for (let i = 0; i < uint8array.length; i += CHUNK_SIZE) {
      const chunk = uint8array.slice(i, i + CHUNK_SIZE);
      if (this.characteristic.properties.writeWithoutResponse) {
         await this.characteristic.writeValueWithoutResponse(chunk);
      } else {
         await this.characteristic.writeValue(chunk);
      }
    }
  }
}
