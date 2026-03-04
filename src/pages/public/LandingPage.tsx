import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useTenant, useCompanyBranding } from '@/contexts/TenantContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { LoadingState } from '@/components/shared/LoadingState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, LogIn, UserPlus, Sparkles, ArrowRight, Gift, TrendingUp } from 'lucide-react';
import { PlayerAuthModal } from '@/components/public/PlayerAuthModal';
import { RafflePublicCard } from '@/components/public/RafflePublicCard';
import { PublicRanking } from '@/components/public/PublicRanking';
import { BannerCarousel } from '@/components/public/BannerCarousel';
import { PlayerAccountMenu } from '@/components/public/PlayerAccountMenu';
import { PublicFooter } from '@/components/public/PublicFooter';
import { PublicNavMenu } from '@/components/public/PublicNavMenu';

type PaymentNetAmountRow = {
  raffle_id: string;
  net_amount: number | null;
};

export default function LandingPage() {
  const [searchParams] = useSearchParams();
  const { company, loading: tenantLoading } = useTenant();
  const { player, isAuthenticated, logout } = usePlayer();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [selectedRaffleId, setSelectedRaffleId] = useState<string | null>(null);

  // Capture ref from URL and store in localStorage for affiliate tracking
  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode && company?.id) {
      localStorage.setItem(`affiliate_ref_${company.id}`, refCode);
    }
  }, [searchParams, company?.id]);

  useCompanyBranding();

  // Fetch banners
  const { data: banners = [] } = useQuery({
    queryKey: ['public-banners', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const data = await api.get<any[]>(`/banners/company/${company!.id}`, { active: 'true' });
      return data;
    },
  });

  // Fetch active raffles
  const { data: raffles, isLoading: rafflesLoading } = useQuery({
    queryKey: ['public-raffles', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const data = await api.get<any[]>(`/raffles/public/${company!.id}`);
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
      const data = await api.get<Record<string, number>>(
        `/payments/net-sales-by-raffle/${company!.id}`,
        { raffleIds: activeRaffleIds.join(',') }
      );
      return data;
    },
  });

  // Soma total de prêmios (todos os sorteios)
  // netSalesByRaffle already returns SUM(prize_pool_contribution) per raffle
  const totalPrize = (raffles || []).reduce((sum, r) => {
    const prizePoolContrib = Number(netSalesByRaffle[r.id] || 0);
    const fixed = Number(r.fixed_prize_value || 0);

    if (r.prize_mode === 'FIXED') return sum + fixed;
    if (r.prize_mode === 'PERCENT_ONLY') return sum + prizePoolContrib;
    // FIXED_PLUS_PERCENT
    return sum + fixed + prizePoolContrib;
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
                  <LogIn className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Entrar</span>
                </Button>
                <Button variant="outline" size="sm" className="bg-white text-black border-white hover:bg-white/90 hover:text-black" onClick={() => openAuth('register')}>
                  <UserPlus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Cadastrar</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <PublicNavMenu primaryColor={company.primary_color} companyId={company.id} />

      {/* Banner Carousel */}
      {banners.length > 0 && (
        <BannerCarousel banners={banners} className="mx-auto max-w-7xl mt-4 px-4" />
      )}

      {/* Hero Section */}
      <section
        className="relative overflow-hidden text-white"
        style={{
          background: `linear-gradient(160deg, ${company.primary_color} 0%, ${company.secondary_color} 50%, ${company.primary_color}ee 100%)`,
        }}
      >
        {/* Decorative background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }}
          />
          <div
            className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full opacity-[0.07]"
            style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }}
          />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.04]"
            style={{ border: '1px solid white' }}
          />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full opacity-[0.06]"
            style={{ border: '1px solid white' }}
          />
        </div>

        <div className="relative container mx-auto px-4 py-16 md:py-20">
          {/* Top badge */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 text-sm">
              <Sparkles className="h-4 w-4 text-yellow-300" />
              <span className="text-white/90">Plataforma oficial de sorteios</span>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-center mb-4 tracking-tight">
            Escolha seus números,
            <br />
            <span className="text-transparent bg-clip-text" style={{
              backgroundImage: 'linear-gradient(90deg, #fff 0%, rgba(255,255,255,0.7) 100%)',
            }}>
              concorra a prêmios
            </span>
          </h1>

          <p className="text-center text-lg md:text-xl text-white/70 max-w-2xl mx-auto mb-10">
            Participe dos sorteios de <strong className="text-white/90">{company.name}</strong> com total
            segurança e transparência. Acompanhe tudo em tempo real.
          </p>

          {/* Stats cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 max-w-2xl mx-auto mb-10">
            <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl p-4 text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-yellow-400/20 mb-2">
                <Trophy className="h-5 w-5 text-yellow-300" />
              </div>
              <p className="text-xl md:text-2xl font-bold tracking-tight">
                {totalPrize > 0
                  ? `R$ ${totalPrize.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                  : 'A definir'}
              </p>
              <p className="text-xs text-white/60 mt-0.5">em prêmios</p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl p-4 text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/15 mb-2">
                <Gift className="h-5 w-5 text-white/80" />
              </div>
              <p className="text-xl md:text-2xl font-bold tracking-tight">
                {raffles?.length || 0}
              </p>
              <p className="text-xs text-white/60 mt-0.5">{(raffles?.length || 0) === 1 ? 'sorteio ativo' : 'sorteios ativos'}</p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl p-4 text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-green-400/20 mb-2">
                <TrendingUp className="h-5 w-5 text-green-300" />
              </div>
              <p className="text-xl md:text-2xl font-bold tracking-tight">
                Ao vivo
              </p>
              <p className="text-xs text-white/60 mt-0.5">ranking em tempo real</p>
            </div>
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {!isAuthenticated ? (
              <>
                <Button
                  size="lg"
                  onClick={() => openAuth('register')}
                  className="bg-white text-black hover:bg-white/90 shadow-lg shadow-black/10 font-semibold px-8 h-12 text-base"
                >
                  Começar a Jogar
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  onClick={() => openAuth('login')}
                  className="text-white/80 hover:text-white hover:bg-white/10 h-12"
                >
                  Já tenho conta
                </Button>
              </>
            ) : raffles && raffles.length > 0 ? (
              <Button
                size="lg"
                asChild
                className="bg-white text-black hover:bg-white/90 shadow-lg shadow-black/10 font-semibold px-8 h-12 text-base"
              >
                <Link to={`/sorteio/${raffles[0].id}`}>
                  Ver Sorteios
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            ) : null}
          </div>
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
                  {company.general_regulations ? (
                    <div className="whitespace-pre-line">
                      {company.general_regulations}
                    </div>
                  ) : (
                    <>
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
                    </>
                  )}
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

      <PublicFooter />
    </div>
  );
}
