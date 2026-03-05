import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { SuperAdminLayout } from '@/components/layouts/SuperAdminLayout';
import { LoadingState } from '@/components/shared/LoadingState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, LogIn, Building2, Palette, DollarSign, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { Company } from '@/types/database.types';
import { StripeConfigCard } from '@/components/super-admin/StripeConfigCard';

export default function SuperAdminEmpresaConfig() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    custom_domain: null as string | null,
    logo_url: '',
    favicon_url: '',
    primary_color: '#3B82F6',
    secondary_color: '#1E40AF',
    admin_fee_percentage: 10,
    payments_enabled: false,
    payment_method: 'manual' as 'manual' | 'online',
  });

  const { data: company, isLoading } = useQuery({
    queryKey: ['company', id],
    queryFn: async () => {
      const data = await api.get<Company>(`/companies/${id}`);
      return data;
    },
  });

  useEffect(() => {
    if (company) {
      setFormData({
        name: company.name,
        slug: company.slug,
        custom_domain: company.custom_domain || null,
        logo_url: company.logo_url || '',
        favicon_url: company.favicon_url || '',
        primary_color: company.primary_color,
        secondary_color: company.secondary_color,
        admin_fee_percentage: company.admin_fee_percentage,
        payments_enabled: company.payments_enabled,
        payment_method: (company as any).payment_method || 'manual',
      });
    }
  }, [company]);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Company>) => {
      await api.patch(`/companies/${id}`, data);
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

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    updateMutation.mutate({
      ...formData,
      logo_url: formData.logo_url || null,
      favicon_url: formData.favicon_url || null,
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
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/super-admin/empresas')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (company?.custom_domain) {
              window.open(`https://${company.custom_domain}/admin/dashboard`, '_blank');
            } else {
              navigate('/admin/dashboard');
            }
          }}
        >
          <LogIn className="mr-2 h-4 w-4" />
          Acessar empresa
        </Button>
      </div>

      <Tabs defaultValue="geral" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="geral" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            <span className="hidden sm:inline">Dados Gerais</span>
            <span className="sm:hidden">Geral</span>
          </TabsTrigger>
          <TabsTrigger value="branding" className="flex items-center gap-2">
            <Palette className="w-4 h-4" />
            <span>Branding</span>
          </TabsTrigger>
          <TabsTrigger value="financeiro" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            <span>Financeiro</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab: Dados Gerais */}
        <TabsContent value="geral" className="pt-4">
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
                  Slug: {formData.slug}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="custom_domain">Domínio Próprio</Label>
                <Input
                  id="custom_domain"
                  value={formData.custom_domain || ''}
                  onChange={(e) => setFormData({ ...formData, custom_domain: e.target.value || null })}
                  placeholder="www.empresa.com"
                />
                <div className="mt-2 p-3 bg-muted/50 rounded-md border border-dashed">
                  <p className="text-xs font-medium mb-1.5">Como configurar o domínio:</p>
                  <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Acesse o painel do seu provedor de domínio (Registro.br, GoDaddy, Hostinger, Cloudflare, etc.)</li>
                    <li>Vá em <strong>Zona DNS</strong> ou <strong>Gerenciar DNS</strong></li>
                    <li>Crie um registro do tipo <strong>CNAME</strong>:</li>
                  </ol>
                  <div className="mt-1.5 mb-1.5 bg-background rounded p-2 font-mono text-xs border">
                    <div><span className="text-muted-foreground">Nome/Host:</span> <strong>www</strong></div>
                    <div><span className="text-muted-foreground">Tipo:</span> <strong>CNAME</strong></div>
                    <div><span className="text-muted-foreground">Destino/Valor:</span> <strong>{window.location.hostname}</strong></div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    No <strong>Registro.br</strong>: acesse o domínio {'>'} DNS {'>'} Adicionar registro {'>'} CNAME. A propagação pode levar até 24h.
                  </p>
                </div>
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
              <div className="space-y-2">
                <Label htmlFor="favicon_url">URL do Favicon</Label>
                <Input
                  id="favicon_url"
                  value={formData.favicon_url}
                  onChange={(e) => setFormData({ ...formData, favicon_url: e.target.value })}
                  placeholder="https://exemplo.com/favicon.ico"
                />
                <p className="text-xs text-muted-foreground">
                  Ícone exibido na aba do navegador. Se não informado, usa o logo.
                </p>
              </div>
            </CardContent>
          </Card>
          <div className="mt-6 flex justify-end">
            <Button onClick={() => handleSubmit()} disabled={updateMutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {updateMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </TabsContent>

        {/* Tab: Branding */}
        <TabsContent value="branding" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Identidade Visual</CardTitle>
              <CardDescription>Cores e identidade visual da empresa</CardDescription>
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
          <div className="mt-6 flex justify-end">
            <Button onClick={() => handleSubmit()} disabled={updateMutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {updateMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </TabsContent>

        {/* Tab: Financeiro */}
        <TabsContent value="financeiro" className="space-y-6 pt-4">
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

              {/* Meio de Pagamento */}
              <div className="space-y-2 pt-2 border-t">
                <Label>Meio de Pagamento</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
                      formData.payment_method === 'manual'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground/50'
                    )}
                    onClick={() => setFormData({ ...formData, payment_method: 'manual' })}
                  >
                    <span className="text-2xl">🧾</span>
                    <span className="font-medium text-sm">Manual</span>
                    <span className="text-xs text-muted-foreground text-center">
                      Admin da empresa aprova
                    </span>
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
                      formData.payment_method === 'online'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground/50'
                    )}
                    onClick={() => setFormData({ ...formData, payment_method: 'online' })}
                  >
                    <span className="text-2xl">💳</span>
                    <span className="font-medium text-sm">Online (Stripe)</span>
                    <span className="text-xs text-muted-foreground text-center">
                      Pagamento via Stripe
                    </span>
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Integração Stripe */}
          {formData.payment_method === 'online' && (
            <StripeConfigCard
              companyId={company.id}
              hasStripeConfigured={!!company.stripe_secret_key_encrypted}
            />
          )}

          <div className="flex justify-end">
            <Button onClick={() => handleSubmit()} disabled={updateMutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {updateMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </SuperAdminLayout>
  );
}
