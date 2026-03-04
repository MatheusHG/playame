import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { SuperAdminLayout } from '@/components/layouts/SuperAdminLayout';
import { DataTable, Column } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AppRole, UserRole, Company } from '@/types/database.types';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

interface UserRoleWithDetails extends UserRole {
  company_name?: string;
  user_email?: string;
}

export default function SuperAdminUsuarios() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRoleWithDetails | null>(null);
  const [newRole, setNewRole] = useState({
    email: '',
    password: '',
    role: 'ADMIN_EMPRESA' as AppRole,
    company_id: '',
  });

  const { data: userRoles = [], isLoading } = useQuery({
    queryKey: ['user-roles'],
    queryFn: async () => {
      const data = await api.get<UserRoleWithDetails[]>('/admin/user-roles');
      return data;
    },
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies-select'],
    queryFn: async () => {
      const data = await api.get<Pick<Company, 'id' | 'name'>[]>('/companies', { status: 'active' });
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newRole) => {
      await api.post('/auth/register', {
        email: data.email,
        password: data.password,
        role: data.role,
        company_id: data.role === 'SUPER_ADMIN' ? null : data.company_id || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
      setCreateDialogOpen(false);
      setNewRole({ email: '', password: '', role: 'ADMIN_EMPRESA', company_id: '' });
      toast({ title: 'Usuário criado com sucesso!' });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar usuário',
        description: error.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/user-roles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
      setDeleteDialogOpen(false);
      setSelectedRole(null);
      toast({ title: 'Permissão removida!' });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao remover permissão',
        description: error.message,
      });
    },
  });

  const roleLabels: Record<AppRole, string> = {
    SUPER_ADMIN: 'Super Admin',
    ADMIN_EMPRESA: 'Admin Empresa',
    COLABORADOR: 'Colaborador',
  };

  const columns: Column<UserRoleWithDetails>[] = [
    {
      key: 'user_id',
      header: 'ID do Usuário',
      render: (item) => (
        <span className="font-mono text-xs">{item.user_id.slice(0, 8)}...</span>
      ),
    },
    {
      key: 'role',
      header: 'Papel',
      render: (item) => (
        <Badge variant={item.role === 'SUPER_ADMIN' ? 'default' : 'secondary'}>
          {roleLabels[item.role]}
        </Badge>
      ),
    },
    {
      key: 'company_name',
      header: 'Empresa',
      render: (item) => item.company_name || '-',
    },
    {
      key: 'created_at',
      header: 'Criado em',
      render: (item) => new Date(item.created_at).toLocaleDateString('pt-BR'),
    },
    {
      key: 'actions',
      header: 'Ações',
      render: (item) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem
              onClick={() => {
                setSelectedRole(item);
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

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRole.email || !newRole.password) return;
    if (newRole.role !== 'SUPER_ADMIN' && !newRole.company_id) {
      toast({
        variant: 'destructive',
        title: 'Selecione uma empresa',
        description: 'Admin Empresa e Colaborador precisam estar vinculados a uma empresa.',
      });
      return;
    }
    createMutation.mutate(newRole);
  };

  return (
    <SuperAdminLayout title="Usuários" description="Gerencie usuários e permissões">
      <div className="mb-6 flex justify-end">
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreateUser}>
              <DialogHeader>
                <DialogTitle>Criar Novo Usuário</DialogTitle>
                <DialogDescription>
                  Crie um novo usuário e defina suas permissões.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newRole.email}
                    onChange={(e) => setNewRole({ ...newRole, email: e.target.value })}
                    placeholder="usuario@email.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newRole.password}
                    onChange={(e) => setNewRole({ ...newRole, password: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Papel</Label>
                  <Select
                    value={newRole.role}
                    onValueChange={(value: AppRole) => setNewRole({ ...newRole, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                      <SelectItem value="ADMIN_EMPRESA">Admin Empresa</SelectItem>
                      <SelectItem value="COLABORADOR">Colaborador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newRole.role !== 'SUPER_ADMIN' && (
                  <div className="space-y-2">
                    <Label htmlFor="company">Empresa</Label>
                    <Select
                      value={newRole.company_id}
                      onValueChange={(value) => setNewRole({ ...newRole, company_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma empresa" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Criando...' : 'Criar Usuário'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        data={userRoles}
        columns={columns}
        loading={isLoading}
        searchPlaceholder="Buscar usuários..."
        emptyMessage="Nenhum usuário cadastrado"
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Remover Permissão"
        description="Tem certeza que deseja remover esta permissão? O usuário perderá acesso."
        confirmLabel="Remover"
        variant="destructive"
        onConfirm={() => selectedRole && deleteMutation.mutate(selectedRole.id)}
        loading={deleteMutation.isPending}
      />
    </SuperAdminLayout>
  );
}
