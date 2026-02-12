import { useEffect, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant, useCompanyBranding } from '@/contexts/TenantContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { LoadingState } from '@/components/shared/LoadingState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Clock, Wallet, Users, Star, LogIn, UserPlus, LogOut } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PlayerAuthModal } from '@/components/public/PlayerAuthModal';
import { RafflePublicCard } from '@/components/public/RafflePublicCard';
import { PublicRanking } from '@/components/public/PublicRanking';
import { BannerCarousel } from '@/components/public/BannerCarousel';
import { PlayerAccountMenu } from '@/components/public/PlayerAccountMenu';

type PaymentNetAmountRow = {
  raffle_id: string;
  net_amount: number | null;
};

export default function LandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const { setCompanySlug, company, loading: tenantLoading } = useTenant();
  const { player, isAuthenticated, logout } = usePlayer();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [selectedRaffleId, setSelectedRaffleId] = useState<string | null>(null);

  useEffect(() => {
    if (slug) {
      setCompanySlug(slug);
    }
  }, [slug, setCompanySlug]);

  // Capture ref from URL and store in localStorage for affiliate tracking
  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode && slug) {
      localStorage.setItem(`affiliate_ref_${slug}`, refCode);
    }
  }, [searchParams, slug]);

  useCompanyBranding();

  // Fetch banners
  const { data: banners = [] } = useQuery({
    queryKey: ['public-banners', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_banners')
        .select('*')
        .eq('company_id', company!.id)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // Fetch active raffles
  const { data: raffles, isLoading: rafflesLoading } = useQuery({
    queryKey: ['public-raffles', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('raffles')
        .select('*, prize_tiers(*)')
        .eq('company_id', company!.id)
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const activeRaffleIds = (raffles || []).map((r) => r.id);
  const activeRaffleIdsKey = activeRaffleIds.join(',');

  // Net sales (já descontando taxas/comissões) por sorteio
  const { data: netSalesByRaffle = {} } = useQuery({
    queryKey: ['public-net-sales-by-raffle', company?.id, activeRaffleIdsKey],
    enabled: !!company?.id && activeRaffleIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('raffle_id, net_amount')
        .eq('company_id', company!.id)
        .eq('status', 'succeeded')
        .in('raffle_id', activeRaffleIds);

      if (error) throw error;

      const totals: Record<string, number> = {};
      for (const p of (data || []) as PaymentNetAmountRow[]) {
        const raffleId = p.raffle_id;
        totals[raffleId] = (totals[raffleId] || 0) + Number(p.net_amount || 0);
      }
      return totals;
    },
  });

  // Soma total de prêmios (todos os sorteios), usando vendas líquidas (net_amount)
  const totalPrize = (raffles || []).reduce((sum, r) => {
    const netSales = Number(netSalesByRaffle[r.id] || 0);
    const fixed = Number(r.fixed_prize_value || 0);
    const percent = Number(r.prize_percent_of_sales || 0) / 100;

    if (r.prize_mode === 'FIXED') return sum + fixed;
    if (r.prize_mode === 'PERCENT_ONLY') return sum + netSales * percent;
    // FIXED_PLUS_PERCENT
    return sum + fixed + netSales * percent;
  }, 0);

  const openAuth = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  if (tenantLoading) {
    return <LoadingState fullScreen message="Carregando..." />;
  }

  if (!company) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-2">Empresa não encontrada</h1>
          <p className="text-muted-foreground">A empresa solicitada não existe ou está inativa.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{ backgroundColor: company.primary_color }}
      >
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

          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                {player && (
                  <PlayerAccountMenu
                    slug={slug!}
                    player={player}
                    onLogout={logout}
                    variant="secondary"
                    className="bg-white/20 text-white hover:bg-white/30"
                  />
                )}
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" className="bg-transparent text-white border-white hover:bg-white/10 hover:text-white" onClick={() => openAuth('login')}>
                  <LogIn className="h-4 w-4 mr-2" />
                  Entrar
                </Button>
                <Button variant="outline" size="sm" className="bg-white text-black border-white hover:bg-white/90 hover:text-black" onClick={() => openAuth('register')}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Cadastrar
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Banner Carousel */}
      {banners.length > 0 && (
        <BannerCarousel banners={banners} className="mx-auto max-w-7xl mt-4 px-4" />
      )}

      {/* Hero Section */}
      <section
        className="py-16 text-white"
        style={{
          background: `linear-gradient(135deg, ${company.primary_color}, ${company.secondary_color})`,
        }}
      >
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Bolão de Números
          </h1>
          <p className="text-xl md:text-2xl text-white/80 mb-8">
            Escolha seus números e concorra a prêmios incríveis!
          </p>

          <div className="flex flex-wrap justify-center gap-6 mb-8">
            <div className="bg-white/20 rounded-xl px-6 py-4">
              <Wallet className="h-8 w-8 mx-auto mb-2" />
              <p className="text-3xl font-bold">
                {totalPrize > 0 ? `R$ ${totalPrize.toLocaleString('pt-BR')}` : 'A definir'}
              </p>
              <p className="text-sm text-white/80">em prêmios</p>
            </div>
            <div className="bg-white/20 rounded-xl px-6 py-4">
              <Trophy className="h-8 w-8 mx-auto mb-2" />
              <p className="text-3xl font-bold">{raffles?.length || 0}</p>
              <p className="text-sm text-white/80">sorteios ativos</p>
            </div>
          </div>

          {!isAuthenticated && (
            <Button size="lg" variant="secondary" onClick={() => openAuth('register')}>
              <Star className="mr-2 h-5 w-5" />
              Começar a Jogar
            </Button>
          )}
        </div>
      </section>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        {rafflesLoading ? (
          <LoadingState message="Carregando sorteios..." className="py-12" />
        ) : raffles?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum sorteio ativo no momento</h3>
              <p className="text-muted-foreground">
                Fique atento, novos sorteios serão lançados em breve!
              </p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="sorteios" className="space-y-6">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-3">
              <TabsTrigger value="sorteios">Sorteios</TabsTrigger>
              <TabsTrigger value="ranking">Ranking</TabsTrigger>
              <TabsTrigger value="regulamento">Regulamento</TabsTrigger>
            </TabsList>

            <TabsContent value="sorteios">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {raffles?.map((raffle) => (
                  <RafflePublicCard
                    key={raffle.id}
                    raffle={raffle}
                    companySlug={slug!}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="ranking">
              {selectedRaffleId || raffles?.[0]?.id ? (
                <div className="space-y-4">
                  {raffles && raffles.length > 1 && (
                    <div className="flex gap-2 flex-wrap justify-center">
                      {raffles.map((r) => (
                        <Button
                          key={r.id}
                          variant={selectedRaffleId === r.id || (!selectedRaffleId && r.id === raffles[0].id) ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedRaffleId(r.id)}
                        >
                          {r.name}
                        </Button>
                      ))}
                    </div>
                  )}
                  <PublicRanking raffleId={selectedRaffleId || raffles![0].id} />
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">Selecione um sorteio para ver o ranking.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="regulamento">
              <Card>
                <CardHeader>
                  <CardTitle>Regulamento dos Sorteios</CardTitle>
                  <CardDescription>Regras gerais de participação</CardDescription>
                </CardHeader>
                <CardContent className="prose prose-sm max-w-none">
                  <h4>1. Participação</h4>
                  <p>
                    Para participar dos sorteios, é necessário cadastrar-se com CPF válido e adquirir cartelas.
                    Cada cartela contém números únicos gerados aleatoriamente.
                  </p>

                  <h4>2. Premiação</h4>
                  <p>
                    Os prêmios são distribuídos de acordo com as faixas de acertos definidas em cada sorteio.
                    Quanto mais números você acertar, maior será a sua premiação.
                  </p>

                  <h4>3. Ranking</h4>
                  <p>
                    O ranking é atualizado em tempo real conforme os números são sorteados.
                    A posição é determinada pela quantidade de acertos e, em caso de empate, pela data de compra da cartela.
                  </p>

                  <h4>4. Pagamento de Prêmios</h4>
                  <p>
                    Os prêmios serão pagos aos ganhadores após a finalização oficial do sorteio.
                    O pagamento será realizado via transferência bancária para conta do jogador.
                  </p>

                  <h4>5. Disposições Gerais</h4>
                  <p>
                    A participação nos sorteios implica na aceitação integral deste regulamento.
                    A empresa reserva-se o direito de alterar as regras mediante aviso prévio.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </main>

      {/* Auth Modal */}
      <PlayerAuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        mode={authMode}
        onModeChange={setAuthMode}
        companyId={company.id}
      />
    </div>
  );
}
