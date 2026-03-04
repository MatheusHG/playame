import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AffiliateLayout } from '@/components/layouts/AffiliateLayout';
import { useAffiliate } from '@/contexts/AffiliateContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { LoadingState } from '@/components/shared/LoadingState';
import {
  Ticket,
  User,
  Phone,
  MapPin,
  Shuffle,
  Plus,
  X,
  Check,
  AlertTriangle,
} from 'lucide-react';

export default function NovaVenda() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { affiliate, hasPermission } = useAffiliate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedRaffleId, setSelectedRaffleId] = useState<string>('');
  const [playerData, setPlayerData] = useState({
    cpf: '',
    name: '',
    phone: '',
    city: '',
    password: '',
  });
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [quantity, setQuantity] = useState(1);

  // Fetch active raffles
  const { data: raffles, isLoading: loadingRaffles } = useQuery({
    queryKey: ['affiliate-active-raffles', affiliate?.company_id],
    queryFn: async () => {
      const data = await api.get<any[]>(`/raffles/company/${affiliate?.company_id}`, { status: 'active' });
      return data;
    },
    enabled: !!affiliate?.company_id,
  });

  const selectedRaffle = raffles?.find((r: any) => r.id === selectedRaffleId);

  // Generate random numbers
  const generateRandomNumbers = () => {
    if (!selectedRaffle) return;
    
    const min = selectedRaffle.number_range_start;
    const max = selectedRaffle.number_range_end;
    const count = selectedRaffle.numbers_per_ticket;
    
    const numbers = new Set<number>();
    while (numbers.size < count) {
      const num = Math.floor(Math.random() * (max - min + 1)) + min;
      numbers.add(num);
    }
    
    setSelectedNumbers(Array.from(numbers).sort((a, b) => a - b));
  };

  // Format CPF
  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    return numbers
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2');
  };

  // Format phone
  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    if (numbers.length <= 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
    }
    return numbers.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
  };

  // Create sale mutation
  const createSaleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRaffle || !affiliate) throw new Error('Dados incompletos');

      // Validate CPF
      const cpfNumbers = playerData.cpf.replace(/\D/g, '');
      if (cpfNumbers.length !== 11) throw new Error('CPF inválido');

      // Validate numbers
      if (selectedNumbers.length !== selectedRaffle.numbers_per_ticket) {
        throw new Error(`Selecione exatamente ${selectedRaffle.numbers_per_ticket} números`);
      }

      const data = await api.post<{ id: string }>('/affiliate-sale', {
        companyId: affiliate.company_id,
        affiliateId: affiliate.id,
        raffleId: selectedRaffle.id,
        cpf: cpfNumbers,
        name: playerData.name,
        phone: playerData.phone.replace(/\D/g, '') || null,
        city: playerData.city || null,
        password: playerData.password || undefined,
        numbers: selectedNumbers,
      });

      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Venda registrada!',
        description: 'A cartela foi criada e está aguardando pagamento.',
      });
      queryClient.invalidateQueries({ queryKey: ['affiliate-sales'], exact: false });
      navigate(`/afiliado/${slug}/vendas`);
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao registrar venda',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  if (!hasPermission('can_create_sales')) {
    return (
      <AffiliateLayout title="Nova Venda">
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold">Acesso Negado</h2>
            <p className="text-muted-foreground">Você não tem permissão para criar vendas.</p>
          </div>
        </div>
      </AffiliateLayout>
    );
  }

  if (affiliate?.is_sales_paused) {
    return (
      <AffiliateLayout title="Nova Venda">
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold">Vendas Pausadas</h2>
            <p className="text-muted-foreground">Suas vendas estão temporariamente pausadas.</p>
          </div>
        </div>
      </AffiliateLayout>
    );
  }

  if (loadingRaffles) {
    return (
      <AffiliateLayout title="Nova Venda">
        <LoadingState message="Carregando sorteios..." />
      </AffiliateLayout>
    );
  }

  return (
    <AffiliateLayout title="Nova Venda" description="Registre uma venda para um cliente">
      <div className="max-w-2xl space-y-6">
        {/* Select Raffle */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5" />
              Selecionar Sorteio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedRaffleId} onValueChange={setSelectedRaffleId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha um sorteio ativo" />
              </SelectTrigger>
              <SelectContent>
                {raffles?.map((raffle: any) => (
                  <SelectItem key={raffle.id} value={raffle.id}>
                    <div className="flex items-center gap-2">
                      <span>{raffle.name}</span>
                      <Badge variant="outline">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
                          .format(raffle.ticket_price)}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedRaffle && (
              <div className="mt-4 p-3 rounded-lg bg-muted text-sm">
                <p><strong>Preço:</strong> {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedRaffle.ticket_price)}</p>
                <p><strong>Números por cartela:</strong> {selectedRaffle.numbers_per_ticket}</p>
                <p><strong>Faixa:</strong> {selectedRaffle.number_range_start} a {selectedRaffle.number_range_end}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {selectedRaffle && (
          <>
            {/* Customer Data */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Dados do Cliente
                </CardTitle>
                <CardDescription>
                  Preencha os dados do cliente para criar a cartela
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="cpf">CPF *</Label>
                    <Input
                      id="cpf"
                      placeholder="000.000.000-00"
                      value={playerData.cpf}
                      onChange={(e) => setPlayerData(prev => ({ 
                        ...prev, 
                        cpf: formatCPF(e.target.value) 
                      }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome Completo *</Label>
                    <Input
                      id="name"
                      placeholder="Nome do cliente"
                      value={playerData.name}
                      onChange={(e) => setPlayerData(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        placeholder="(00) 00000-0000"
                        className="pl-10"
                        value={playerData.phone}
                        onChange={(e) => setPlayerData(prev => ({ 
                          ...prev, 
                          phone: formatPhone(e.target.value) 
                        }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">Cidade</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="city"
                        placeholder="Cidade do cliente"
                        className="pl-10"
                        value={playerData.city}
                        onChange={(e) => setPlayerData(prev => ({ ...prev, city: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha do Cliente (opcional)</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Deixe vazio para usar os últimos 4 dígitos do CPF"
                    value={playerData.password}
                    onChange={(e) => setPlayerData(prev => ({ ...prev, password: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    A senha será usada pelo cliente para acessar sua conta online
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Numbers Selection */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Números da Cartela</CardTitle>
                    <CardDescription>
                      Selecione {selectedRaffle.numbers_per_ticket} números ou gere aleatoriamente
                    </CardDescription>
                  </div>
                  <Button variant="outline" onClick={generateRandomNumbers}>
                    <Shuffle className="h-4 w-4 mr-2" />
                    Gerar Aleatório
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Selected Numbers Display */}
                <div className="mb-4">
                  <Label className="mb-2 block">
                    Números selecionados ({selectedNumbers.length}/{selectedRaffle.numbers_per_ticket})
                  </Label>
                  <div className="flex flex-wrap gap-2 min-h-[40px] p-3 rounded-lg border bg-muted/50">
                    {selectedNumbers.length === 0 ? (
                      <span className="text-muted-foreground text-sm">
                        Clique em "Gerar Aleatório" ou selecione os números abaixo
                      </span>
                    ) : (
                      selectedNumbers.map(num => (
                        <Badge 
                          key={num} 
                          variant="default"
                          className="cursor-pointer hover:bg-destructive"
                          onClick={() => setSelectedNumbers(prev => prev.filter(n => n !== num))}
                        >
                          {num.toString().padStart(2, '0')}
                          <X className="h-3 w-3 ml-1" />
                        </Badge>
                      ))
                    )}
                  </div>
                </div>

                {/* Number Grid */}
                <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-1.5 max-h-[300px] overflow-y-auto p-2 rounded-lg border">
                  {Array.from(
                    { length: selectedRaffle.number_range_end - selectedRaffle.number_range_start + 1 },
                    (_, i) => selectedRaffle.number_range_start + i
                  ).map(num => {
                    const isSelected = selectedNumbers.includes(num);
                    const canSelect = selectedNumbers.length < selectedRaffle.numbers_per_ticket;
                    
                    return (
                      <button
                        key={num}
                        type="button"
                        disabled={!isSelected && !canSelect}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedNumbers(prev => prev.filter(n => n !== num));
                          } else if (canSelect) {
                            setSelectedNumbers(prev => [...prev, num].sort((a, b) => a - b));
                          }
                        }}
                        className={`
                          w-8 h-8 text-xs font-medium rounded transition-colors
                          ${isSelected 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed'
                          }
                        `}
                      >
                        {num.toString().padStart(2, '0')}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Submit */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-medium">Total</p>
                    <p className="text-2xl font-bold">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
                        .format(selectedRaffle.ticket_price)}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-lg px-4 py-2">
                    1 Cartela
                  </Badge>
                </div>

                <Button 
                  className="w-full" 
                  size="lg"
                  disabled={
                    !playerData.cpf || 
                    !playerData.name || 
                    selectedNumbers.length !== selectedRaffle.numbers_per_ticket ||
                    createSaleMutation.isPending
                  }
                  onClick={() => createSaleMutation.mutate()}
                >
                  {createSaleMutation.isPending ? (
                    'Registrando...'
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Registrar Venda
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  A cartela será criada com status "Aguardando Pagamento"
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AffiliateLayout>
  );
}
