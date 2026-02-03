import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Affiliate, AffiliateType } from '@/types/affiliate.types';

interface AffiliateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: AffiliateFormData) => void;
  affiliate?: Affiliate;
  managers?: Affiliate[];
  type?: AffiliateType;
  loading?: boolean;
}

export interface AffiliateFormData {
  name: string;
  phone: string;
  email: string;
  commission_percent: number;
  parent_affiliate_id?: string;
  type: AffiliateType;
}

export function AffiliateForm({
  open,
  onOpenChange,
  onSubmit,
  affiliate,
  managers = [],
  type,
  loading,
}: AffiliateFormProps) {
  const isEdit = !!affiliate;
  const isCambista = type === 'cambista' || affiliate?.type === 'cambista';

  const [formData, setFormData] = useState<AffiliateFormData>({
    name: affiliate?.name || '',
    phone: affiliate?.phone || '',
    email: affiliate?.email || '',
    commission_percent: affiliate?.commission_percent || 0,
    parent_affiliate_id: affiliate?.parent_affiliate_id || undefined,
    type: type || affiliate?.type || 'manager',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEdit ? 'Editar' : 'Novo'} {isCambista ? 'Cambista' : 'Gerente'}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? 'Atualize as informações do afiliado.'
                : `Cadastre um novo ${isCambista ? 'cambista' : 'gerente'}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            {isCambista && !isEdit && managers.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="manager">Gerente *</Label>
                <Select
                  value={formData.parent_affiliate_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, parent_affiliate_id: value })
                  }
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o gerente" />
                  </SelectTrigger>
                  <SelectContent>
                    {managers.map((manager) => (
                      <SelectItem key={manager.id} value={manager.id}>
                        {manager.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="commission_percent">
                Comissão (%) {isCambista && '- sobre o valor do gerente'}
              </Label>
              <Input
                id="commission_percent"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formData.commission_percent}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    commission_percent: parseFloat(e.target.value) || 0,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                {isCambista
                  ? 'Porcentagem do valor que o gerente recebe, que será repassada ao cambista.'
                  : 'Porcentagem sobre o valor total da venda (após taxa do Super-Admin).'}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : isEdit ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
