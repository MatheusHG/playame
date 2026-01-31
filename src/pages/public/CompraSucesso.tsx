import { useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant, useCompanyBranding } from '@/contexts/TenantContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { LoadingState } from '@/components/shared/LoadingState';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Ticket, Home, AlertCircle } from 'lucide-react';

export default function CompraSucesso() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const paymentId = searchParams.get('payment_id');
  const { setCompanySlug, company, loading: tenantLoading } = useTenant();
  const { player } = usePlayer();

  useEffect(() => {
    if (slug) {
      setCompanySlug(slug);
    }
  }, [slug, setCompanySlug]);

  useCompanyBranding();

  // Fetch payment and ticket details
  const { data: payment, isLoading, error } = useQuery({
    queryKey: ['payment', paymentId],
    enabled: !!paymentId && !!player,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          tickets!inner(
            *,
            ticket_numbers(number)
          ),
          raffles!inner(name)
        `)
        .eq('id', paymentId!)
        .single();

      if (error) throw error;
      return data;
    },
  });

  if (tenantLoading || isLoading) {
    return <LoadingState fullScreen message="Verificando pagamento..." />;
  }

  if (!company) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-2">Empresa não encontrada</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header
        className="border-b"
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
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-lg mx-auto">
          {error || !payment ? (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertCircle className="h-16 w-16 mx-auto text-destructive mb-4" />
                <h2 className="text-xl font-bold mb-2">Pagamento não encontrado</h2>
                <p className="text-muted-foreground mb-6">
                  Não foi possível verificar seu pagamento. Se você fez o pagamento, 
                  aguarde alguns minutos e verifique suas cartelas.
                </p>
                <Button asChild>
                  <Link to={`/empresa/${slug}`}>
                    <Home className="mr-2 h-4 w-4" />
                    Voltar ao Início
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="text-center">
                <CheckCircle className="h-16 w-16 mx-auto text-primary mb-4" />
                <CardTitle className="text-2xl">Compra Confirmada!</CardTitle>
                <CardDescription>
                  Sua cartela foi registrada com sucesso
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-muted rounded-lg p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sorteio</span>
                    <span className="font-medium">{(payment.raffles as { name: string })?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valor Pago</span>
                    <span className="font-medium">R$ {Number(payment.amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className="font-medium text-primary">Confirmado</span>
                  </div>
                </div>

                {payment.tickets && (
                  <div className="space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Ticket className="h-4 w-4" />
                      Seus Números
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {(payment.tickets as { ticket_numbers: { number: number }[] }).ticket_numbers
                        ?.sort((a: { number: number }, b: { number: number }) => a.number - b.number)
                        .map((tn: { number: number }, idx: number) => (
                          <div
                            key={idx}
                            className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-mono font-bold"
                          >
                            {String(tn.number).padStart(2, '0')}
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 space-y-3">
                  <Button asChild className="w-full">
                    <Link to={`/empresa/${slug}`}>
                      <Home className="mr-2 h-4 w-4" />
                      Voltar e Comprar Mais
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
