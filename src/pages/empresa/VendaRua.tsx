import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { EmpresaLayout } from '@/components/layouts/EmpresaLayout';
import { LoadingState } from '@/components/shared/LoadingState';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Loader2, Shuffle, Check, Plus, X, ShoppingCart, User, Search, Eye, MoreVertical, FileText, DollarSign, Clock, Printer, Bluetooth, BluetoothOff, Unplug, Ticket, TrendingUp, Info } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Raffle } from '@/types/database.types';
import { useDrawnNumbers } from '@/hooks/useRaffles';

/* ── Stat Item ── */
interface StatItemProps { icon: LucideIcon; iconBg: string; iconColor: string; label: string; value: string | number; subtitle?: string; tooltip?: string; }
function StatItemCard({ icon: Icon, iconBg, iconColor, label, value, subtitle, tooltip }: StatItemProps) {
  return (
    <div className="rounded-2xl border bg-card p-3 sm:p-5 flex items-center gap-3 sm:gap-4 hover:shadow-md transition-shadow">
      <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full flex-shrink-0" style={{ backgroundColor: iconBg }}>
        <Icon className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: iconColor }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
          {tooltip && (
            <TooltipProvider delayDuration={200}>
              <UITooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground cursor-help flex-shrink-0" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[220px] text-xs">
                  {tooltip}
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          )}
        </div>
        <p className="text-lg sm:text-2xl font-bold tracking-tight mt-0.5">{value}</p>
        {subtitle && <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
      </div>
    </div>
  );
}
import { StreetSaleReceiptDialog, type ReceiptData } from '@/components/empresa/StreetSaleReceiptDialog';
import { bluetoothPrinter } from '@/lib/bluetooth-printer';

interface TicketSelection {
  id: number;
  numbers: number[];
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export default function VendaRua() {
  const { slug } = useParams<{ slug: string }>();
  const { setCompanySlug, company, loading } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);
  const [detailPaymentId, setDetailPaymentId] = useState<string | null>(null);
  const [confirmationData, setConfirmationData] = useState<ReceiptData | null>(null);

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterRaffleId, setFilterRaffleId] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('');

  // New Sale Form state
  const [selectedRaffleId, setSelectedRaffleId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [tickets, setTickets] = useState<TicketSelection[]>([{ id: 1, numbers: [] }]);
  const [activeTicketId, setActiveTicketId] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingReceiptId, setLoadingReceiptId] = useState<string | null>(null);

  // Bluetooth printer state
  const [printerConnected, setPrinterConnected] = useState(false);
  const [printerName, setPrinterName] = useState<string | null>(null);
  const [isConnectingPrinter, setIsConnectingPrinter] = useState(false);

  useEffect(() => {
    if (slug) setCompanySlug(slug);
  }, [slug, setCompanySlug]);

  // Sync printer connection status
  useEffect(() => {
    const checkPrinter = () => {
      setPrinterConnected(bluetoothPrinter.isConnected);
      setPrinterName(bluetoothPrinter.deviceName);
    };
    checkPrinter();
    const interval = setInterval(checkPrinter, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: raffles = [], isLoading: rafflesLoading } = useQuery({
    queryKey: ['active-raffles', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const data = await api.get<Raffle[]>(`/raffles/company/${company!.id}`);
      return data;
    },
  });

  const activeRaffles = raffles.filter((r) => r.status === 'active');

  // Detail query
  const { data: saleDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['street-sale-detail', detailPaymentId],
    enabled: !!detailPaymentId,
    queryFn: async () => {
      return api.get<any>(`/street-sales/${detailPaymentId}/detail`);
    },
  });

  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ['street-sales', company?.id, debouncedSearch, filterRaffleId, filterDate],
    enabled: !!company?.id,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (filterRaffleId && filterRaffleId !== 'all') params.append('raffleId', filterRaffleId);
      if (filterDate) {
        params.append('startDate', filterDate + 'T00:00:00.000Z');
        params.append('endDate', filterDate + 'T23:59:59.999Z');
      }

      const data = await api.get<any[]>(`/street-sales/company/${company!.id}?${params.toString()}`);
      return data;
    },
  });

  // Derived state for the form
  const selectedRaffle = activeRaffles.find(r => r.id === selectedRaffleId);
  const { data: drawnNumbersSet = new Set<number>() } = useDrawnNumbers(selectedRaffleId || undefined);
  const availableNumbers = useMemo(() => {
    if (!selectedRaffle) return [];
    const nums: number[] = [];
    for (let i = selectedRaffle.number_range_start; i <= selectedRaffle.number_range_end; i++) {
      nums.push(i);
    }
    return nums;
  }, [selectedRaffle]);

  const activeTicket = tickets.find(t => t.id === activeTicketId) || tickets[0];

  const resetForm = () => {
    setCustomerName('');
    setCustomerPhone('');
    setSelectedRaffleId('');
    setTickets([{ id: 1, numbers: [] }]);
    setActiveTicketId(1);
  };

  const handleCloseDialog = (open: boolean) => {
    setIsNewSaleOpen(open);
    if (!open) resetForm();
  };

  // Form actions
  const toggleNumber = (num: number) => {
    if (!selectedRaffle) return;
    if (drawnNumbersSet.has(num)) return; // Block already-drawn numbers
    setTickets(prev =>
      prev.map(ticket => {
        if (ticket.id !== activeTicketId) return ticket;
        if (ticket.numbers.includes(num)) {
          return { ...ticket, numbers: ticket.numbers.filter(n => n !== num) };
        }
        if (ticket.numbers.length < selectedRaffle.numbers_per_ticket) {
          return { ...ticket, numbers: [...ticket.numbers, num] };
        }
        return ticket;
      })
    );
  };

  const generateRandom = () => {
    if (!selectedRaffle) return;
    const pool = availableNumbers.filter(n => !drawnNumbersSet.has(n));
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    setTickets(prev =>
      prev.map(ticket => {
        if (ticket.id !== activeTicketId) return ticket;
        return { ...ticket, numbers: shuffled.slice(0, selectedRaffle.numbers_per_ticket).sort((a, b) => a - b) };
      })
    );
  };

  const addTicket = () => {
    const newId = Math.max(...tickets.map(t => t.id)) + 1;
    setTickets(prev => [...prev, { id: newId, numbers: [] }]);
    setActiveTicketId(newId);
  };

  const removeTicket = (ticketId: number) => {
    if (tickets.length <= 1) return;
    setTickets(prev => prev.filter(t => t.id !== ticketId));
    if (activeTicketId === ticketId) {
      setActiveTicketId(tickets.find(t => t.id !== ticketId)?.id || 1);
    }
  };

  const allComplete = selectedRaffle
    ? tickets.every(t => t.numbers.length === selectedRaffle.numbers_per_ticket)
    : false;

  const canSubmit =
    customerName.trim().length >= 2 &&
    customerPhone.replace(/\D/g, '').length >= 10 &&
    selectedRaffleId &&
    allComplete;

  const totalPrice = selectedRaffle ? Number(selectedRaffle.ticket_price) * tickets.length : 0;

  const handleSubmit = async () => {
    if (!canSubmit || !company) return;
    setIsProcessing(true);
    try {
      const payload = {
        raffleId: selectedRaffleId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.replace(/\D/g, ''),
        quantity: tickets.length,
        ticketNumbers: tickets.map(t => t.numbers.sort((a, b) => a - b)),
      };

      const data = await api.post<{ message?: string; error?: string; paymentId?: string }>(`/street-sales/company/${company.id}`, payload);

      if (data.error) throw new Error(data.error);

      setConfirmationData({
        paymentId: data.paymentId || '',
        customerName: customerName.trim(),
        customerPhone: customerPhone.replace(/\D/g, ''),
        raffleName: selectedRaffle!.name,
        ticketPrice: Number(selectedRaffle!.ticket_price),
        tickets: tickets.map(t => ({ numbers: t.numbers.sort((a, b) => a - b) })),
        totalAmount: totalPrice,
        createdAt: new Date(),
        sellerEmail: user?.email || null,
        raffleId: selectedRaffleId,
        companySlug: slug,
      });

      queryClient.invalidateQueries({ queryKey: ['street-sales', company.id] });
      handleCloseDialog(false);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao registrar venda',
        description: err instanceof Error ? err.message : 'Tente novamente.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRaffleChange = (id: string) => {
    setSelectedRaffleId(id);
    setTickets([{ id: 1, numbers: [] }]);
    setActiveTicketId(1);
  };

  const handleConnectPrinter = async () => {
    setIsConnectingPrinter(true);
    try {
      await bluetoothPrinter.connect();
      setPrinterConnected(true);
      setPrinterName(bluetoothPrinter.deviceName);
      toast({ title: `Impressora conectada: ${bluetoothPrinter.deviceName || 'Bluetooth'}` });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      if (message !== 'Nenhum dispositivo selecionado.') {
        toast({ variant: 'destructive', title: 'Erro ao conectar', description: message });
      }
    } finally {
      setIsConnectingPrinter(false);
    }
  };

  const handleDisconnectPrinter = () => {
    bluetoothPrinter.disconnect();
    setPrinterConnected(false);
    setPrinterName(null);
    toast({ title: 'Impressora desconectada' });
  };

  const handleOpenReceipt = async (saleId: string) => {
    setLoadingReceiptId(saleId);
    try {
      const detail = await api.get<any>(`/street-sales/${saleId}/detail`);
      setConfirmationData({
        paymentId: detail.payment.id,
        customerName: detail.player?.name || 'Cliente',
        customerPhone: detail.player?.phone || '',
        raffleName: detail.raffle?.name || 'Sorteio',
        ticketPrice: Number(detail.raffle?.ticket_price || 0),
        tickets: detail.tickets.map((t: any) => ({ numbers: t.numbers })),
        totalAmount: Number(detail.payment.amount),
        createdAt: new Date(detail.payment.processed_at || detail.payment.created_at),
        sellerEmail: detail.seller_email || null,
        raffleId: detail.raffle?.id,
        companySlug: slug,
      });
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao carregar comprovante' });
    } finally {
      setLoadingReceiptId(null);
    }
  };

  if (loading) {
    return <LoadingState fullScreen message="Carregando..." />;
  }

  return (
    <EmpresaLayout title="Venda de Rua" description="Cartelas para clientes presenciais e PDV">
      <div className="space-y-6">

        {/* Stats */}
        {(() => {
          const totalVendas = sales.length;
          const totalValor = sales.reduce((sum, s) => sum + Number(s.amount || 0), 0);
          const totalCartelas = sales.reduce((sum, s) => sum + (s.ticketCount ?? 1), 0);
          return (
            <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-4 mb-0">
              <StatItemCard
                icon={ShoppingCart}
                iconBg="#DBEAFE"
                iconColor="#2563EB"
                label="Total de Vendas"
                value={totalVendas}
              />
              <StatItemCard
                icon={DollarSign}
                iconBg="#DCFCE7"
                iconColor="#16A34A"
                label="Valor Total"
                value={`R$ ${totalValor.toFixed(2)}`}
              />
              <StatItemCard
                icon={Ticket}
                iconBg="#EDE9FE"
                iconColor="#7C3AED"
                label="Cartelas Vendidas"
                value={totalCartelas}
              />
              <StatItemCard
                icon={TrendingUp}
                iconBg="#FEF3C7"
                iconColor="#D97706"
                label="Ticket Médio"
                value={totalVendas > 0 ? `R$ ${(totalValor / totalVendas).toFixed(2)}` : 'R$ 0,00'}
                tooltip="Calculado com base no valor bruto, sem descontos e taxas."
              />
            </div>
          );
        })()}

        {/* Bluetooth Printer Status */}
        {bluetoothPrinter.isSupported && (
          <div className={cn(
            'flex items-center justify-between rounded-2xl border px-5 py-3',
            printerConnected
              ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30'
              : 'border-muted bg-muted/30'
          )}>
            <div className="flex items-center gap-3">
              {printerConnected ? (
                <>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full flex-shrink-0" style={{ backgroundColor: '#DCFCE7' }}>
                    <Bluetooth className="h-4 w-4" style={{ color: '#16A34A' }} />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-green-700 dark:text-green-300">
                      {printerName || 'Impressora Bluetooth'}
                    </span>
                    <Badge variant="outline" className="ml-2 text-xs border-green-300 text-green-600 dark:border-green-700 dark:text-green-400">
                      Conectada
                    </Badge>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full flex-shrink-0" style={{ backgroundColor: '#F3F4F6' }}>
                    <BluetoothOff className="h-4 w-4" style={{ color: '#6B7280' }} />
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Nenhuma impressora conectada
                  </span>
                </>
              )}
            </div>
            {printerConnected ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive rounded-xl"
                onClick={handleDisconnectPrinter}
              >
                <Unplug className="h-4 w-4 mr-1.5" />
                Desconectar
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleConnectPrinter}
                disabled={isConnectingPrinter}
                className="rounded-xl"
              >
                {isConnectingPrinter ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Bluetooth className="h-4 w-4 mr-1.5" />
                )}
                Conectar Impressora
              </Button>
            )}
          </div>
        )}

        {/* Filters and Actions */}
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto flex-1">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou telefone..."
                  className="pl-9 rounded-xl"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <Select value={filterRaffleId} onValueChange={setFilterRaffleId}>
                <SelectTrigger className="w-full sm:w-[200px] rounded-xl">
                  <SelectValue placeholder="Sorteio (Todos)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Sorteios</SelectItem>
                  {raffles.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="date"
                className="w-full sm:w-[160px] rounded-xl"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
            </div>

            <Dialog open={isNewSaleOpen} onOpenChange={handleCloseDialog}>
              <DialogTrigger asChild>
                <Button className="rounded-xl">
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Venda
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Registrar Venda de Rua</DialogTitle>
                <DialogDescription>
                  Gere cartelas e registre o pagamento manualmente para vendas em dinheiro ou maquininha.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Form fields */}
                <Card>
                  <CardHeader className="py-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="h-4 w-4" /> Dados do Cliente e Sorteio
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="customerName">Nome *</Label>
                        <Input
                          id="customerName"
                          placeholder="Nome completo"
                          value={customerName}
                          onChange={e => setCustomerName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="customerPhone">Telefone *</Label>
                        <Input
                          id="customerPhone"
                          placeholder="(00) 00000-0000"
                          value={customerPhone}
                          onChange={e => setCustomerPhone(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Sorteio *</Label>
                        <Select value={selectedRaffleId} onValueChange={handleRaffleChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {activeRaffles.map(r => (
                              <SelectItem key={r.id} value={r.id}>
                                {r.name} - R${Number(r.ticket_price).toFixed(2)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Number selector */}
                {selectedRaffle && (
                  <Card>
                    <CardHeader className="py-4 pb-0">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">Cartelas ({tickets.length})</CardTitle>
                        <Button size="sm" variant="outline" onClick={addTicket}>
                          <Plus className="h-3 w-3 mr-1" /> Add
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                      {/* Tabs */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        {tickets.map((ticket, idx) => (
                          <div key={ticket.id} className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant={activeTicketId === ticket.id ? 'default' : 'outline'}
                              onClick={() => setActiveTicketId(ticket.id)}
                            >
                              Cartela {idx + 1}
                              {ticket.numbers.length === selectedRaffle.numbers_per_ticket && (
                                <Check className="h-3 w-3 ml-1" />
                              )}
                            </Button>
                            {tickets.length > 1 && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => removeTicket(ticket.id)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Info & Randomize */}
                      <div className="flex items-center justify-between mb-3 bg-muted/30 p-2 rounded">
                        <p className="text-xs text-muted-foreground">
                          Selecionados: {activeTicket.numbers.length}/{selectedRaffle.numbers_per_ticket}
                        </p>
                        <Button size="sm" variant="secondary" onClick={generateRandom}>
                          <Shuffle className="h-3 w-3 mr-1" /> Aleatório
                        </Button>
                      </div>

                      {/* Legend for drawn numbers */}
                      {drawnNumbersSet.size > 0 && (
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-2">
                          <div className="flex items-center gap-1">
                            <span className="h-3 w-3 rounded bg-red-100 dark:bg-red-950/30 border border-red-300 dark:border-red-700" />
                            <span>Já sorteado ({drawnNumbersSet.size})</span>
                          </div>
                        </div>
                      )}

                      {/* Grid */}
                      <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-1.5 sm:gap-2">
                        {availableNumbers.map(num => {
                          const isSelected = activeTicket.numbers.includes(num);
                          const isDrawn = drawnNumbersSet.has(num);
                          return (
                            <button
                              key={num}
                              type="button"
                              onClick={() => toggleNumber(num)}
                              disabled={isDrawn}
                              className={cn(
                                'aspect-square rounded-md text-xs sm:text-sm font-medium transition-all border',
                                isDrawn
                                  ? 'bg-red-100 text-red-400 line-through cursor-not-allowed opacity-50 border-red-200 dark:bg-red-950/30 dark:text-red-500 dark:border-red-800'
                                  : isSelected
                                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                    : 'bg-card hover:bg-accent border-border hover:border-primary/50'
                              )}
                            >
                              {String(num).padStart(2, '0')}
                            </button>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Footer totals */}
                {selectedRaffle && (
                  <div className="flex flex-col sm:flex-row items-center justify-between bg-card border rounded-lg p-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total da venda</p>
                      <p className="text-2xl font-bold text-primary">R$ {totalPrice.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">
                        {tickets.length} cartela(s) aprovadas automaticamente
                      </p>
                    </div>
                    <Button
                      size="lg"
                      className="mt-4 sm:mt-0 w-full sm:w-auto min-w-[200px]"
                      disabled={!canSubmit || isProcessing}
                      onClick={handleSubmit}
                    >
                      {isProcessing ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processando</>
                      ) : (
                        <><ShoppingCart className="mr-2 h-4 w-4" /> Finalizar Venda </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Sales Table */}
        <div className="rounded-2xl border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ref</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Sorteio</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-center">Cartelas</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salesLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mr-2 inline-block" />
                    Carregando vendas...
                  </TableCell>
                </TableRow>
              ) : sales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    Nenhuma venda de rua registrada neste período.
                  </TableCell>
                </TableRow>
              ) : (
                sales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {sale.id.slice(0, 8).toUpperCase()}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {sale.processed_at ? new Date(sale.processed_at).toLocaleString('pt-BR') : '-'}
                    </TableCell>
                    <TableCell>{sale.raffle?.name}</TableCell>
                    <TableCell className="font-medium">{sale.player?.name}</TableCell>
                    <TableCell>{sale.player?.phone}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {(sale.ticket?.snapshot_data as any)?.seller_email || '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{sale.ticketCount ?? 1}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">R$ {Number(sale.amount).toFixed(2)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setDetailPaymentId(sale.id)}>
                            <Eye className="mr-2 h-4 w-4" /> Detalhes da venda
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleOpenReceipt(sale.id)}
                            disabled={loadingReceiptId === sale.id}
                          >
                            {loadingReceiptId === sale.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Printer className="mr-2 h-4 w-4" />
                            )}
                            Comprovante de compra
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* View Details Dialog */}
        <Dialog open={!!detailPaymentId} onOpenChange={(open) => !open && setDetailPaymentId(null)}>
          <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalhes da Venda</DialogTitle>
              <DialogDescription>
                Informações completas da venda, cartelas e transação.
              </DialogDescription>
            </DialogHeader>

            {detailLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !saleDetail ? (
              <p className="text-muted-foreground text-center py-4">Dados não encontrados.</p>
            ) : (
              <div className="space-y-5">
                {/* Informações da Venda */}
                <div>
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <User className="h-4 w-4" /> Informações da Venda
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground block text-xs">Sorteio</span>
                      <span className="font-medium">{saleDetail.raffle?.name}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-xs">Data da Venda</span>
                      <span className="font-medium">
                        {saleDetail.payment.processed_at
                          ? new Date(saleDetail.payment.processed_at).toLocaleString('pt-BR')
                          : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-xs">Cliente</span>
                      <span className="font-medium">{saleDetail.player?.name}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-xs">Telefone</span>
                      <span className="font-medium">{saleDetail.player?.phone || '-'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-xs">Status</span>
                      <Badge variant={saleDetail.payment.status === 'succeeded' ? 'default' : 'secondary'}>
                        {saleDetail.payment.status === 'succeeded' ? 'Aprovado' : saleDetail.payment.status}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-xs">Cartelas</span>
                      <span className="font-medium">{saleDetail.tickets.length}</span>
                    </div>
                    {saleDetail.seller_email && (
                      <div>
                        <span className="text-muted-foreground block text-xs">Vendedor</span>
                        <span className="font-medium">{saleDetail.seller_email}</span>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Cartelas e Números */}
                <div>
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Números Comprados ({saleDetail.tickets.length} cartela{saleDetail.tickets.length !== 1 ? 's' : ''})
                  </h4>
                  <div className="space-y-3">
                    {saleDetail.tickets.map((ticket: any, idx: number) => (
                      <div key={ticket.id} className="border rounded-lg p-3 bg-muted/30">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-muted-foreground">Cartela {idx + 1}</span>
                          <Badge variant={ticket.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                            {ticket.status === 'active' ? 'Ativa' : ticket.status}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {ticket.numbers.map((num: number) => (
                            <span
                              key={num}
                              className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-primary/10 text-primary text-sm font-mono font-medium"
                            >
                              {String(num).padStart(2, '0')}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Detalhamento Financeiro */}
                <div>
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> Detalhamento Financeiro
                  </h4>
                  <div className="space-y-2 text-sm">
                    {saleDetail.payment.original_amount && Number(saleDetail.payment.discount_percent) > 0 ? (
                      <>
                        <div className="flex justify-between">
                          <span>Valor original</span>
                          <span className="font-medium">{formatCurrency(Number(saleDetail.payment.original_amount))}</span>
                        </div>
                        <div className="flex justify-between text-green-600">
                          <span>Desconto ({Number(saleDetail.payment.discount_percent)}%)</span>
                          <span className="font-medium">- {formatCurrency(Number(saleDetail.payment.discount_amount))}</span>
                        </div>
                      </>
                    ) : null}
                    <div className="flex justify-between font-semibold">
                      <span>Valor da venda</span>
                      <span>{formatCurrency(Number(saleDetail.payment.amount))}</span>
                    </div>
                    {saleDetail.commission && (
                      <>
                        <div className="flex justify-between text-destructive">
                          <span>Taxa administrativa ({Number(saleDetail.commission.super_admin_percent)}%)</span>
                          <span className="font-medium">- {formatCurrency(Number(saleDetail.commission.super_admin_amount))}</span>
                        </div>

                        <div className="flex justify-between border-t pt-2">
                          <span>Valor para empresa (após taxa)</span>
                          <span className="font-medium">
                            {formatCurrency(
                              Number(saleDetail.payment.amount) - Number(saleDetail.commission.super_admin_amount)
                            )}
                          </span>
                        </div>

                        {saleDetail.commission.company_retention_amount != null && Number(saleDetail.commission.company_retention_amount) > 0 && (
                          <div className="flex justify-between text-orange-600 dark:text-orange-400">
                            <span>
                              Retenção empresa ({Number(saleDetail.commission.company_profit_percent || 0).toFixed(1)}%)
                            </span>
                            <span className="font-medium">
                              {formatCurrency(Number(saleDetail.commission.company_retention_amount))}
                            </span>
                          </div>
                        )}

                        {saleDetail.commission.prize_pool_contribution != null && Number(saleDetail.commission.prize_pool_contribution) > 0 && (
                          <div className="flex justify-between text-green-600 dark:text-green-400">
                            <span>Contribuição ao prêmio</span>
                            <span className="font-medium">
                              {formatCurrency(Number(saleDetail.commission.prize_pool_contribution))}
                            </span>
                          </div>
                        )}

                        {saleDetail.commission.company_retention_amount != null && Number(saleDetail.commission.company_retention_amount) > 0 ? (
                          <div className="flex justify-between border-t pt-2 font-semibold text-orange-700 dark:text-orange-300">
                            <span>Empresa (retenção)</span>
                            <span>{formatCurrency(Number(saleDetail.commission.company_retention_amount))}</span>
                          </div>
                        ) : (
                          <div className="flex justify-between border-t pt-2 font-semibold">
                            <span>Líquido empresa</span>
                            <span>{formatCurrency(Number(saleDetail.commission.company_net_amount))}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Logs da Transação */}
                <div>
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Logs da Transação
                  </h4>
                  {(saleDetail.financialLogs.length > 0 || saleDetail.auditLogs.length > 0) ? (
                    <div className="space-y-2">
                      {/* Financial Logs */}
                      {saleDetail.financialLogs.map((log: any) => (
                        <div key={log.id} className="flex items-start gap-3 text-sm border-l-2 border-primary/30 pl-3 py-1">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">{log.type}</Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(log.created_at).toLocaleString('pt-BR')}
                              </span>
                            </div>
                            <p className="text-muted-foreground mt-0.5">{log.description}</p>
                          </div>
                          <span className={cn('font-mono font-medium text-sm whitespace-nowrap', Number(log.amount) >= 0 ? 'text-green-600' : 'text-destructive')}>
                            {Number(log.amount) >= 0 ? '+' : ''}{formatCurrency(Number(log.amount))}
                          </span>
                        </div>
                      ))}
                      {/* Audit Logs */}
                      {saleDetail.auditLogs.map((log: any) => (
                        <div key={log.id} className="flex items-start gap-3 text-sm border-l-2 border-muted-foreground/30 pl-3 py-1">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">{log.action}</Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(log.created_at).toLocaleString('pt-BR')}
                              </span>
                            </div>
                            {log.changes_json && (
                              <p className="text-muted-foreground mt-0.5 text-xs">
                                {log.changes_json.ticket_count && `${log.changes_json.ticket_count} cartela(s)`}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">Nenhum log encontrado.</p>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Receipt Confirmation Dialog */}
        <StreetSaleReceiptDialog
          open={!!confirmationData}
          onOpenChange={(open) => { if (!open) setConfirmationData(null); }}
          data={confirmationData}
          company={{
            name: company?.name || '',
            logo_url: company?.logo_url || null,
            primary_color: company?.primary_color || '#3B82F6',
          }}
        />
      </div>
    </EmpresaLayout>
  );
}
