import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { EmpresaLayout } from '@/components/layouts/EmpresaLayout';
import { LoadingState } from '@/components/shared/LoadingState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Loader2, Shuffle, Check, Plus, Minus, X, ShoppingCart, User, Phone } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Raffle = Database['public']['Tables']['raffles']['Row'];

interface TicketSelection {
  id: number;
  numbers: number[];
}

export default function VendaRua() {
  const { slug } = useParams<{ slug: string }>();
  const { setCompanySlug, company, loading } = useTenant();
  const { toast } = useToast();

  const [selectedRaffleId, setSelectedRaffleId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [tickets, setTickets] = useState<TicketSelection[]>([{ id: 1, numbers: [] }]);
  const [activeTicketId, setActiveTicketId] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (slug) setCompanySlug(slug);
  }, [slug, setCompanySlug]);

  // Fetch active raffles
  const { data: raffles = [], isLoading: rafflesLoading } = useQuery({
    queryKey: ['active-raffles', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('raffles')
        .select('*')
        .eq('company_id', company!.id)
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('name');
      if (error) throw error;
      return data as Raffle[];
    },
  });

  const selectedRaffle = raffles.find(r => r.id === selectedRaffleId);

  const availableNumbers = useMemo(() => {
    if (!selectedRaffle) return [];
    const nums: number[] = [];
    for (let i = selectedRaffle.number_range_start; i <= selectedRaffle.number_range_end; i++) {
      nums.push(i);
    }
    return nums;
  }, [selectedRaffle]);

  const activeTicket = tickets.find(t => t.id === activeTicketId) || tickets[0];

  const toggleNumber = (num: number) => {
    if (!selectedRaffle) return;
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
    const shuffled = [...availableNumbers].sort(() => Math.random() - 0.5);
    setTickets(prev =>
      prev.map(ticket => {
        if (ticket.id !== activeTicketId) return ticket;
        return { ...ticket, numbers: shuffled.slice(0, selectedRaffle.numbers_per_ticket) };
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
      const { data, error } = await supabase.functions.invoke('create-street-sale', {
        body: {
          companyId: company.id,
          raffleId: selectedRaffleId,
          customerName: customerName.trim(),
          customerPhone: customerPhone.replace(/\D/g, ''),
          quantity: tickets.length,
          ticketNumbers: tickets.map(t => t.numbers.sort((a, b) => a - b)),
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast({
        title: 'Venda registrada!',
        description: data.message || `${tickets.length} cartela(s) criada(s) com sucesso.`,
      });

      // Reset form
      setCustomerName('');
      setCustomerPhone('');
      setTickets([{ id: 1, numbers: [] }]);
      setActiveTicketId(1);
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

  if (loading) {
    return <LoadingState fullScreen message="Carregando..." />;
  }

  return (
    <EmpresaLayout title="Venda de Rua" description="Gerar cartelas para clientes presenciais">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Customer Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Dados do Cliente
            </CardTitle>
            <CardDescription>Informe os dados do cliente de rua</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="customerName">Nome do Cliente *</Label>
                <Input
                  id="customerName"
                  placeholder="Nome completo"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerPhone">Telefone *</Label>
                <Input
                  id="customerPhone"
                  placeholder="(00) 00000-0000"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  maxLength={20}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Raffle Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Sorteio</CardTitle>
            <CardDescription>Selecione o sorteio ativo</CardDescription>
          </CardHeader>
          <CardContent>
            {rafflesLoading ? (
              <LoadingState message="Carregando sorteios..." className="py-4" />
            ) : raffles.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum sorteio ativo encontrado.</p>
            ) : (
              <Select value={selectedRaffleId} onValueChange={handleRaffleChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um sorteio" />
                </SelectTrigger>
                <SelectContent>
                  {raffles.map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name} — R$ {Number(r.ticket_price).toFixed(2)}/cartela
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>

        {/* Number Selection */}
        {selectedRaffle && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle>Cartelas ({tickets.length})</CardTitle>
                  <Button size="sm" variant="outline" onClick={addTicket}>
                    <Plus className="h-4 w-4 mr-1" /> Adicionar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Ticket tabs */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {tickets.map((ticket, idx) => (
                    <div key={ticket.id} className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant={activeTicketId === ticket.id ? 'default' : 'outline'}
                        onClick={() => setActiveTicketId(ticket.id)}
                        className="relative"
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

                {/* Selection info */}
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-muted-foreground">
                    Selecionados: {activeTicket.numbers.length}/{selectedRaffle.numbers_per_ticket}
                  </p>
                  <Button size="sm" variant="outline" onClick={generateRandom}>
                    <Shuffle className="h-4 w-4 mr-1" /> Aleatório
                  </Button>
                </div>

                {/* Number grid */}
                <div className="grid grid-cols-10 gap-1 sm:gap-2">
                  {availableNumbers.map(num => {
                    const isSelected = activeTicket.numbers.includes(num);
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => toggleNumber(num)}
                        className={cn(
                          'aspect-square rounded-lg text-sm font-medium transition-all border',
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                            : 'bg-card hover:bg-accent border-border'
                        )}
                      >
                        {String(num).padStart(2, '0')}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Summary */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-2xl font-bold">R$ {totalPrice.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">
                      {tickets.length} cartela(s) × R$ {Number(selectedRaffle.ticket_price).toFixed(2)}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-sm">
                    Aprovação automática
                  </Badge>
                </div>
                <Button
                  className="w-full"
                  size="lg"
                  disabled={!canSubmit || isProcessing}
                  onClick={handleSubmit}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Registrar Venda de Rua
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </EmpresaLayout>
  );
}
