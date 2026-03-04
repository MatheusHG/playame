import { useTenant, useCompanyBranding } from '@/contexts/TenantContext';
import { LoadingState } from '@/components/shared/LoadingState';
import { PublicNavMenu } from '@/components/public/PublicNavMenu';
import { PublicFooter } from '@/components/public/PublicFooter';
import { Card, CardContent } from '@/components/ui/card';
import { Phone, Mail, MapPin, MessageCircle, Instagram, Facebook, Info } from 'lucide-react';
import { PlayerAccountMenu } from '@/components/public/PlayerAccountMenu';
import { usePlayer } from '@/contexts/PlayerContext';

export default function Contato() {
  const { company, loading: tenantLoading } = useTenant();
  const { player, isAuthenticated, logout } = usePlayer();

  useCompanyBranding();

  if (tenantLoading) {
    return <LoadingState fullScreen message="Carregando..." />;
  }

  if (!company) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Empresa não encontrada.</p>
      </div>
    );
  }

  const primaryColor = company.primary_color || '#3B82F6';
  const contactInfo = (company as any).contact_info || {};
  const hasAnyContact = contactInfo.whatsapp || contactInfo.phone || contactInfo.email || contactInfo.address || contactInfo.instagram || contactInfo.facebook;

  const contactItems = [
    {
      key: 'whatsapp',
      icon: MessageCircle,
      label: 'WhatsApp',
      value: contactInfo.whatsapp,
      href: contactInfo.whatsapp ? `https://wa.me/${contactInfo.whatsapp.replace(/\D/g, '')}` : null,
      color: 'text-green-600',
    },
    {
      key: 'phone',
      icon: Phone,
      label: 'Telefone',
      value: contactInfo.phone,
      href: contactInfo.phone ? `tel:${contactInfo.phone.replace(/\D/g, '')}` : null,
      color: 'text-blue-600',
    },
    {
      key: 'email',
      icon: Mail,
      label: 'E-mail',
      value: contactInfo.email,
      href: contactInfo.email ? `mailto:${contactInfo.email}` : null,
      color: 'text-red-500',
    },
    {
      key: 'instagram',
      icon: Instagram,
      label: 'Instagram',
      value: contactInfo.instagram,
      href: contactInfo.instagram,
      color: 'text-pink-600',
    },
    {
      key: 'facebook',
      icon: Facebook,
      label: 'Facebook',
      value: contactInfo.facebook,
      href: contactInfo.facebook,
      color: 'text-blue-700',
    },
    {
      key: 'address',
      icon: MapPin,
      label: 'Endereço',
      value: contactInfo.address,
      href: contactInfo.address ? `https://maps.google.com/?q=${encodeURIComponent(contactInfo.address)}` : null,
      color: 'text-orange-600',
    },
  ].filter((item) => item.value);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b" style={{ backgroundColor: primaryColor }}>
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {company.logo_url ? (
              <img src={company.logo_url} alt={company.name} className="h-10 w-auto" />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center text-white font-bold text-xl">
                {company.name.charAt(0)}
              </div>
            )}
            <span className="text-white font-bold text-xl">{company.name}</span>
          </div>
          {isAuthenticated && player && (
            <PlayerAccountMenu player={player} onLogout={logout} variant="secondary" className="bg-white/20 text-white hover:bg-white/30" />
          )}
        </div>
      </header>

      <PublicNavMenu primaryColor={primaryColor} companyId={company.id} />

      <main className="container mx-auto px-4 py-8 flex-1">
        <div className="flex items-center gap-3 mb-6">
          <Phone className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Fale Conosco</h1>
        </div>

        {!hasAnyContact ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Info className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">Informações de contato não disponíveis no momento.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {contactItems.map((item) => {
              const Icon = item.icon;
              const content = (
                <Card
                  key={item.key}
                  className={item.href ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}
                >
                  <CardContent className="flex items-center gap-4 py-6">
                    <div className={`p-3 rounded-full bg-muted ${item.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-muted-foreground">{item.label}</p>
                      <p className="font-semibold truncate">{item.value}</p>
                    </div>
                  </CardContent>
                </Card>
              );

              if (item.href) {
                return (
                  <a
                    key={item.key}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="no-underline"
                  >
                    {content}
                  </a>
                );
              }
              return content;
            })}
          </div>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}
