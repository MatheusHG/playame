import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import { AlertTriangle, Key } from 'lucide-react';

interface AffiliateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: AffiliateFormData) => void;
  affiliate?: Affiliate;
  managers?: Affiliate[];
  type?: AffiliateType;
  loading?: boolean;
  companyId?: string;
}

export interface AffiliateFormData {
  name: string;
  phone: string;
  email: string;
  password?: string;
  commission_percent: number;
  parent_affiliate_id?: string;
  type: AffiliateType;
  permission_profile_id?: string;
  create_user_account?: boolean;
}

export function AffiliateForm({
  open,
  onOpenChange,
  onSubmit,
  affiliate,
  managers = [],
  type,
  loading,
  companyId,
}: AffiliateFormProps) {
  const isEdit = !!affiliate;
  const isCambista = type === 'cambista' || affiliate?.type === 'cambista';

  const [formData, setFormData] = useState<AffiliateFormData>({
    name: '',
    phone: '',
    email: '',
    password: '',
    commission_percent: 0,
    parent_affiliate_id: undefined,
    type: type || 'manager',
    permission_profile_id: undefined,
    create_user_account: true,
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setFormData({
        name: affiliate?.name || '',
        phone: affiliate?.phone || '',
        email: affiliate?.email || '',
        password: '',
        commission_percent: affiliate?.commission_percent || 0,
        parent_affiliate_id: affiliate?.parent_affiliate_id || undefined,
        type: type || affiliate?.type || 'manager',
        permission_profile_id: affiliate?.permission_profile_id || undefined,
        create_user_account: !isEdit, // Only for new affiliates
      });
    }
  }, [open, affiliate, type, isEdit]);

  // Fetch permission profiles
  const { data: profiles = [] } = useQuery({
    queryKey: ['permission-profiles', companyId, isCambista ? 'cambista' : 'manager'],
    queryFn: async () => {
      const data = await api.get<any[]>(`/permission-profiles/${companyId}`, {
        affiliate_type: isCambista ? 'cambista' : 'manager',
      });
      return data;
    },
    enabled: !!companyId && open,
  });

  // Auto-select default profile
  useEffect(() => {
    if (profiles.length > 0 && !formData.permission_profile_id) {
      const defaultProfile = profiles.find((p: any) => p.is_default);
      if (defaultProfile) {
        setFormData((prev) => ({ ...prev, permission_profile_id: defaultProfile.id }));
      }
    }
  }, [profiles, formData.permission_profile_id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const needsPassword = !isEdit && formData.create_user_account;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
          <DialogTitle>
              {isEdit ? 'Editar' : 'Novo'} {isCambista ? 'Operador' : 'Gerente'}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? 'Atualize as informações do afiliado.'
                : `Cadastre um novo ${isCambista ? 'operador' : 'gerente'} com acesso ao portal.`}
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

            <div className="grid gap-4 md:grid-cols-2">
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
                <Label htmlFor="commission_percent">Comissão (%) - sobre o valor da cartela</Label>
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
              </div>
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

            {profiles.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="profile">Perfil de Permissões</Label>
                <Select
                  value={formData.permission_profile_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, permission_profile_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o perfil" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((profile: any) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.name} {profile.is_default && '(Padrão)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {!isEdit && (
              <>
                <div className="border-t pt-4 mt-2">
                  <div className="flex items-center gap-2 mb-3">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">Conta de Acesso</span>
                  </div>

                  <div className="flex items-center space-x-2 mb-4">
                    <Checkbox
                      id="create_account"
                      checked={formData.create_user_account}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, create_user_account: checked as boolean })
                      }
                    />
                    <Label htmlFor="create_account" className="text-sm">
                      Criar conta de acesso ao portal
                    </Label>
                  </div>

                  {formData.create_user_account && (
                    <div className="space-y-4 pl-6">
                      <div className="space-y-2">
                        <Label htmlFor="email">E-mail de Login *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          required={formData.create_user_account}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="password">Senha Inicial *</Label>
                        <Input
                          id="password"
                          type="password"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          required={formData.create_user_account}
                          minLength={6}
                          placeholder="Mínimo 6 caracteres"
                        />
                      </div>

                      <div className="p-3 rounded-lg bg-muted border">
                        <div className="flex gap-2 text-sm text-muted-foreground">
                          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                          <span>
                            Anote a senha e repasse ao afiliado. Ela será usada para
                            acessar o portal.
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
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
