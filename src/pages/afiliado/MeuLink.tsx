import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AffiliateLayout } from '@/components/layouts/AffiliateLayout';
import { useAffiliate } from '@/contexts/AffiliateContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Copy,
  ExternalLink,
  QrCode,
  Share2,
  Link as LinkIcon,
  CheckCircle,
  XCircle,
} from 'lucide-react';

export default function MeuLink() {
  const { slug } = useParams<{ slug: string }>();
  const { affiliate } = useAffiliate();
  const { toast } = useToast();

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const fullLink = `${baseUrl}/empresa/${slug}?ref=${affiliate?.link_code}`;

  // Fetch stats for this link
  const { data: linkStats } = useQuery({
    queryKey: ['affiliate-link-stats', affiliate?.id],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('affiliate_id', affiliate?.id);

      if (error) throw error;
      return { totalSales: count || 0 };
    },
    enabled: !!affiliate?.id,
  });

  const copyLink = () => {
    navigator.clipboard.writeText(fullLink);
    toast({
      title: 'Link copiado!',
      description: 'Seu link foi copiado para a área de transferência.',
    });
  };

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${affiliate?.company.name} - Bolão`,
          text: 'Participe do bolão! Use meu link de indicação:',
          url: fullLink,
        });
      } catch (err) {
        // User cancelled sharing
      }
    } else {
      copyLink();
    }
  };

  if (!affiliate) return null;

  return (
    <AffiliateLayout title="Meu Link" description="Compartilhe seu link para ganhar comissões">
      <div className="space-y-6 max-w-2xl">
        {/* Link Status */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <LinkIcon className="h-5 w-5" />
                  Link de Afiliado
                </CardTitle>
                <CardDescription>
                  Compartilhe este link para receber comissões em cada venda
                </CardDescription>
              </div>
              <Badge variant={affiliate.is_sales_paused ? 'destructive' : 'default'}>
                {affiliate.is_sales_paused ? (
                  <>
                    <XCircle className="h-3 w-3 mr-1" />
                    Pausado
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Ativo
                  </>
                )}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={fullLink}
                readOnly
                className="font-mono text-sm"
              />
              <Button variant="outline" size="icon" onClick={copyLink}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={copyLink}>
                <Copy className="h-4 w-4 mr-2" />
                Copiar Link
              </Button>
              <Button variant="outline" onClick={shareLink}>
                <Share2 className="h-4 w-4 mr-2" />
                Compartilhar
              </Button>
              <Button variant="outline" asChild>
                <a href={fullLink} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir Link
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Link Code */}
        <Card>
          <CardHeader>
            <CardTitle>Seu Código</CardTitle>
            <CardDescription>
              Código único do seu link de afiliado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="px-6 py-4 rounded-lg bg-muted font-mono text-2xl font-bold tracking-wider">
                {affiliate.link_code.toUpperCase()}
              </div>
              <div className="text-sm text-muted-foreground">
                <p>Use este código para criar links personalizados:</p>
                <code className="text-xs">?ref={affiliate.link_code}</code>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Estatísticas do Link</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Vendas Totais</p>
                <p className="text-3xl font-bold">{linkStats?.totalSales || 0}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Sua Comissão</p>
                <p className="text-3xl font-bold">{affiliate.commission_percent}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* How it works */}
        <Card>
          <CardHeader>
            <CardTitle>Como Funciona</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                <span>Compartilhe seu link com amigos, familiares e conhecidos</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                <span>Quando alguém comprar uma cartela usando seu link, você ganha comissão</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
                <span>Acompanhe suas vendas e comissões em tempo real no painel</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">4</span>
                <span>Receba suas comissões após a confirmação do pagamento</span>
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </AffiliateLayout>
  );
}
