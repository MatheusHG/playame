import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type RaffleStatus = Database['public']['Enums']['raffle_status'];
type PrizeMode = Database['public']['Enums']['prize_mode'];

const raffleSchema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  description: z.string().optional(),
  ticket_price: z.coerce.number().positive('Preço deve ser maior que zero'),
  number_range_start: z.coerce.number().int().min(0, 'Início deve ser >= 0'),
  number_range_end: z.coerce.number().int().min(1, 'Fim deve ser >= 1'),
  numbers_per_ticket: z.coerce.number().int().min(1, 'Mínimo 1 número por cartela'),
  prize_mode: z.enum(['FIXED', 'FIXED_PLUS_PERCENT', 'PERCENT_ONLY'] as const),
  fixed_prize_value: z.coerce.number().min(0),
  prize_percent_of_sales: z.coerce.number().min(0).max(100),
  status: z.enum(['draft', 'active', 'paused', 'finished'] as const),
  scheduled_at: z.string().optional(),
}).refine(data => data.number_range_end > data.number_range_start, {
  message: 'Fim do range deve ser maior que o início',
  path: ['number_range_end'],
}).refine(data => data.numbers_per_ticket <= (data.number_range_end - data.number_range_start + 1), {
  message: 'Números por cartela não pode exceder o range disponível',
  path: ['numbers_per_ticket'],
});

export type RaffleFormData = z.infer<typeof raffleSchema>;

interface RaffleFormProps {
  defaultValues?: Partial<RaffleFormData>;
  onSubmit: (data: RaffleFormData) => void;
  isLoading?: boolean;
  submitLabel?: string;
}

export function RaffleForm({ defaultValues, onSubmit, isLoading, submitLabel = 'Salvar' }: RaffleFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RaffleFormData>({
    resolver: zodResolver(raffleSchema),
    defaultValues: {
      name: '',
      description: '',
      ticket_price: 10,
      number_range_start: 0,
      number_range_end: 99,
      numbers_per_ticket: 10,
      prize_mode: 'PERCENT_ONLY',
      fixed_prize_value: 0,
      prize_percent_of_sales: 100,
      status: 'draft',
      ...defaultValues,
    },
  });

  const prizeMode = watch('prize_mode');
  const rangeStart = watch('number_range_start');
  const rangeEnd = watch('number_range_end');
  const numbersRange = rangeEnd - rangeStart + 1;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Informações Básicas</CardTitle>
          <CardDescription>Nome, descrição e preço da cartela</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Sorteio *</Label>
            <Input id="name" {...register('name')} placeholder="Ex: Mega Bolão de Ano Novo" />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea id="description" {...register('description')} placeholder="Descreva o sorteio..." rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ticket_price">Preço da Cartela (R$) *</Label>
              <Input id="ticket_price" type="number" step="0.01" {...register('ticket_price')} />
              {errors.ticket_price && <p className="text-sm text-destructive">{errors.ticket_price.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={watch('status')}
                onValueChange={(value: RaffleStatus) => setValue('status', value)}
              >
                <SelectTrigger>
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="scheduled_at">Data/Hora Programada (opcional)</Label>
            <Input id="scheduled_at" type="datetime-local" {...register('scheduled_at')} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configuração de Números</CardTitle>
          <CardDescription>Range e quantidade de números por cartela</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="number_range_start">Início do Range</Label>
              <Input id="number_range_start" type="number" {...register('number_range_start')} />
              {errors.number_range_start && <p className="text-sm text-destructive">{errors.number_range_start.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="number_range_end">Fim do Range</Label>
              <Input id="number_range_end" type="number" {...register('number_range_end')} />
              {errors.number_range_end && <p className="text-sm text-destructive">{errors.number_range_end.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="numbers_per_ticket">Números por Cartela</Label>
              <Input id="numbers_per_ticket" type="number" {...register('numbers_per_ticket')} />
              {errors.numbers_per_ticket && <p className="text-sm text-destructive">{errors.numbers_per_ticket.message}</p>}
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Range disponível: {numbersRange} números ({rangeStart} a {rangeEnd})
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configuração de Prêmios</CardTitle>
          <CardDescription>Modo de premiação e valores</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Modo de Premiação</Label>
            <Select
              value={prizeMode}
              onValueChange={(value: PrizeMode) => setValue('prize_mode', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FIXED">Valor Fixo</SelectItem>
                <SelectItem value="PERCENT_ONLY">Percentual das Vendas</SelectItem>
                <SelectItem value="FIXED_PLUS_PERCENT">Fixo + Percentual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {(prizeMode === 'FIXED' || prizeMode === 'FIXED_PLUS_PERCENT') && (
              <div className="space-y-2">
                <Label htmlFor="fixed_prize_value">Valor Fixo (R$)</Label>
                <Input id="fixed_prize_value" type="number" step="0.01" {...register('fixed_prize_value')} />
              </div>
            )}

            {(prizeMode === 'PERCENT_ONLY' || prizeMode === 'FIXED_PLUS_PERCENT') && (
              <div className="space-y-2">
                <Label htmlFor="prize_percent_of_sales">Percentual das Vendas (%)</Label>
                <Input id="prize_percent_of_sales" type="number" step="0.01" {...register('prize_percent_of_sales')} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
