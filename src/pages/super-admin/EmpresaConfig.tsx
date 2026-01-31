import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SuperAdminLayout } from '@/components/layouts/SuperAdminLayout';
import { LoadingState } from '@/components/shared/LoadingState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Company } from '@/types/database.types';

export default function SuperAdminEmpresaConfig() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    logo_url: '',
    primary_color: '#3B82F6',
    secondary_color: '#1E40AF',
    admin_fee_percentage: 10,
    payments_enabled: false,
  });

  const { data: company, isLoading } = useQuery({
    queryKey: ['company', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Company;
    },
  });

  useEffect(() => {
    if (company) {
      setFormData({
        name: company.name,
        slug: company.slug,
        logo_url: company.logo_url || '',
        primary_color: company.primary_color,
        secondary_color: company.secondary_color,
        admin_fee_percentage: company.admin_fee_percentage,
        payments_enabled: company.payments_enabled,
      });
    }
  }, [company]);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Company>) => {
      const { error } = await supabase
        .from('companies')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', id] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast({ title: 'Empresa atualizada com sucesso!' });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar empresa',
        description: error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      ...formData,
      logo_url: formData.logo_url || null,
    });
  };

  if (isLoading) {
    return (
      <SuperAdminLayout title="Configurar Empresa">
        <LoadingState message="Carregando empresa..." className="py-12" />
      </SuperAdminLayout>
    );
  }

  if (!company) {
    return (
      <SuperAdminLayout title="Empresa não encontrada">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">A empresa solicitada não foi encontrada.</p>
          <Button onClick={() => navigate('/super-admin/empresas')}>Voltar</Button>
        </div>
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout
      title={`Configurar: ${company.name}`}
      description="Configure as informações e integrações da empresa"
    >
      <Button
        variant="ghost"
        className="mb-6"
        onClick={() => navigate('/super-admin/empresas')}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar para Empresas
      </Button>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Informações Básicas */}
          <Card>
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
              <CardDescription>Dados principais da empresa</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Empresa</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug (URL)</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  URL: /empresa/{formData.slug}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="logo_url">URL do Logo</Label>
                <Input
                  id="logo_url"
                  value={formData.logo_url}
                  onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                  placeholder="https://exemplo.com/logo.png"
                />
              </div>
            </CardContent>
          </Card>

          {/* Branding */}
          <Card>
            <CardHeader>
              <CardTitle>Branding</CardTitle>
              <CardDescription>Cores e identidade visual</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="primary_color">Cor Primária</Label>
                <div className="flex gap-2">
                  <Input
                    id="primary_color"
                    type="color"
                    value={formData.primary_color}
                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                    className="w-16 h-10 p-1"
                  />
                  <Input
                    value={formData.primary_color}
                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="secondary_color">Cor Secundária</Label>
                <div className="flex gap-2">
                  <Input
                    id="secondary_color"
                    type="color"
                    value={formData.secondary_color}
                    onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                    className="w-16 h-10 p-1"
                  />
                  <Input
                    value={formData.secondary_color}
                    onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                  />
                </div>
              </div>

              {/* Preview */}
              <div className="mt-4 p-4 rounded-lg border">
                <p className="text-sm text-muted-foreground mb-3">Preview:</p>
                <div
                  className="h-12 rounded flex items-center justify-center text-white font-bold"
                  style={{
                    background: `linear-gradient(135deg, ${formData.primary_color}, ${formData.secondary_color})`,
                  }}
                >
                  {formData.name || 'Nome da Empresa'}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Configurações Financeiras */}
          <Card>
            <CardHeader>
              <CardTitle>Configurações Financeiras</CardTitle>
              <CardDescription>Taxa administrativa e pagamentos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin_fee_percentage">Taxa Administrativa (%)</Label>
                <Input
                  id="admin_fee_percentage"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.admin_fee_percentage}
                  onChange={(e) =>
                    setFormData({ ...formData, admin_fee_percentage: parseFloat(e.target.value) || 0 })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Percentual retido de cada venda como taxa administrativa
                </p>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Pagamentos Habilitados</Label>
                  <p className="text-xs text-muted-foreground">
                    Permite que a empresa receba pagamentos
                  </p>
                </div>
                <Switch
                  checked={formData.payments_enabled}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, payments_enabled: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Integração Stripe */}
          <Card>
            <CardHeader>
              <CardTitle>Integração Stripe</CardTitle>
              <CardDescription>Configure as credenciais do Stripe</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                As chaves do Stripe são configuradas de forma segura através de secrets.
                Entre em contato com o suporte para configurar.
              </p>
              {company.stripe_secret_key_encrypted && (
                <p className="text-sm text-primary mt-2">✓ Stripe configurado</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 flex justify-end">
          <Button type="submit" disabled={updateMutation.isPending}>
            <Save className="mr-2 h-4 w-4" />
            {updateMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      </form>
    </SuperAdminLayout>
  );
}
