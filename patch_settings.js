const fs = require('fs');
let code = fs.readFileSync('src/components/settings/SettingsClient.tsx', 'utf8');

if (!code.includes('PrinterSettingsManager')) {
  code = code.replace(
    "import { PosSettingsManager } from '@/components/settings/PosSettingsManager';",
    "import { PosSettingsManager } from '@/components/settings/PosSettingsManager';\nimport { PrinterSettingsManager } from '@/components/settings/PrinterSettingsManager';"
  );

  code = code.replace(
    `<PosSettingsManager />
                        <TaxManager initialTaxes={taxes} />`,
    `<PosSettingsManager />
                        <PrinterSettingsManager />
                        <TaxManager initialTaxes={taxes} />`
  );

  fs.writeFileSync('src/components/settings/SettingsClient.tsx', code);
}
