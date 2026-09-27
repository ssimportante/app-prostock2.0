import { SaleWithId, ItemWithId } from '@/types';
import { formatCurrency } from './utils';

// ESC/POS commands
const ESC = 0x1b;
const GS = 0x1d;

const CMD = {
  INIT: [ESC, 0x40],
  ALIGN_LEFT: [ESC, 0x61, 0x00],
  ALIGN_CENTER: [ESC, 0x61, 0x01],
  ALIGN_RIGHT: [ESC, 0x61, 0x02],
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  TEXT_NORMAL: [ESC, 0x21, 0x00],
  TEXT_DOUBLE_HEIGHT: [ESC, 0x21, 0x10],
  TEXT_DOUBLE_WIDTH: [ESC, 0x21, 0x20],
  TEXT_DOUBLE: [ESC, 0x21, 0x30],
  PAPER_CUT: [GS, 0x56, 0x41, 0x00],
  NEWLINE: [0x0a],
};

// 57mm paper usually fits 32 characters on standard font A
const MAX_CHARS_PER_LINE = 32;

function encodeText(text: string): number[] {
  // Simple ASCII encoding for basic text
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    // Replace non-ascii with '?'
    bytes.push(charCode > 255 ? 63 : charCode);
  }
  return bytes;
}

function padText(left: string, right: string, totalLength: number = MAX_CHARS_PER_LINE): string {
  const spaceCount = totalLength - left.length - right.length;
  if (spaceCount <= 0) {
    return left + ' ' + right;
  }
  return left + ' '.repeat(spaceCount) + right;
}

function divider(): string {
  return '-'.repeat(MAX_CHARS_PER_LINE);
}

export function generateReceipt(sale: SaleWithId, itemsMap: Map<string, ItemWithId>, settings: any): Uint8Array {
  const bytes: number[] = [];

  const addBytes = (b: number[]) => bytes.push(...b);
  const addLine = (text: string) => {
    addBytes(encodeText(text));
    addBytes(CMD.NEWLINE);
  };

  // Initialize
  addBytes(CMD.INIT);

  // Header
  addBytes(CMD.ALIGN_CENTER);
  addBytes(CMD.TEXT_DOUBLE);
  addLine(settings.businessName || "My Store");
  addBytes(CMD.TEXT_NORMAL);
  
  addBytes(CMD.NEWLINE);
  addLine(`Ticket: ${sale.ticketNumber}`);
  addLine(`Date: ${new Date(sale.date instanceof Date ? sale.date : (sale.date as any).seconds ? new Date((sale.date as any).seconds * 1000) : sale.date).toLocaleString()}`);
  addBytes(CMD.NEWLINE);

  // Items
  addBytes(CMD.ALIGN_LEFT);
  addLine(divider());
  
  sale.items.forEach(si => {
    const itemName = itemsMap.get(si.itemId)?.name || 'Unknown Item';
    const itemGross = si.price * si.quantity;
    
    // Line 1: Qty x Item Name
    addLine(`${si.quantity}x ${itemName}`);
    
    // Line 2: Price padding right
    addLine(padText('', formatCurrency(itemGross, settings.currency)));

    if (si.discount && si.discount.amount > 0) {
      addLine(padText('  Discount', `-${formatCurrency(si.discount.amount, settings.currency)}`));
    }
  });

  addLine(divider());

  // Totals
  addBytes(CMD.ALIGN_RIGHT);
  addLine(padText('Subtotal:', formatCurrency(sale.subtotal ?? 0, settings.currency)));
  
  if (sale.discount && sale.discount.amount > 0) {
    addLine(padText('Discount:', `-${formatCurrency(sale.discount.amount, settings.currency)}`));
  }

  if (sale.deliveryFee) {
    addLine(padText('Delivery:', formatCurrency(sale.deliveryFee, settings.currency)));
  }

  addBytes(CMD.BOLD_ON);
  addBytes(CMD.TEXT_DOUBLE_HEIGHT);
  addLine(padText('TOTAL:', formatCurrency(sale.total, settings.currency)));
  addBytes(CMD.TEXT_NORMAL);
  addBytes(CMD.BOLD_OFF);
  
  addBytes(CMD.NEWLINE);
  addBytes(CMD.ALIGN_CENTER);
  addLine("Thank you for your purchase!");
  addBytes(CMD.NEWLINE);
  addBytes(CMD.NEWLINE);
  addBytes(CMD.NEWLINE);
  addBytes(CMD.NEWLINE);

  // Cut paper
  addBytes(CMD.PAPER_CUT);

  return new Uint8Array(bytes);
}
