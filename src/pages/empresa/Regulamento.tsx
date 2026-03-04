import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useTenant } from '@/contexts/TenantContext';
import { EmpresaLayout } from '@/components/layouts/EmpresaLayout';
import { LoadingState } from '@/components/shared/LoadingState';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Save, Loader2, Eye, EyeOff } from 'lucide-react';

export default function EmpresaRegulamento() {
  const { company, loading, refetchCompany } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [regulations, setRegulations] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (company) {
      setRegulations(company.general_regulations || '');
    }
  }, [company]);

  const updateMutation = useMutation({
    mutationFn: async (text: string) => {
      await api.patch(`/companies/${company!.id}`, {
        general_regulations: text || null,
      });
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['company'] });
      await refetchCompany();
      toast({ title: 'Regulamento salvo com sucesso!' });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar regulamento',
        description: error.message,
      });
    },
  });

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    updateMutation.mutate(regulations);
  };

  if (loading) {
    return <LoadingState fullScreen message="Carregando empresa..." />;
  }

  return (
    <EmpresaLayout title="Regulamento" description="Defina o regulamento geral dos sorteios exibido no site">
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Regulamento dos Sorteios</CardTitle>
            <CardDescription>
              Este texto será exibido na aba "Regulamento" da página pública do site para os jogadores.
              Use para definir as regras gerais de participação, premiação, pagamento e demais disposições.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="regulations">Texto do regulamento</Label>
              <Textarea
                id="regulations"
                value={regulations}
                onChange={(e) => setRegulations(e.target.value)}
                placeholder={"1. Participação\nPara participar dos sorteios, é necessário cadastrar-se com CPF válido e adquirir cartelas.\n\n2. Premiação\nOs prêmios são distribuídos de acordo com as faixas de acertos definidas em cada sorteio.\n\n3. Ranking\nO ranking é atualizado em tempo real conforme os números são sorteados.\n\n4. Pagamento de Prêmios\nOs prêmios serão pagos aos ganhadores após a finalização oficial do sorteio.\n\n5. Disposições Gerais\nA participação nos sorteios implica na aceitação integral deste regulamento."}
                rows={16}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Dica: use quebras de linha para separar os parágrafos. O texto será exibido preservando a formatação.
              </p>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
              >
                {showPreview ? (
                  <>
                    <EyeOff className="mr-2 h-4 w-4" />
                    Ocultar preview
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 h-4 w-4" />
                    Ver preview
                  </>
                )}
              </Button>
            </div>

            {showPreview && (
              <Card className="bg-muted/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Regulamento dos Sorteios</CardTitle>
                  <CardDescription>Regras gerais de participação</CardDescription>
                </CardHeader>
                <CardContent>
                  {regulations ? (
                    <div className="prose prose-sm max-w-none whitespace-pre-line text-sm">
                      {regulations}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      Nenhum regulamento definido. O regulamento padrão será exibido.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {updateMutation.isPending ? 'Salvando...' : 'Salvar Regulamento'}
          </Button>
        </div>
      </form>
    </EmpresaLayout>
  );
}
