import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, ImagePlus, Trash2, Calculator, Info, FileText,
  Hash, Trophy, Award, Tag, ChevronLeft, ChevronRight,
  DollarSign, Calendar, Settings2, BarChart3,
} from 'lucide-react';
import { PrizeTiersEditorControlled, type PrizeTierInput } from '@/components/empresa/PrizeTiersEditor';
import { RafflePromotionsManager } from '@/components/empresa/RafflePromotionsManager';
import type { RaffleStatus, PrizeMode, PrizeTier } from '@/types/database.types';

export type { PrizeTierInput };

const raffleSchema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  description: z.string().optional(),
  regulations: z.string().optional(),
  ticket_price: z.coerce.number().positive('Preço deve ser maior que zero'),
  number_range_start: z.coerce.number().int().min(0, 'Início deve ser >= 0'),
  number_range_end: z.coerce.number().int().min(1, 'Fim deve ser >= 1'),
  numbers_per_ticket: z.coerce.number().int().min(1, 'Mínimo 1 número por cartela'),
  prize_mode: z.enum(['FIXED', 'FIXED_PLUS_PERCENT', 'PERCENT_ONLY'] as const),
  fixed_prize_value: z.coerce.number().min(0),
  prize_percent_of_sales: z.coerce.number().min(0).max(100),
  company_profit_percent: z.coerce.number().min(0).max(100, 'Máximo 100%'),
  status: z.enum(['draft', 'active', 'paused', 'finished'] as const),
  scheduled_at: z.string().optional(),
  image_url: z.string().optional().nullable(),
}).refine(data => data.number_range_end > data.number_range_start, {
  message: 'Fim do range deve ser maior que o início',
  path: ['number_range_end'],
}).refine(data => data.numbers_per_ticket <= (data.number_range_end - data.number_range_start + 1), {
  message: 'Números por cartela não pode exceder o range disponível',
  path: ['numbers_per_ticket'],
});

export type RaffleFormData = z.infer<typeof raffleSchema>;

interface RaffleFormProps {
  companyId: string;
  adminFeePercent?: number;
  defaultValues?: Partial<RaffleFormData>;
  defaultPrizeTiers?: PrizeTier[];
  raffleId?: string;
  currentDrawCount?: number;
  onSubmit: (data: RaffleFormData, tiers: PrizeTierInput[]) => void;
  isLoading?: boolean;
  submitLabel?: string;
}

const formatBrl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

function buildDefaultTiers(maxHits: number): PrizeTierInput[] {
  return [
    { hits_required: maxHits, prize_percentage: 50, prize_type: 'money', purchase_allowed_until_draw_count: null, object_description: null },
    { hits_required: Math.max(1, maxHits - 1), prize_percentage: 30, prize_type: 'money', purchase_allowed_until_draw_count: null, object_description: null },
    { hits_required: Math.max(1, maxHits - 2), prize_percentage: 20, prize_type: 'money', purchase_allowed_until_draw_count: null, object_description: null },
  ];
}

/* ── Section Card ── */
function SectionCard({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <div className="p-5 pb-4 flex items-center gap-4 border-b bg-muted/30">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full flex-shrink-0"
          style={{ backgroundColor: iconBg }}
        >
          <Icon className="h-4.5 w-4.5" style={{ color: iconColor }} />
        </div>
        <div>
          <h3 className="font-semibold text-base">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <div className="p-5 space-y-4">
        {children}
      </div>
    </div>
  );
}

export function RaffleForm({
  companyId,
  adminFeePercent = 10,
  defaultValues,
  defaultPrizeTiers,
  raffleId,
  currentDrawCount = 0,
  onSubmit,
  isLoading,
  submitLabel = 'Salvar',
}: RaffleFormProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [simSaleCount, setSimSaleCount] = useState(100);
  const [activeTab, setActiveTab] = useState('geral');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<RaffleFormData>({
    resolver: zodResolver(raffleSchema),
    defaultValues: {
      name: '',
      description: '',
      regulations: '',
      ticket_price: undefined as unknown as number,
      number_range_start: undefined as unknown as number,
      number_range_end: undefined as unknown as number,
      numbers_per_ticket: undefined as unknown as number,
      prize_mode: undefined as unknown as PrizeMode,
      fixed_prize_value: 0,
      prize_percent_of_sales: 100,
      company_profit_percent: 0,
      status: 'draft',
      image_url: null,
      ...defaultValues,
    },
  });

  // Prize tiers state
  const [prizeTiers, setPrizeTiers] = useState<PrizeTierInput[]>(() => {
    if (defaultPrizeTiers && defaultPrizeTiers.length > 0) {
      return defaultPrizeTiers.map(t => ({
        id: t.id,
        hits_required: t.hits_required,
        prize_percentage: Number(t.prize_percentage),
        prize_type: t.prize_type || 'money',
        purchase_allowed_until_draw_count: t.purchase_allowed_until_draw_count,
        object_description: t.object_description,
      }));
    }
    if (!defaultValues) return [];
    return buildDefaultTiers(defaultValues.numbers_per_ticket ?? 10);
  });

  const nameValue = watch('name');
  const prizeMode = watch('prize_mode');
  const rangeStart = watch('number_range_start') ?? 0;
  const rangeEnd = watch('number_range_end') ?? 0;
  const imageUrl = watch('image_url');
  const numbersRange = rangeEnd - rangeStart + 1;
  const ticketPrice = watch('ticket_price') || 0;
  const companyProfitPercent = watch('company_profit_percent') || 0;
  const fixedPrizeValue = watch('fixed_prize_value') || 0;
  const numbersPerTicket = watch('numbers_per_ticket') || 0;

  // Tab error indicators
  const tiersTotal = prizeTiers.reduce((sum, t) => sum + t.prize_percentage, 0);
  const tabErrors = {
    geral: !!(errors.name),
    numeros: !!(errors.ticket_price || errors.number_range_start || errors.number_range_end || errors.numbers_per_ticket),
    premiacao: !!(errors.prize_mode || errors.fixed_prize_value || errors.company_profit_percent),
    faixas: tiersTotal !== 100,
  };

  // Real-time validity check per tab
  const rawTicketPrice = watch('ticket_price');
  const rawRangeStart = watch('number_range_start');
  const rawRangeEnd = watch('number_range_end');
  const rawNumbersPerTicket = watch('numbers_per_ticket');
  const tabValid: Record<string, boolean> = {
    geral: (nameValue || '').trim().length >= 3,
    numeros:
      rawTicketPrice != null && ticketPrice > 0 &&
      rawRangeStart != null && rawRangeEnd != null &&
      rangeEnd > rangeStart &&
      rawNumbersPerTicket != null && numbersPerTicket >= 1 &&
      numbersPerTicket <= numbersRange,
    premiacao:
      !!prizeMode &&
      (prizeMode === 'PERCENT_ONLY' || fixedPrizeValue >= 0) &&
      companyProfitPercent >= 0 &&
      companyProfitPercent <= 100,
    faixas: tiersTotal === 100,
    promocoes: true,
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const publicUrl = await api.upload(file, companyId, 'raffles');
      setValue('image_url', publicUrl);
      toast({ title: 'Imagem enviada!' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro ao enviar imagem', description: error.message });
    } finally {
      setUploading(false);
    }
  };

  const handleFormSubmit = (data: RaffleFormData) => {
    if (tiersTotal !== 100) {
      toast({
        variant: 'destructive',
        title: 'Faixas de prêmio inválidas',
        description: `O total das faixas deve ser 100% (atual: ${tiersTotal}%)`,
      });
      setActiveTab('faixas');
      return;
    }

    if (data.prize_mode !== 'FIXED') {
      data.prize_percent_of_sales = Math.max(0, 100 - data.company_profit_percent);
    } else {
      data.prize_percent_of_sales = 0;
      data.company_profit_percent = 100;
    }
    onSubmit(data, prizeTiers);
  };

  // Simulation
  const simGross = ticketPrice * simSaleCount;
  const simAdminFee = Math.round(simGross * (adminFeePercent / 100) * 100) / 100;
  const simNetAfterAdmin = Math.round((simGross - simAdminFee) * 100) / 100;
  const simRetention = Math.round(simNetAfterAdmin * (companyProfitPercent / 100) * 100) / 100;
  const simPrizeContribution = Math.round((simNetAfterAdmin - simRetention) * 100) / 100;
  const simTotalPrize =
    prizeMode === 'FIXED'
      ? fixedPrizeValue
      : prizeMode === 'PERCENT_ONLY'
      ? simPrizeContribution
      : fixedPrizeValue + simPrizeContribution;

  // Tab navigation
  const tabOrder = raffleId
    ? ['geral', 'numeros', 'premiacao', 'faixas', 'promocoes']
    : ['geral', 'numeros', 'premiacao', 'faixas'];
  const tabCount = tabOrder.length;
  const currentTabIndex = tabOrder.indexOf(activeTab);
  const isFirstTab = currentTabIndex === 0;
  const isLastTab = currentTabIndex === tabOrder.length - 1;
  const isCreating = !raffleId;
  const nextDisabled = isCreating && !tabValid[activeTab];

  const tabFields: Record<string, (keyof RaffleFormData)[]> = {
    geral: ['name'],
    numeros: ['ticket_price', 'number_range_start', 'number_range_end', 'numbers_per_ticket'],
    premiacao: ['prize_mode', 'fixed_prize_value', 'company_profit_percent'],
    faixas: [],
    promocoes: [],
  };

  const goToTab = (tab: string) => setActiveTab(tab);

  const handleNext = async () => {
    if (isLastTab) return;
    const nextTab = tabOrder[currentTabIndex + 1];

    if (isCreating) {
      const fields = tabFields[activeTab] || [];
      if (fields.length > 0) {
        const valid = await trigger(fields);
        if (!valid) return;
      }
      if (activeTab === 'faixas' && tiersTotal !== 100) {
        toast({
          variant: 'destructive',
          title: 'Faixas de prêmio inválidas',
          description: `O total das faixas deve ser 100% (atual: ${tiersTotal}%)`,
        });
        return;
      }
    }

    goToTab(nextTab);
  };

  const handleBack = () => {
    if (isFirstTab) return;
    goToTab(tabOrder[currentTabIndex - 1]);
  };

  const handleTabChange = async (tab: string) => {
    if (!isCreating) {
      setActiveTab(tab);
      return;
    }

    const targetIndex = tabOrder.indexOf(tab);
    if (targetIndex <= currentTabIndex) {
      setActiveTab(tab);
      return;
    }

    for (let i = currentTabIndex; i < targetIndex; i++) {
      const fields = tabFields[tabOrder[i]] || [];
      if (fields.length > 0) {
        const valid = await trigger(fields);
        if (!valid) {
          setActiveTab(tabOrder[i]);
          return;
        }
      }
      if (tabOrder[i] === 'faixas' && tiersTotal !== 100) {
        toast({
          variant: 'destructive',
          title: 'Faixas de prêmio inválidas',
          description: `O total das faixas deve ser 100% (atual: ${tiersTotal}%)`,
        });
        setActiveTab('faixas');
        return;
      }
    }
    setActiveTab(tab);
  };

  /* ── Step indicator ── */
  const stepLabels = ['Geral', 'Números', 'Premiação', 'Faixas', ...(raffleId ? ['Promoções'] : [])];
  const stepIcons = [FileText, Hash, Trophy, Award, ...(raffleId ? [Tag] : [])];
  const stepColors = [
    { bg: '#DBEAFE', color: '#2563EB' },
    { bg: '#EDE9FE', color: '#7C3AED' },
    { bg: '#FEF3C7', color: '#D97706' },
    { bg: '#DCFCE7', color: '#16A34A' },
    { bg: '#FCE7F3', color: '#DB2777' },
  ];

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Step indicator */}
      <div className="rounded-2xl border bg-card p-4">
        <div className="flex items-center justify-between">
          {tabOrder.map((tab, i) => {
            const StepIcon = stepIcons[i];
            const isActive = i === currentTabIndex;
            const isCompleted = i < currentTabIndex;
            const hasError = tabErrors[tab as keyof typeof tabErrors];
            return (
              <div key={tab} className="flex items-center flex-1">
                <button
                  type="button"
                  onClick={() => handleTabChange(tab)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : isCompleted
                      ? 'text-foreground hover:bg-muted'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0 transition-all"
                    style={{
                      backgroundColor: isActive ? stepColors[i].bg : isCompleted ? '#DCFCE7' : '#F3F4F6',
                      color: isActive ? stepColors[i].color : isCompleted ? '#16A34A' : '#9CA3AF',
                    }}
                  >
                    <StepIcon className="h-3.5 w-3.5" />
                  </div>
                  <span className="hidden md:inline text-sm">{stepLabels[i]}</span>
                  {hasError && !isActive && <span className="h-2 w-2 rounded-full bg-destructive flex-shrink-0" />}
                </button>
                {i < tabOrder.length - 1 && (
                  <div className={`flex-1 h-px mx-2 ${i < currentTabIndex ? 'bg-primary/30' : 'bg-border'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        {/* Hide default tabs — we use our custom step indicator above */}
        <TabsList className="hidden">
          {tabOrder.map(tab => (
            <TabsTrigger key={tab} value={tab}>{tab}</TabsTrigger>
          ))}
        </TabsList>

        {/* ── Tab Geral ──────────────────────────────────────── */}
        <TabsContent value="geral" className="mt-0 space-y-5">
          <SectionCard
            icon={FileText}
            iconBg="#DBEAFE"
            iconColor="#2563EB"
            title="Informações Básicas"
            description="Nome, descrição, regulamento e imagem do sorteio"
          >
            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nome do Sorteio *</Label>
              <Input id="name" {...register('name')} placeholder="Ex: Mega Bolão de Ano Novo" className="rounded-xl" />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Descrição</Label>
              <Textarea id="description" {...register('description')} placeholder="Descreva o sorteio..." rows={3} className="rounded-xl" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="regulations" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Regulamento</Label>
              <Textarea
                id="regulations"
                {...register('regulations')}
                placeholder="Defina as regras e regulamentos específicos deste bolão/sorteio..."
                rows={5}
                className="rounded-xl"
              />
              <p className="text-xs text-muted-foreground">Regras exibidas para os jogadores na página do sorteio</p>
            </div>

            {/* Image Upload */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Imagem do Sorteio (Banner)</Label>
              {imageUrl ? (
                <div className="relative aspect-video max-w-md rounded-2xl overflow-hidden border">
                  <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="absolute top-2 right-2 rounded-xl"
                    onClick={() => setValue('image_url', null)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-32 max-w-md border-2 border-dashed rounded-2xl cursor-pointer hover:bg-muted/50 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={uploading}
                  />
                  {uploading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <div className="flex h-12 w-12 items-center justify-center rounded-full mb-2" style={{ backgroundColor: '#DBEAFE' }}>
                        <ImagePlus className="h-5 w-5" style={{ color: '#2563EB' }} />
                      </div>
                      <span className="text-sm text-muted-foreground">Clique para fazer upload</span>
                    </>
                  )}
                </label>
              )}
              <p className="text-xs text-muted-foreground">A imagem será exibida no card do sorteio na landing page</p>
            </div>
          </SectionCard>

          <SectionCard
            icon={Settings2}
            iconBg="#F3F4F6"
            iconColor="#6B7280"
            title="Status e Agendamento"
            description="Defina o status inicial e agende a ativação"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</Label>
                <Select
                  value={watch('status')}
                  onValueChange={(value: RaffleStatus) => setValue('status', value)}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="paused">Pausado</SelectItem>
                    <SelectItem value="finished">Finalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="scheduled_at" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Data/Hora Programada</Label>
                <Input id="scheduled_at" type="datetime-local" {...register('scheduled_at')} className="rounded-xl" />
              </div>
            </div>
          </SectionCard>

          <TabNavButtons onBack={handleBack} onNext={handleNext} isFirst isLast={false} nextDisabled={nextDisabled} />
        </TabsContent>

        {/* ── Tab Números e Preço ────────────────────────────── */}
        <TabsContent value="numeros" className="mt-0 space-y-5">
          <SectionCard
            icon={DollarSign}
            iconBg="#DCFCE7"
            iconColor="#16A34A"
            title="Preço da Cartela"
            description="Valor que o jogador paga por cada cartela"
          >
            <div className="space-y-2">
              <Label htmlFor="ticket_price" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Preço (R$) *</Label>
              <Input id="ticket_price" type="number" step="0.01" {...register('ticket_price')} className="rounded-xl" />
              {errors.ticket_price && <p className="text-sm text-destructive">{errors.ticket_price.message}</p>}
            </div>
          </SectionCard>

          <SectionCard
            icon={Hash}
            iconBg="#EDE9FE"
            iconColor="#7C3AED"
            title="Range de Números"
            description="Defina o intervalo e quantidade de números por cartela"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="number_range_start" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Início do Range</Label>
                <Input
                  id="number_range_start"
                  type="number"
                  {...register('number_range_start')}
                  disabled={!!raffleId}
                  className={`rounded-xl ${raffleId ? 'bg-muted cursor-not-allowed' : ''}`}
                />
                {errors.number_range_start && <p className="text-sm text-destructive">{errors.number_range_start.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="number_range_end" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fim do Range</Label>
                <Input
                  id="number_range_end"
                  type="number"
                  {...register('number_range_end')}
                  disabled={!!raffleId}
                  className={`rounded-xl ${raffleId ? 'bg-muted cursor-not-allowed' : ''}`}
                />
                {errors.number_range_end && <p className="text-sm text-destructive">{errors.number_range_end.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="numbers_per_ticket" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Números por Cartela</Label>
                <Input
                  id="numbers_per_ticket"
                  type="number"
                  {...register('numbers_per_ticket')}
                  disabled={!!raffleId}
                  className={`rounded-xl ${raffleId ? 'bg-muted cursor-not-allowed' : ''}`}
                />
                {errors.numbers_per_ticket && <p className="text-sm text-destructive">{errors.numbers_per_ticket.message}</p>}
              </div>
            </div>

            <div className="rounded-xl bg-muted/50 p-3 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0" style={{ backgroundColor: '#DBEAFE' }}>
                <Info className="h-3.5 w-3.5" style={{ color: '#2563EB' }} />
              </div>
              <p className="text-sm text-muted-foreground">
                Range disponível: <span className="font-semibold text-foreground">{numbersRange} números</span> ({rangeStart} a {rangeEnd})
              </p>
            </div>

            {raffleId && (
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0" style={{ backgroundColor: '#FEF3C7' }}>
                  <Info className="h-3.5 w-3.5" style={{ color: '#D97706' }} />
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  O range de números e a quantidade por cartela não podem ser alterados após a criação do sorteio, pois cartelas já vendidas seriam prejudicadas.
                </p>
              </div>
            )}
          </SectionCard>

          <TabNavButtons onBack={handleBack} onNext={handleNext} isFirst={false} isLast={false} nextDisabled={nextDisabled} />
        </TabsContent>

        {/* ── Tab Premiação ──────────────────────────────────── */}
        <TabsContent value="premiacao" className="mt-0 space-y-5">
          <SectionCard
            icon={Trophy}
            iconBg="#FEF3C7"
            iconColor="#D97706"
            title="Configuração de Prêmios"
            description="Modo de premiação, retenção da empresa e valores"
          >
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Modo de Premiação</Label>
              <Select
                value={prizeMode || ''}
                onValueChange={(value: PrizeMode) => setValue('prize_mode', value)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione o modo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIXED">Valor Fixo</SelectItem>
                  <SelectItem value="PERCENT_ONLY">Percentual das Vendas</SelectItem>
                  <SelectItem value="FIXED_PLUS_PERCENT">Fixo + Percentual</SelectItem>
                </SelectContent>
              </Select>
              {prizeMode && (
                <div className="rounded-xl bg-muted/50 p-3 flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: '#DBEAFE' }}>
                    <Info className="h-3.5 w-3.5" style={{ color: '#2563EB' }} />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {prizeMode === 'FIXED' && 'O prêmio é um valor fixo, independente de quantas cartelas forem vendidas. A empresa fica com todo o valor líquido das vendas (após taxa administrativa e comissões de afiliados).'}
                    {prizeMode === 'PERCENT_ONLY' && 'O prêmio é formado pelo valor líquido das vendas. Defina abaixo o percentual que a empresa retém — o restante vai para o prêmio.'}
                    {prizeMode === 'FIXED_PLUS_PERCENT' && 'Um prêmio base fixo que cresce à medida que as vendas acontecem. Defina o valor fixo e o percentual de retenção da empresa — o restante das vendas aumenta o prêmio.'}
                  </p>
                </div>
              )}
            </div>

            {/* Conditional fields per mode */}
            {prizeMode === 'FIXED' && (
              <div className="space-y-2">
                <Label htmlFor="fixed_prize_value" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Valor Fixo do Prêmio (R$)</Label>
                <Input id="fixed_prize_value" type="number" step="0.01" {...register('fixed_prize_value')} className="rounded-xl" />
                <p className="text-xs text-muted-foreground">
                  O prêmio será sempre este valor, independentemente do volume de vendas.
                </p>
              </div>
            )}

            {prizeMode === 'PERCENT_ONLY' && (
              <div className="space-y-2">
                <Label htmlFor="company_profit_percent" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Retenção da Empresa (%)</Label>
                <Input
                  id="company_profit_percent"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  {...register('company_profit_percent')}
                  className="rounded-xl"
                />
                {errors.company_profit_percent && <p className="text-sm text-destructive">{errors.company_profit_percent.message}</p>}
                <p className="text-xs text-muted-foreground">
                  Percentual do valor líquido (após taxa admin e comissões) que a empresa retém.{' '}
                  <span className="font-semibold text-primary">
                    {Math.max(0, 100 - companyProfitPercent).toFixed(1)}% vai para o prêmio.
                  </span>
                </p>
              </div>
            )}

            {prizeMode === 'FIXED_PLUS_PERCENT' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fixed_prize_value" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Valor Fixo Base (R$)</Label>
                  <Input id="fixed_prize_value" type="number" step="0.01" {...register('fixed_prize_value')} className="rounded-xl" />
                  <p className="text-xs text-muted-foreground">Prêmio mínimo garantido</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company_profit_percent" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Retenção da Empresa (%)</Label>
                  <Input
                    id="company_profit_percent"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    {...register('company_profit_percent')}
                    className="rounded-xl"
                  />
                  {errors.company_profit_percent && <p className="text-sm text-destructive">{errors.company_profit_percent.message}</p>}
                  <p className="text-xs text-muted-foreground">
                    {Math.max(0, 100 - companyProfitPercent).toFixed(1)}% do líquido cresce o prêmio
                  </p>
                </div>
              </div>
            )}
          </SectionCard>

          {/* Prize Simulation */}
          {prizeMode && ticketPrice > 0 && (
            <SectionCard
              icon={BarChart3}
              iconBg="#FCE7F3"
              iconColor="#DB2777"
              title="Simulação de Premiação"
              description="Veja como funciona a distribuição financeira por venda"
            >
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Vendas simuladas: {simSaleCount} cartelas</Label>
                <input
                  type="range"
                  value={simSaleCount}
                  onChange={(e) => setSimSaleCount(Number(e.target.value))}
                  min={1}
                  max={1000}
                  step={1}
                  className="w-full accent-primary"
                />
              </div>

              <div className="rounded-xl border bg-muted/30 p-4 space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Faturamento bruto ({simSaleCount} x {formatBrl(ticketPrice)})</span>
                  <span className="font-mono font-semibold">{formatBrl(simGross)}</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>(-) Taxa administrativa ({adminFeePercent}%)</span>
                  <span className="font-mono">-{formatBrl(simAdminFee)}</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>(-) Comissões afiliados</span>
                  <span className="font-mono text-xs italic">varia por venda</span>
                </div>
                <div className="flex justify-between items-center border-t pt-3">
                  <span className="font-medium">= Líquido (sem afiliados)</span>
                  <span className="font-mono font-semibold">{formatBrl(simNetAfterAdmin)}</span>
                </div>

                {prizeMode !== 'FIXED' && (
                  <>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#F59E0B' }} />
                        <span className="text-amber-600 dark:text-amber-400">Retenção empresa ({companyProfitPercent}%)</span>
                      </div>
                      <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">{formatBrl(simRetention)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#10B981' }} />
                        <span className="text-green-600 dark:text-green-400">Contribuição ao prêmio ({Math.max(0, 100 - companyProfitPercent).toFixed(1)}%)</span>
                      </div>
                      <span className="font-mono font-semibold text-green-600 dark:text-green-400">{formatBrl(simPrizeContribution)}</span>
                    </div>
                  </>
                )}

                <div className="flex justify-between items-center border-t pt-3 bg-primary/5 -mx-4 px-4 -mb-4 pb-4 rounded-b-xl">
                  <span className="font-semibold text-primary">
                    {prizeMode === 'FIXED'
                      ? 'Prêmio total (fixo)'
                      : prizeMode === 'FIXED_PLUS_PERCENT'
                      ? `Prêmio total (${formatBrl(fixedPrizeValue)} + vendas)`
                      : 'Prêmio total estimado'}
                  </span>
                  <span className="font-mono font-bold text-lg text-primary">{formatBrl(simTotalPrize)}</span>
                </div>

                {prizeMode === 'FIXED' && (
                  <div className="flex justify-between items-center -mt-3 pt-0">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#F59E0B' }} />
                      <span className="text-amber-600 dark:text-amber-400">Retenção empresa (tudo após taxa admin)</span>
                    </div>
                    <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">{formatBrl(simNetAfterAdmin)}</span>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          <TabNavButtons onBack={handleBack} onNext={handleNext} isFirst={false} isLast={false} nextDisabled={nextDisabled} />
        </TabsContent>

        {/* ── Tab Faixas de Prêmio ──────────────────────────── */}
        <TabsContent value="faixas" className="mt-0 space-y-5">
          <div className="rounded-2xl border bg-card overflow-hidden">
            <div className="p-5 pb-4 flex items-center gap-4 border-b bg-muted/30">
              <div className="flex h-10 w-10 items-center justify-center rounded-full flex-shrink-0" style={{ backgroundColor: '#DCFCE7' }}>
                <Award className="h-4.5 w-4.5" style={{ color: '#16A34A' }} />
              </div>
              <div>
                <h3 className="font-semibold text-base">Faixas de Prêmio</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Configure as faixas de acerto e percentual de cada prêmio</p>
              </div>
            </div>
            <div className="p-5">
              <PrizeTiersEditorControlled
                tiers={prizeTiers}
                onChange={setPrizeTiers}
                maxHits={numbersPerTicket}
                currentDrawCount={currentDrawCount}
              />
            </div>
          </div>

          {raffleId ? (
            <TabNavButtons onBack={handleBack} onNext={handleNext} isFirst={false} isLast={false} nextDisabled={nextDisabled} />
          ) : (
            <div className="sticky bottom-0 z-10 bg-background/95 backdrop-blur-sm border-t rounded-t-2xl py-4 -mx-1 px-1 flex justify-between">
              <Button type="button" variant="outline" onClick={handleBack} className="rounded-xl">
                <ChevronLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
              <Button type="submit" disabled={isLoading || tiersTotal !== 100} className="rounded-xl">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {submitLabel}
              </Button>
            </div>
          )}
        </TabsContent>

        {/* ── Tab Promoções (só em modo edição) ──────────────── */}
        {raffleId && (
          <TabsContent value="promocoes" className="mt-0 space-y-5">
            <div className="rounded-2xl border bg-card overflow-hidden">
              <div className="p-5 pb-4 flex items-center gap-4 border-b bg-muted/30">
                <div className="flex h-10 w-10 items-center justify-center rounded-full flex-shrink-0" style={{ backgroundColor: '#FCE7F3' }}>
                  <Tag className="h-4.5 w-4.5" style={{ color: '#DB2777' }} />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Promoções e Descontos</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Configure descontos por quantidade de cartelas</p>
                </div>
              </div>
              <div className="p-5">
                <RafflePromotionsManager raffleId={raffleId} ticketPrice={ticketPrice} />
              </div>
            </div>

            <div className="sticky bottom-0 z-10 bg-background/95 backdrop-blur-sm border-t rounded-t-2xl py-4 -mx-1 px-1 flex justify-between">
              <Button type="button" variant="outline" onClick={handleBack} className="rounded-xl">
                <ChevronLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
              <Button type="submit" disabled={isLoading || tiersTotal !== 100} className="rounded-xl">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {submitLabel}
              </Button>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Hidden field for prize_percent_of_sales (backward compat) */}
      <input type="hidden" {...register('prize_percent_of_sales')} />
    </form>
  );
}

/* ── Tab Navigation Buttons ────────────────────────────────── */

function TabNavButtons({
  onBack,
  onNext,
  isFirst,
  isLast,
  nextDisabled,
}: {
  onBack: () => void;
  onNext: () => void;
  isFirst: boolean;
  isLast: boolean;
  nextDisabled?: boolean;
}) {
  return (
    <div className={`sticky bottom-0 z-10 bg-background/95 backdrop-blur-sm border-t rounded-t-2xl py-4 -mx-1 px-1 flex ${isFirst ? 'justify-end' : 'justify-between'}`}>
      {!isFirst && (
        <Button type="button" variant="outline" onClick={onBack} className="rounded-xl">
          <ChevronLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      )}
      {!isLast && (
        <Button type="button" onClick={onNext} disabled={nextDisabled} className="rounded-xl">
          Avançar
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
