import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, GripVertical, Loader2, ExternalLink, Link as LinkIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BannerManagerProps {
  companyId: string;
}

interface Banner {
  id: string;
  image_url: string;
  redirect_url: string | null;
  display_order: number;
  is_active: boolean;
}

export function BannerManager({ companyId }: BannerManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newBanner, setNewBanner] = useState({ image_url: '', redirect_url: '' });
  // const [uploading, setUploading] = useState(false); // TODO: descomentar quando S3 estiver configurado

  const { data: banners = [], isLoading } = useQuery({
    queryKey: ['company-banners', companyId],
    queryFn: async () => {
      const data = await api.get<Banner[]>(`/banners/company/${companyId}`);
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async (banner: { image_url: string; redirect_url: string }) => {
      const maxOrder = banners.length > 0 ? Math.max(...banners.map(b => b.display_order)) : -1;
      await api.post(`/banners`, {
        company_id: companyId,
        image_url: banner.image_url,
        redirect_url: banner.redirect_url || null,
        display_order: maxOrder + 1,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-banners', companyId] });
      setAddDialogOpen(false);
      setNewBanner({ image_url: '', redirect_url: '' });
      toast({ title: 'Banner adicionado!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao adicionar banner', description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (bannerId: string) => {
      await api.delete(`/banners/${bannerId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-banners', companyId] });
      toast({ title: 'Banner removido!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao remover banner', description: error.message });
    },
  });

  // TODO: descomentar quando S3 estiver configurado
  // const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const file = e.target.files?.[0];
  //   if (!file) return;
  //   setUploading(true);
  //   try {
  //     const publicUrl = await api.upload(file, companyId, 'banners');
  //     setNewBanner(prev => ({ ...prev, image_url: publicUrl }));
  //     toast({ title: 'Imagem enviada!' });
  //   } catch (error: any) {
  //     toast({ variant: 'destructive', title: 'Erro ao enviar imagem', description: error.message });
  //   } finally {
  //     setUploading(false);
  //   }
  // };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Banners da Landing Page</CardTitle>
            <CardDescription>
              Adicione banners que aparecem na página inicial. Se houver mais de um, será exibido como carrossel.
            </CardDescription>
          </div>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Banner
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Banner</DialogTitle>
                <DialogDescription>Adicione uma imagem e link opcional de redirecionamento</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Imagem do Banner</Label>
                  {newBanner.image_url ? (
                    <div className="relative aspect-[21/9] rounded-lg overflow-hidden border">
                      <img
                        src={newBanner.image_url}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <Button
                        size="sm"
                        variant="destructive"
                        className="absolute top-2 right-2"
                        onClick={() => setNewBanner(prev => ({ ...prev, image_url: '' }))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Cole a URL da imagem do banner"
                        value={newBanner.image_url}
                        onChange={(e) => setNewBanner(prev => ({ ...prev, image_url: e.target.value }))}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="redirect_url">URL de Redirecionamento (opcional)</Label>
                  <Input
                    id="redirect_url"
                    value={newBanner.redirect_url}
                    onChange={(e) => setNewBanner(prev => ({ ...prev, redirect_url: e.target.value }))}
                    placeholder="https://exemplo.com/pagina"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => addMutation.mutate(newBanner)}
                  disabled={!newBanner.image_url || addMutation.isPending}
                >
                  {addMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Adicionar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : banners.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ImagePlus className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhum banner adicionado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {banners.map((banner, index) => (
              <div
                key={banner.id}
                className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30"
              >
                <GripVertical className="h-5 w-5 text-muted-foreground" />
                <div className="h-16 w-28 rounded overflow-hidden flex-shrink-0">
                  <img
                    src={banner.image_url}
                    alt={`Banner ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Banner {index + 1}</p>
                  {banner.redirect_url && (
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" />
                      {banner.redirect_url}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteMutation.mutate(banner.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
