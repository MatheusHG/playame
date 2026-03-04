import { useRef, useState } from 'react';
import { toBlob, toPng } from 'html-to-image';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, Share2, Printer, Loader2, Bluetooth } from 'lucide-react';
import { bluetoothPrinter, formatReceiptLines } from '@/lib/bluetooth-printer';

export interface ReceiptData {
  paymentId: string;
  customerName: string;
  customerPhone: string;
  raffleName: string;
  ticketPrice: number;
  tickets: Array<{ numbers: number[] }>;
  totalAmount: number;
  createdAt: Date;
  sellerEmail?: string | null;
  raffleId?: string;
  companySlug?: string;
}

interface StreetSaleReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ReceiptData | null;
  company: {
    name: string;
    logo_url: string | null;
    primary_color: string;
  };
}

const formatPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return phone;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatDate = (date: Date) =>
  date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function StreetSaleReceiptDialog({ open, onOpenChange, data, company }: StreetSaleReceiptDialogProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPrintingBluetooth, setIsPrintingBluetooth] = useState(false);
  const { toast } = useToast();

  if (!data) return null;

  const handleShare = async () => {
    if (!receiptRef.current) return;
    setIsProcessing(true);
    try {
      const blob = await toBlob(receiptRef.current, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });
      if (!blob) throw new Error('Falha ao gerar imagem');

      const file = new File([blob], `comprovante-${data.paymentId.slice(0, 8)}.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `Comprovante - ${company.name}`,
          text: `Comprovante de compra: ${data.raffleName}`,
          files: [file],
        });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `comprovante-${data.paymentId.slice(0, 8)}.png`;
        link.click();
        URL.revokeObjectURL(url);
        toast({ title: 'Comprovante salvo como imagem!' });
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        toast({ variant: 'destructive', title: 'Erro ao compartilhar', description: 'Tente novamente.' });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrint = async () => {
    if (!receiptRef.current) return;
    setIsProcessing(true);
    try {
      const dataUrl = await toPng(receiptRef.current, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.left = '-10000px';
      iframe.style.top = '-10000px';
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) return;

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body { margin: 0; padding: 0; display: flex; justify-content: center; }
            img { width: 80mm; max-width: 100%; height: auto; }
          </style>
        </head>
        <body>
          <img src="${dataUrl}" />
        </body>
        </html>
      `);
      doc.close();

      iframe.onload = () => {
        setTimeout(() => {
          iframe.contentWindow?.print();
          setTimeout(() => document.body.removeChild(iframe), 1000);
        }, 250);
      };
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao imprimir', description: 'Tente novamente.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBluetoothPrint = async () => {
    setIsPrintingBluetooth(true);
    try {
      const lines = formatReceiptLines({
        companyName: company.name,
        raffleName: data.raffleName,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        sellerEmail: data.sellerEmail,
        tickets: data.tickets,
        ticketPrice: data.ticketPrice,
        totalAmount: data.totalAmount,
        paymentRef: data.paymentId,
        createdAt: data.createdAt,
        trackingUrl: trackingUrl || undefined,
      });

      await bluetoothPrinter.printReceipt(lines);
      toast({ title: 'Recibo impresso com sucesso!' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      if (message !== 'Nenhum dispositivo selecionado.') {
        toast({ variant: 'destructive', title: 'Erro na impressão Bluetooth', description: message });
      }
    } finally {
      setIsPrintingBluetooth(false);
    }
  };

  const primaryColor = company.primary_color || '#3B82F6';

  const trackingUrl = data.raffleId && data.paymentId
    ? `${window.location.origin}/sorteio/${data.raffleId}/acompanhar?ref=${data.paymentId}`
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-5 w-5" />
            Venda Registrada!
          </DialogTitle>
          <DialogDescription>
            {data.tickets.length} cartela(s) criada(s) com sucesso.
          </DialogDescription>
        </DialogHeader>

        {/* Receipt - capturable div */}
        <div
          ref={receiptRef}
          style={{
            width: '320px',
            backgroundColor: '#ffffff',
            padding: '24px 16px',
            margin: '0 auto',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            color: '#1a1a1a',
          }}
        >
          {/* Company Header */}
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            {company.logo_url && (
              <img
                src={company.logo_url}
                alt={company.name}
                crossOrigin="anonymous"
                style={{ height: '40px', width: 'auto', margin: '0 auto 8px', display: 'block' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <div style={{ fontSize: '16px', fontWeight: 700, color: primaryColor }}>
              {company.name}
            </div>
          </div>

          {/* Title */}
          <div style={{
            textAlign: 'center',
            padding: '8px 0',
            borderTop: '1px dashed #d1d5db',
            borderBottom: '1px dashed #d1d5db',
            marginBottom: '16px',
          }}>
            <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.5px', color: '#374151' }}>
              COMPROVANTE DE COMPRA
            </div>
          </div>

          {/* Info */}
          <div style={{ fontSize: '12px', lineHeight: '20px', marginBottom: '16px' }}>
            <div><span style={{ color: '#6b7280' }}>Sorteio:</span> <strong>{data.raffleName}</strong></div>
            <div><span style={{ color: '#6b7280' }}>Cliente:</span> <strong>{data.customerName}</strong></div>
            <div><span style={{ color: '#6b7280' }}>Telefone:</span> {formatPhone(data.customerPhone)}</div>
            <div><span style={{ color: '#6b7280' }}>Data:</span> {formatDate(data.createdAt)}</div>
            {data.sellerEmail && (
              <div><span style={{ color: '#6b7280' }}>Vendedor:</span> {data.sellerEmail}</div>
            )}
          </div>

          {/* Tickets */}
          <div style={{ borderTop: '1px dashed #d1d5db', paddingTop: '12px', marginBottom: '16px' }}>
            {data.tickets.map((ticket, idx) => (
              <div key={idx} style={{ marginBottom: idx < data.tickets.length - 1 ? '12px' : '0' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Cartela {idx + 1}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {ticket.numbers.sort((a, b) => a - b).map((num) => (
                    <span
                      key={num}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        backgroundColor: primaryColor + '1A',
                        color: primaryColor,
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        fontSize: '13px',
                      }}
                    >
                      {String(num).padStart(2, '0')}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Total */}
          <div style={{
            borderTop: '1px dashed #d1d5db',
            paddingTop: '12px',
            marginBottom: '12px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>
                {data.tickets.length} cartela(s) x {formatCurrency(data.ticketPrice)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '16px', fontWeight: 700 }}>Total</span>
              <span style={{ fontSize: '16px', fontWeight: 700, color: primaryColor }}>
                {formatCurrency(data.totalAmount)}
              </span>
            </div>
            <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '4px' }}>
              Ref: {data.paymentId.slice(0, 8).toUpperCase()}
            </div>
          </div>

          {/* QR Code */}
          {trackingUrl && (
            <div style={{
              textAlign: 'center',
              borderTop: '1px dashed #d1d5db',
              paddingTop: '12px',
              marginBottom: '12px',
            }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', marginBottom: '8px', textTransform: 'uppercase' }}>
                Acompanhe o sorteio
              </div>
              <QRCodeSVG
                value={trackingUrl}
                size={120}
                level="M"
                style={{ margin: '0 auto' }}
              />
            </div>
          )}

          {/* Footer */}
          <div style={{
            textAlign: 'center',
            borderTop: '1px dashed #d1d5db',
            paddingTop: '12px',
            fontSize: '13px',
            color: '#6b7280',
          }}>
            Boa sorte!
          </div>
        </div>

        <DialogFooter className="grid grid-cols-2 gap-2 pt-2">
          {/* Bluetooth print button - shown only if browser supports it */}
          {bluetoothPrinter.isSupported && (
            <Button
              className="col-span-2"
              onClick={handleBluetoothPrint}
              disabled={isPrintingBluetooth}
            >
              {isPrintingBluetooth ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Bluetooth className="h-4 w-4 mr-2" />
              )}
              {bluetoothPrinter.isConnected
                ? `Imprimir (${bluetoothPrinter.deviceName || 'Bluetooth'})`
                : 'Impressora Bluetooth'
              }
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handlePrint}
            disabled={isProcessing}
          >
            {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Printer className="h-4 w-4 mr-2" />}
            Imprimir
          </Button>
          <Button
            variant="outline"
            onClick={handleShare}
            disabled={isProcessing}
          >
            {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Share2 className="h-4 w-4 mr-2" />}
            Compartilhar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
