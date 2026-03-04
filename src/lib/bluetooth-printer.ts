// Bluetooth Thermal Printer Utility (58mm / ESC/POS)
// Uses Web Bluetooth API to connect and send ESC/POS commands
import QRCode from 'qrcode';

// Common Bluetooth printer service UUIDs (Chinese thermal printers)
const PRINTER_SERVICE_UUIDS = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
];

// ESC/POS command bytes
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

const CMD = {
  INIT: new Uint8Array([ESC, 0x40]),
  // Code page WPC1252 for Portuguese characters (ç, ã, é, etc.)
  CODEPAGE_WPC1252: new Uint8Array([ESC, 0x74, 0x10]),
  CENTER: new Uint8Array([ESC, 0x61, 0x01]),
  LEFT: new Uint8Array([ESC, 0x61, 0x00]),
  BOLD_ON: new Uint8Array([ESC, 0x45, 0x01]),
  BOLD_OFF: new Uint8Array([ESC, 0x45, 0x00]),
  NORMAL_SIZE: new Uint8Array([ESC, 0x21, 0x00]),
  DOUBLE_SIZE: new Uint8Array([ESC, 0x21, 0x30]),
  FEED_LINES: (n: number) => new Uint8Array([ESC, 0x64, n]),
  CUT: new Uint8Array([GS, 0x56, 0x42, 0x00]),
};

const LINE_WIDTH = 32; // 58mm ≈ 32 chars per line

// Encode text as ISO-8859-1 (matches WPC1252 for Portuguese chars)
function encodeText(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    bytes[i] = code <= 0xff ? code : 0x3f; // '?' for unsupported
  }
  return bytes;
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

export interface PrintLine {
  text: string;
  bold?: boolean;
  center?: boolean;
  big?: boolean;
  qrCode?: string;
}

class BluetoothPrinter {
  private device: BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private _isConnected = false;

  get isConnected(): boolean {
    return this._isConnected && this.device?.gatt?.connected === true;
  }

  get deviceName(): string | null {
    return this.device?.name || null;
  }

  get isSupported(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.bluetooth;
  }

  async connect(): Promise<void> {
    if (!navigator.bluetooth) {
      throw new Error('Bluetooth não suportado neste navegador. Use o Google Chrome.');
    }

    try {
      this.device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: PRINTER_SERVICE_UUIDS,
      });

      if (!this.device.gatt) {
        throw new Error('GATT não disponível neste dispositivo.');
      }

      const server = await this.device.gatt.connect();

      // Try known service UUIDs first
      let service: BluetoothRemoteGATTService | null = null;
      for (const uuid of PRINTER_SERVICE_UUIDS) {
        try {
          service = await server.getPrimaryService(uuid);
          break;
        } catch {
          continue;
        }
      }

      // Fallback: discover services dynamically
      if (!service) {
        const services = await server.getPrimaryServices();
        if (services.length > 0) {
          service = services[0];
        }
      }

      if (!service) {
        throw new Error('Nenhum serviço de impressão encontrado. Verifique se é uma impressora térmica.');
      }

      // Find writable characteristic
      const chars = await service.getCharacteristics();
      const writableChar = chars.find(
        (c) => c.properties.writeWithoutResponse || c.properties.write,
      );

      if (!writableChar) {
        throw new Error('Característica de escrita não encontrada na impressora.');
      }

      this.characteristic = writableChar;
      this._isConnected = true;

      // Listen for disconnection
      this.device.addEventListener('gattserverdisconnected', () => {
        this._isConnected = false;
        this.characteristic = null;
      });
    } catch (err) {
      this._isConnected = false;
      this.characteristic = null;
      if ((err as Error).name === 'NotFoundError') {
        throw new Error('Nenhum dispositivo selecionado.');
      }
      throw err;
    }
  }

  disconnect(): void {
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this._isConnected = false;
    this.characteristic = null;
  }

  private async writeData(data: Uint8Array): Promise<void> {
    if (!this.characteristic) {
      throw new Error('Impressora não conectada.');
    }

    // Send in chunks to avoid buffer overflow
    const chunkSize = 100;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      if (this.characteristic.properties.writeWithoutResponse) {
        await this.characteristic.writeValueWithoutResponse(chunk);
      } else {
        await this.characteristic.writeValue(chunk);
      }
      // Small delay between chunks
      if (i + chunkSize < data.length) {
        await new Promise((r) => setTimeout(r, 50));
      }
    }
  }

  private async writeQRCode(url: string): Promise<void> {
    // Generate QR code on an off-screen canvas
    const canvas = document.createElement('canvas');
    await QRCode.toCanvas(canvas, url, {
      errorCorrectionLevel: 'M',
      margin: 1,
      scale: 4, // 4 pixels per module
      color: { dark: '#000000', light: '#ffffff' },
    });

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const width = canvas.width;
    const height = canvas.height;
    const widthBytes = Math.ceil(width / 8);

    // Convert to 1-bit-per-pixel bitmap (MSB first)
    const bitmap = new Uint8Array(widthBytes * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const r = imageData.data[(y * width + x) * 4];
        if (r < 128) { // dark pixel = print
          bitmap[y * widthBytes + Math.floor(x / 8)] |= (1 << (7 - (x % 8)));
        }
      }
    }

    // GS v 0 m xL xH yL yH d1...dk (raster bit image)
    const xL = widthBytes & 0xff;
    const xH = (widthBytes >> 8) & 0xff;
    const yL = height & 0xff;
    const yH = (height >> 8) & 0xff;

    // Center alignment
    await this.writeData(CMD.CENTER);
    await new Promise((r) => setTimeout(r, 50));

    // Send raster image command + bitmap data
    const rasterCmd = concatBytes(
      new Uint8Array([GS, 0x76, 0x30, 0x00, xL, xH, yL, yH]),
      bitmap,
    );
    await this.writeData(rasterCmd);
    await new Promise((r) => setTimeout(r, 500));

    // Feed line + reset to left alignment
    await this.writeData(concatBytes(new Uint8Array([LF]), CMD.LEFT));
    await new Promise((r) => setTimeout(r, 50));
  }

  async printReceipt(lines: PrintLine[]): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    // Build ESC/POS data
    let data = concatBytes(CMD.INIT, CMD.CODEPAGE_WPC1252);

    for (const line of lines) {
      // Handle QR code line — send buffered text first, then QR step by step
      if (line.qrCode) {
        // Flush accumulated data before QR
        if (data.length > 0) {
          await this.writeData(data);
          data = new Uint8Array(0);
          await new Promise((r) => setTimeout(r, 100));
        }

        // Print label text if any
        if (line.text) {
          await this.writeData(concatBytes(
            CMD.CENTER,
            CMD.BOLD_ON,
            encodeText(line.text),
            new Uint8Array([LF]),
            CMD.BOLD_OFF,
          ));
          await new Promise((r) => setTimeout(r, 100));
        }

        // Send QR commands step by step with proper delays
        await this.writeQRCode(line.qrCode);
        continue;
      }

      let lineData = new Uint8Array(0);

      // Alignment
      lineData = concatBytes(lineData, line.center ? CMD.CENTER : CMD.LEFT);

      // Size
      if (line.big) {
        lineData = concatBytes(lineData, CMD.DOUBLE_SIZE);
      }

      // Bold
      if (line.bold) {
        lineData = concatBytes(lineData, CMD.BOLD_ON);
      }

      // Text content
      lineData = concatBytes(lineData, encodeText(line.text), new Uint8Array([LF]));

      // Reset formatting
      if (line.bold) {
        lineData = concatBytes(lineData, CMD.BOLD_OFF);
      }
      if (line.big) {
        lineData = concatBytes(lineData, CMD.NORMAL_SIZE);
      }

      data = concatBytes(data, lineData);
    }

    // Feed lines and cut paper
    data = concatBytes(data, CMD.FEED_LINES(4), CMD.CUT);

    await this.writeData(data);
  }
}

// Singleton instance
export const bluetoothPrinter = new BluetoothPrinter();

// --- Receipt formatting helpers ---

export interface ReceiptPrintData {
  companyName: string;
  raffleName: string;
  customerName: string;
  customerPhone?: string;
  sellerEmail?: string | null;
  tickets: Array<{ numbers: number[] }>;
  ticketPrice: number;
  totalAmount: number;
  paymentRef: string;
  createdAt: Date;
  trackingUrl?: string;
}

const SEP_DOUBLE = '='.repeat(LINE_WIDTH);
const SEP_DASH = '-'.repeat(LINE_WIDTH);

function fmtCurrency(v: number): string {
  return `R$ ${v.toFixed(2).replace('.', ',')}`;
}

function fmtPhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone;
}

function fmtDate(date: Date): string {
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatReceiptLines(data: ReceiptPrintData): PrintLine[] {
  const lines: PrintLine[] = [];

  // Header
  lines.push({ text: SEP_DOUBLE, center: true });
  lines.push({ text: data.companyName, center: true, bold: true, big: true });
  lines.push({ text: SEP_DOUBLE, center: true });
  lines.push({ text: '' });
  lines.push({ text: 'COMPROVANTE DE COMPRA', center: true, bold: true });
  lines.push({ text: SEP_DASH, center: true });

  // Info
  lines.push({ text: `Sorteio: ${data.raffleName}`, bold: true });
  lines.push({ text: `Cliente: ${data.customerName}` });
  if (data.customerPhone) {
    lines.push({ text: `Tel: ${fmtPhone(data.customerPhone)}` });
  }
  lines.push({ text: `Data: ${fmtDate(data.createdAt)}` });
  if (data.sellerEmail) {
    lines.push({ text: `Vendedor: ${data.sellerEmail}` });
  }
  lines.push({ text: SEP_DASH, center: true });

  // Tickets
  data.tickets.forEach((ticket, idx) => {
    lines.push({ text: `Cartela ${idx + 1}:`, bold: true });
    const nums = ticket.numbers
      .sort((a, b) => a - b)
      .map((n) => String(n).padStart(2, '0'));

    // Break numbers into lines that fit the width
    let currentLine = '  ';
    for (const num of nums) {
      if ((currentLine + num + ' ').length > LINE_WIDTH) {
        lines.push({ text: currentLine.trimEnd() });
        currentLine = '  ';
      }
      currentLine += num + ' ';
    }
    if (currentLine.trim()) {
      lines.push({ text: currentLine.trimEnd() });
    }
    if (idx < data.tickets.length - 1) {
      lines.push({ text: '' });
    }
  });

  lines.push({ text: SEP_DASH, center: true });

  // Total
  const qty = data.tickets.length;
  lines.push({ text: `${qty} cartela(s) x ${fmtCurrency(data.ticketPrice)}` });
  lines.push({ text: '' });
  lines.push({ text: `TOTAL: ${fmtCurrency(data.totalAmount)}`, bold: true, big: true });
  lines.push({ text: `Ref: ${data.paymentRef.slice(0, 8).toUpperCase()}` });
  lines.push({ text: SEP_DASH, center: true });

  // QR Code
  if (data.trackingUrl) {
    lines.push({ text: '' });
    lines.push({ text: 'ACOMPANHE O SORTEIO', qrCode: data.trackingUrl });
    lines.push({ text: SEP_DASH, center: true });
  }

  // Footer
  lines.push({ text: '' });
  lines.push({ text: 'Boa sorte!', center: true, bold: true });
  lines.push({ text: SEP_DOUBLE, center: true });

  return lines;
}
