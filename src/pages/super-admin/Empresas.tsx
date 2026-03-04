import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { SuperAdminLayout } from '@/components/layouts/SuperAdminLayout';
import { DataTable, Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Settings, Pause, Play, Trash2, MoreVertical, LogIn } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Company, CompanyStatus } from '@/types/database.types';

export default function SuperAdminEmpresas() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [newCompany, setNewCompany] = useState({ name: '', slug: '' });

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const data = await api.get<Company[]>('/companies');
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (company: { name: string; slug: string }) => {
      const data = await api.post<Company>('/companies', company);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setCreateDialogOpen(false);
      setNewCompany({ name: '', slug: '' });
      toast({ title: 'Empresa criada com sucesso!' });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar empresa',
        description: error.message.includes('duplicate') 
          ? 'Já existe uma empresa com este slug'
          : error.message,
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: CompanyStatus }) => {
      await api.patch(`/companies/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast({ title: 'Status atualizado!' });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar status',
        description: error.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/companies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setDeleteDialogOpen(false);
      setSelectedCompany(null);
      toast({ title: 'Empresa removida!' });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao remover empresa',
        description: error.message,
      });
    },
  });

  const columns: Column<Company>[] = [
    {
      key: 'name',
      header: 'Nome',
      render: (item) => (
        <div className="flex items-center gap-3">
          <div
            className="h-8 w-8 rounded flex items-center justify-center text-white text-sm font-bold"
            style={{ backgroundColor: item.primary_color }}
          >
            {item.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium">{item.name}</p>
            <p className="text-xs text-muted-foreground">/{item.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'admin_fee_percentage',
      header: 'Taxa Admin',
      render: (item) => `${item.admin_fee_percentage}%`,
    },
    {
      key: 'payments_enabled',
      header: 'Pagamentos',
      render: (item) => (
        <span className={item.payments_enabled ? 'text-primary' : 'text-muted-foreground'}>
          {item.payments_enabled ? 'Ativo' : 'Inativo'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: 'actions',
      header: 'Ações',
      render: (item) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => {
              if (item.custom_domain) {
                window.open(`https://${item.custom_domain}/admin/dashboard`, '_blank');
              } else {
                navigate('/admin/dashboard');
              }
            }} className="gap-2">
              <LogIn className="h-4 w-4" />
              Acessar empresa
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(`/super-admin/empresas/${item.id}/configurar`)} className="gap-2">
              <Settings className="h-4 w-4" />
              Configurar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                updateStatusMutation.mutate({
                  id: item.id,
                  status: item.status === 'active' ? 'suspended' : 'active',
                })
              }
              className="gap-2"
            >
              {item.status === 'active' ? (
                <>
                  <Pause className="h-4 w-4" />
                  Suspender
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Ativar
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                setSelectedCompany(item);
                setDeleteDialogOpen(true);
              }}
              className="gap-2 text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const handleCreateCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompany.name || !newCompany.slug) return;
    createMutation.mutate(newCompany);
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  return (
    <SuperAdminLayout title="Empresas" description="Gerencie as empresas da plataforma">
      <div className="mb-6 flex justify-end">
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Empresa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreateCompany}>
              <DialogHeader>
                <DialogTitle>Criar Nova Empresa</DialogTitle>
                <DialogDescription>
                  Preencha os dados para criar uma nova empresa na plataforma.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Empresa</Label>
                  <Input
                    id="name"
                    value={newCompany.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setNewCompany({
                        name,
                        slug: generateSlug(name),
                      });
                    }}
                    placeholder="Minha Empresa"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug (URL)</Label>
                  <Input
                    id="slug"
                    value={newCompany.slug}
                    onChange={(e) => setNewCompany({ ...newCompany, slug: e.target.value })}
                    placeholder="minha-empresa"
                  />
                  <p className="text-xs text-muted-foreground">
                    Slug: {newCompany.slug || 'slug'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-custom-domain">Domínio Próprio</Label>
                  <Input
                    id="new-custom-domain"
                    value={(newCompany as any).custom_domain || ''}
                    onChange={(e) => setNewCompany({ ...newCompany, custom_domain: e.target.value || undefined } as any)}
                    placeholder="www.empresa.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    Domínio personalizado (opcional). Configure CNAME para a plataforma.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Criando...' : 'Criar Empresa'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        data={companies}
        columns={columns}
        loading={isLoading}
        searchPlaceholder="Buscar empresas..."
        emptyMessage="Nenhuma empresa cadastrada"
        onRowClick={(company) => navigate(`/super-admin/empresas/${company.id}/configurar`)}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Remover Empresa"
        description={`Tem certeza que deseja remover a empresa "${selectedCompany?.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Remover"
        variant="destructive"
        onConfirm={() => selectedCompany && deleteMutation.mutate(selectedCompany.id)}
        loading={deleteMutation.isPending}
      />
    </SuperAdminLayout>
  );
}
