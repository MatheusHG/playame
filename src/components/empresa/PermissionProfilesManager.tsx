import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
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
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Shield, Users } from 'lucide-react';

interface PermissionProfilesManagerProps {
  companyId: string;
}

// All available permissions
const PERMISSIONS = [
  { key: 'can_view_own_sales', label: 'Ver próprias vendas', description: 'Visualizar histórico de vendas próprias' },
  { key: 'can_view_team_sales', label: 'Ver vendas da equipe', description: 'Visualizar vendas dos cambistas (apenas gerentes)' },
  { key: 'can_view_own_commissions', label: 'Ver próprias comissões', description: 'Visualizar histórico de comissões' },
  { key: 'can_view_team_commissions', label: 'Ver comissões da equipe', description: 'Visualizar comissões dos cambistas' },
  { key: 'can_manage_cambistas', label: 'Gerenciar cambistas', description: 'Adicionar, editar e remover cambistas' },
  { key: 'can_create_sales', label: 'Criar vendas', description: 'Registrar vendas manuais no sistema' },
  { key: 'can_view_reports', label: 'Ver relatórios', description: 'Acessar relatórios de desempenho' },
  { key: 'can_export_data', label: 'Exportar dados', description: 'Baixar relatórios em CSV/Excel' },
  { key: 'can_view_company_revenue', label: 'Ver faturamento empresa', description: 'Visualizar faturamento total da empresa' },
  { key: 'can_edit_commission', label: 'Editar comissões', description: 'Alterar percentuais de comissão' },
];

interface PermissionProfile {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  affiliate_type: 'manager' | 'cambista';
  permissions: Record<string, boolean>;
  is_default: boolean;
  created_at: string;
}

export function PermissionProfilesManager({ companyId }: PermissionProfilesManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<PermissionProfile | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    affiliate_type: 'manager' as 'manager' | 'cambista',
    permissions: {} as Record<string, boolean>,
    is_default: false,
  });

  // Fetch profiles
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['permission-profiles', companyId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('permission_profiles')
        .select('*')
        .eq('company_id', companyId)
        .order('affiliate_type')
        .order('name');

      if (error) throw error;
      return data as PermissionProfile[];
    },
    enabled: !!companyId,
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      if (data.id) {
        // Update
        const { error } = await (supabase as any)
          .from('permission_profiles')
          .update({
            name: data.name,
            description: data.description || null,
            permissions: data.permissions,
            is_default: data.is_default,
          })
          .eq('id', data.id);

        if (error) throw error;
      } else {
        // Create
        const { error } = await (supabase as any)
          .from('permission_profiles')
          .insert({
            company_id: companyId,
            name: data.name,
            description: data.description || null,
            affiliate_type: data.affiliate_type,
            permissions: data.permissions,
            is_default: data.is_default,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permission-profiles', companyId] });
      setDialogOpen(false);
      resetForm();
      toast({
        title: editingProfile ? 'Perfil atualizado' : 'Perfil criado',
        description: 'As alterações foram salvas.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('permission_profiles')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permission-profiles', companyId] });
      toast({
        title: 'Perfil removido',
        description: 'O perfil de permissões foi removido.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      affiliate_type: 'manager',
      permissions: {},
      is_default: false,
    });
    setEditingProfile(null);
  };

  const handleEdit = (profile: PermissionProfile) => {
    setEditingProfile(profile);
    setFormData({
      name: profile.name,
      description: profile.description || '',
      affiliate_type: profile.affiliate_type,
      permissions: profile.permissions,
      is_default: profile.is_default,
    });
    setDialogOpen(true);
  };

  const handleCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe um nome para o perfil.',
        variant: 'destructive',
      });
      return;
    }

    saveMutation.mutate({
      ...formData,
      id: editingProfile?.id,
    });
  };

  const togglePermission = (key: string) => {
    setFormData((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [key]: !prev.permissions[key],
      },
    }));
  };

  const managerProfiles = profiles.filter((p) => p.affiliate_type === 'manager');
  const cambistaProfiles = profiles.filter((p) => p.affiliate_type === 'cambista');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Perfis de Permissão</h2>
          <p className="text-sm text-muted-foreground">
            Configure o que cada tipo de afiliado pode acessar
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Perfil
        </Button>
      </div>

      {/* Manager Profiles */}
      <div>
        <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Perfis de Gerente
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          {managerProfiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              onEdit={() => handleEdit(profile)}
              onDelete={() => deleteMutation.mutate(profile.id)}
            />
          ))}
          {managerProfiles.length === 0 && (
            <p className="text-muted-foreground text-sm col-span-2">
              Nenhum perfil de gerente criado.
            </p>
          )}
        </div>
      </div>

      {/* Cambista Profiles */}
      <div>
        <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
          <Users className="h-5 w-5" />
          Perfis de Cambista
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          {cambistaProfiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              onEdit={() => handleEdit(profile)}
              onDelete={() => deleteMutation.mutate(profile.id)}
            />
          ))}
          {cambistaProfiles.length === 0 && (
            <p className="text-muted-foreground text-sm col-span-2">
              Nenhum perfil de cambista criado.
            </p>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProfile ? 'Editar Perfil' : 'Novo Perfil de Permissão'}
            </DialogTitle>
            <DialogDescription>
              Configure as permissões que este perfil terá acesso.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Perfil</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Gerente Completo"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Tipo de Afiliado</Label>
                <Select
                  value={formData.affiliate_type}
                  onValueChange={(v) => setFormData({ ...formData, affiliate_type: v as any })}
                  disabled={!!editingProfile}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manager">Gerente</SelectItem>
                    <SelectItem value="cambista">Cambista</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição opcional do perfil"
                rows={2}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="is_default"
                checked={formData.is_default}
                onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
              />
              <Label htmlFor="is_default">Perfil padrão para novos afiliados</Label>
            </div>

            <div className="space-y-2">
              <Label>Permissões</Label>
              <div className="grid gap-3">
                {PERMISSIONS.map((perm) => (
                  <div
                    key={perm.key}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div>
                      <p className="font-medium text-sm">{perm.label}</p>
                      <p className="text-xs text-muted-foreground">{perm.description}</p>
                    </div>
                    <Switch
                      checked={formData.permissions[perm.key] || false}
                      onCheckedChange={() => togglePermission(perm.key)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProfileCard({
  profile,
  onEdit,
  onDelete,
}: {
  profile: PermissionProfile;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const enabledPermissions = Object.entries(profile.permissions)
    .filter(([_, v]) => v)
    .map(([k]) => k);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              {profile.name}
              {profile.is_default && (
                <Badge variant="secondary" className="text-xs">
                  Padrão
                </Badge>
              )}
            </CardTitle>
            {profile.description && (
              <CardDescription className="text-xs mt-1">
                {profile.description}
              </CardDescription>
            )}
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1">
          {enabledPermissions.slice(0, 4).map((perm) => (
            <Badge key={perm} variant="outline" className="text-xs">
              {PERMISSIONS.find((p) => p.key === perm)?.label || perm}
            </Badge>
          ))}
          {enabledPermissions.length > 4 && (
            <Badge variant="outline" className="text-xs">
              +{enabledPermissions.length - 4}
            </Badge>
          )}
          {enabledPermissions.length === 0 && (
            <span className="text-xs text-muted-foreground">Nenhuma permissão</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
