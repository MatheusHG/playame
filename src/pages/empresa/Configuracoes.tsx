import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useTenant } from '@/contexts/TenantContext';
import { EmpresaLayout } from '@/components/layouts/EmpresaLayout';
import { LoadingState } from '@/components/shared/LoadingState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Save, Loader2, Trash2, Palette, Link as LinkIcon, Image as ImageIcon, MessageCircle, Info, Phone } from 'lucide-react';
import { BannerManager } from '@/components/empresa/BannerManager';
import { FooterSettingsManager } from '@/components/empresa/FooterSettingsManager';
import type { LucideIcon } from 'lucide-react';

/* ── Section Card ── */
interface SectionCardProps {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}
function SectionCard({ icon: Icon, iconBg, iconColor, title, description, children }: SectionCardProps) {
  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <div className="p-5 border-b bg-muted/30 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full flex-shrink-0" style={{ backgroundColor: iconBg }}>
          <Icon className="h-4 w-4" style={{ color: iconColor }} />
        </div>
        <div>
          <h3 className="font-semibold">{title}</h3>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function EmpresaConfiguracoes() {
  const { company, loading, refetchCompany } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    logo_url: '',
    primary_color: '#3B82F6',
    secondary_color: '#1E40AF',
    footer_social_links: [],
    footer_menus: [],
    community_name: '',
    community_url: '',
    about_us: '',
    contact_info: { whatsapp: '', phone: '', email: '', address: '', instagram: '', facebook: '' },
  });
  // const [uploading, setUploading] = useState(false); // TODO: descomentar quando S3 estiver configurado

  useEffect(() => {
    if (company) {
      setFormData({
        logo_url: company.logo_url || '',
        primary_color: company.primary_color,
        secondary_color: company.secondary_color,
        footer_social_links: company.footer_social_links || [],
        footer_menus: company.footer_menus || [],
        community_name: company.community_name || '',
        community_url: company.community_url || '',
        about_us: (company as any).about_us || '',
        contact_info: {
          whatsapp: (company as any).contact_info?.whatsapp || '',
          phone: (company as any).contact_info?.phone || '',
          email: (company as any).contact_info?.email || '',
          address: (company as any).contact_info?.address || '',
          instagram: (company as any).contact_info?.instagram || '',
          facebook: (company as any).contact_info?.facebook || '',
        },
      });
    }
  }, [company]);

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      await api.patch(`/companies/${company!.id}`, {
        ...data,
        logo_url: data.logo_url || null,
      });
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['company'] });
      await refetchCompany();
      toast({ title: 'Configurações salvas com sucesso!' });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar configurações',
        description: error.message,
      });
    },
  });

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    updateMutation.mutate(formData);
  };

  // TODO: descomentar quando S3 estiver configurado
  // const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const file = e.target.files?.[0];
  //   if (!file || !company) return;
  //   setUploading(true);
  //   try {
  //     const { url } = await api.upload(file, company.id, 'logo');
  //     setFormData(prev => ({ ...prev, logo_url: url }));
  //     toast({ title: 'Logo enviado!' });
  //   } catch (error: any) {
  //     toast({ variant: 'destructive', title: 'Erro ao enviar logo', description: error.message });
  //   } finally {
  //     setUploading(false);
  //   }
  // };

  if (loading) {
    return <LoadingState fullScreen message="Carregando empresa..." />;
  }

  const SaveButton = () => (
    <div className="flex justify-end mt-6">
      <Button className="rounded-xl" onClick={() => handleSubmit()} disabled={updateMutation.isPending}>
        <Save className="mr-2 h-4 w-4" />
        {updateMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
      </Button>
    </div>
  );

  return (
    <EmpresaLayout title="Personalização" description="Configure a identidade visual e o layout da sua página">
      <div className="rounded-2xl border bg-card overflow-hidden">
        <Tabs defaultValue="identidade">
          <div className="bg-muted/30 px-4 pt-3 overflow-x-auto">
            <TabsList className="bg-transparent h-auto p-0 gap-1">
              <TabsTrigger
                value="identidade"
                className="rounded-t-xl rounded-b-none gap-2 px-4 py-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm flex-shrink-0"
              >
                <Palette className="w-4 h-4" />
                <span className="hidden sm:inline">Identidade Visual</span>
                <span className="sm:hidden">Visual</span>
              </TabsTrigger>
              <TabsTrigger
                value="rodape"
                className="rounded-t-xl rounded-b-none gap-2 px-4 py-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm flex-shrink-0"
              >
                <LinkIcon className="w-4 h-4" />
                Rodapé
              </TabsTrigger>
              <TabsTrigger
                value="banners"
                className="rounded-t-xl rounded-b-none gap-2 px-4 py-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm flex-shrink-0"
              >
                <ImageIcon className="w-4 h-4" />
                Banners
              </TabsTrigger>
              <TabsTrigger
                value="comunidade"
                className="rounded-t-xl rounded-b-none gap-2 px-4 py-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm flex-shrink-0"
              >
                <MessageCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Comunidade</span>
                <span className="sm:hidden">Canal</span>
              </TabsTrigger>
              <TabsTrigger
                value="quem-somos"
                className="rounded-t-xl rounded-b-none gap-2 px-4 py-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm flex-shrink-0"
              >
                <Info className="w-4 h-4" />
                <span className="hidden sm:inline">Quem Somos</span>
                <span className="sm:hidden">Sobre</span>
              </TabsTrigger>
              <TabsTrigger
                value="contato"
                className="rounded-t-xl rounded-b-none gap-2 px-4 py-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm flex-shrink-0"
              >
                <Phone className="w-4 h-4" />
                Contato
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="p-5">
            {/* Tab: Identidade Visual */}
            <TabsContent value="identidade" className="mt-0">
              <form onSubmit={handleSubmit}>
                <div className="grid gap-6 lg:grid-cols-2">
                  <SectionCard
                    icon={Palette}
                    iconBg="#DBEAFE"
                    iconColor="#2563EB"
                    title="Identidade Visual"
                    description="Logo e cores da empresa"
                  >
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Logo da Empresa</Label>
                        {formData.logo_url ? (
                          <div className="relative w-32 h-32 rounded-2xl overflow-hidden border">
                            <img
                              src={formData.logo_url}
                              alt="Logo"
                              className="w-full h-full object-contain"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              className="absolute top-1 right-1 rounded-xl"
                              onClick={() => setFormData(prev => ({ ...prev, logo_url: '' }))}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-2 max-w-sm">
                            <Input
                              placeholder="Cole a URL do logo"
                              value={formData.logo_url}
                              onChange={(e) => setFormData(prev => ({ ...prev, logo_url: e.target.value }))}
                              className="rounded-xl"
                            />
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="primary_color" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cor Primária</Label>
                        <div className="flex gap-2">
                          <Input
                            id="primary_color"
                            type="color"
                            value={formData.primary_color}
                            onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                            className="w-16 h-10 p-1 rounded-xl"
                          />
                          <Input
                            value={formData.primary_color}
                            onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                            className="rounded-xl"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="secondary_color" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cor Secundária</Label>
                        <div className="flex gap-2">
                          <Input
                            id="secondary_color"
                            type="color"
                            value={formData.secondary_color}
                            onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                            className="w-16 h-10 p-1 rounded-xl"
                          />
                          <Input
                            value={formData.secondary_color}
                            onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                            className="rounded-xl"
                          />
                        </div>
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard
                    icon={ImageIcon}
                    iconBg="#EDE9FE"
                    iconColor="#7C3AED"
                    title="Preview"
                    description="Visualize como ficará"
                  >
                    <div className="space-y-4">
                      <div
                        className="h-16 rounded-xl flex items-center justify-center text-white font-bold text-xl"
                        style={{
                          background: `linear-gradient(135deg, ${formData.primary_color}, ${formData.secondary_color})`,
                        }}
                      >
                        {company?.name}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          className="rounded-xl text-white"
                          style={{ backgroundColor: formData.primary_color }}
                        >
                          Botão Primário
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-xl"
                          style={{ borderColor: formData.primary_color, color: formData.primary_color }}
                        >
                          Botão Outline
                        </Button>
                      </div>
                    </div>
                  </SectionCard>
                </div>

                <div className="mt-6 flex justify-end">
                  <Button type="submit" className="rounded-xl" disabled={updateMutation.isPending}>
                    <Save className="mr-2 h-4 w-4" />
                    {updateMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
                  </Button>
                </div>
              </form>
            </TabsContent>

            {/* Tab: Rodapé */}
            <TabsContent value="rodape" className="mt-0 space-y-6">
              {company && (
                <FooterSettingsManager
                  companyId={company.id}
                  socialLinks={formData.footer_social_links}
                  menus={formData.footer_menus}
                  onChange={(data) => {
                    setFormData(prev => ({
                      ...prev,
                      footer_social_links: data.footer_social_links as any,
                      footer_menus: data.footer_menus as any,
                    }));
                  }}
                />
              )}
              <SaveButton />
            </TabsContent>

            {/* Tab: Banners */}
            <TabsContent value="banners" className="mt-0">
              {company && <BannerManager companyId={company.id} />}
            </TabsContent>

            {/* Tab: Comunidade */}
            <TabsContent value="comunidade" className="mt-0 space-y-6">
              <SectionCard
                icon={MessageCircle}
                iconBg="#DCFCE7"
                iconColor="#16A34A"
                title="Canal da Comunidade"
                description="Configure o canal para seus jogadores acompanharem novidades"
              >
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="community_name" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nome do canal</Label>
                    <Input
                      id="community_name"
                      placeholder="Ex: Telegram da Sorte Grande"
                      value={formData.community_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, community_name: e.target.value }))}
                      className="rounded-xl"
                    />
                    <p className="text-xs text-muted-foreground">
                      Nome que aparecerá no banner: "Participe do nosso canal do {formData.community_name || '...'}"
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="community_url" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Link do canal</Label>
                    <Input
                      id="community_url"
                      type="url"
                      placeholder="Ex: https://t.me/sortegrande"
                      value={formData.community_url}
                      onChange={(e) => setFormData(prev => ({ ...prev, community_url: e.target.value }))}
                      className="rounded-xl"
                    />
                    <p className="text-xs text-muted-foreground">
                      Link para o canal do Telegram, grupo do WhatsApp, Instagram, etc.
                    </p>
                  </div>

                  {formData.community_name && formData.community_url && (
                    <div className="mt-4">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Preview do banner</Label>
                      <div
                        className="rounded-xl p-3 flex items-center justify-between text-white text-sm"
                        style={{ backgroundColor: company?.primary_color || '#3B82F6' }}
                      >
                        <div className="flex items-center gap-2">
                          <MessageCircle className="h-4 w-4" />
                          <span>
                            Participe do nosso canal do <strong>{formData.community_name}</strong>!
                          </span>
                        </div>
                        <span className="text-xs underline opacity-80">Entrar</span>
                      </div>
                    </div>
                  )}
                </div>
              </SectionCard>
              <SaveButton />
            </TabsContent>

            {/* Tab: Quem Somos */}
            <TabsContent value="quem-somos" className="mt-0 space-y-6">
              <SectionCard
                icon={Info}
                iconBg="#FEF3C7"
                iconColor="#D97706"
                title="Quem Somos"
                description="Texto institucional exibido na página pública"
              >
                <div className="space-y-2">
                  <Label htmlFor="about_us" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sobre a empresa</Label>
                  <Textarea
                    id="about_us"
                    placeholder="Descreva sua empresa, missão, valores..."
                    rows={8}
                    value={formData.about_us}
                    onChange={(e) => setFormData(prev => ({ ...prev, about_us: e.target.value }))}
                    className="rounded-xl"
                  />
                  <p className="text-xs text-muted-foreground">
                    Este texto será exibido na página "Quem Somos" do site público.
                  </p>
                </div>
              </SectionCard>
              <SaveButton />
            </TabsContent>

            {/* Tab: Contato */}
            <TabsContent value="contato" className="mt-0 space-y-6">
              <SectionCard
                icon={Phone}
                iconBg="#FCE7F3"
                iconColor="#DB2777"
                title="Informações de Contato"
                description="Configure as formas de contato na página pública"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="contact_whatsapp" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">WhatsApp</Label>
                    <Input
                      id="contact_whatsapp"
                      placeholder="Ex: 5511999999999"
                      value={formData.contact_info.whatsapp}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        contact_info: { ...prev.contact_info, whatsapp: e.target.value },
                      }))}
                      className="rounded-xl"
                    />
                    <p className="text-xs text-muted-foreground">Número com código do país (sem +)</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact_phone" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Telefone</Label>
                    <Input
                      id="contact_phone"
                      placeholder="Ex: (11) 3333-4444"
                      value={formData.contact_info.phone}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        contact_info: { ...prev.contact_info, phone: e.target.value },
                      }))}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact_email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">E-mail</Label>
                    <Input
                      id="contact_email"
                      type="email"
                      placeholder="Ex: contato@empresa.com"
                      value={formData.contact_info.email}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        contact_info: { ...prev.contact_info, email: e.target.value },
                      }))}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact_instagram" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Instagram</Label>
                    <Input
                      id="contact_instagram"
                      placeholder="Ex: https://instagram.com/suaempresa"
                      value={formData.contact_info.instagram}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        contact_info: { ...prev.contact_info, instagram: e.target.value },
                      }))}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact_facebook" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Facebook</Label>
                    <Input
                      id="contact_facebook"
                      placeholder="Ex: https://facebook.com/suaempresa"
                      value={formData.contact_info.facebook}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        contact_info: { ...prev.contact_info, facebook: e.target.value },
                      }))}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="contact_address" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Endereço</Label>
                    <Input
                      id="contact_address"
                      placeholder="Ex: Rua Exemplo, 123 - São Paulo, SP"
                      value={formData.contact_info.address}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        contact_info: { ...prev.contact_info, address: e.target.value },
                      }))}
                      className="rounded-xl"
                    />
                  </div>
                </div>
              </SectionCard>
              <SaveButton />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </EmpresaLayout>
  );
}
