import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AffiliateLayout } from '@/components/layouts/AffiliateLayout';
import { useAffiliate } from '@/contexts/AffiliateContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LoadingState } from '@/components/shared/LoadingState';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Users,
  Search,
  User,
  Phone,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Plus,
  MoreHorizontal,
  Pencil,
  Pause,
  Play,
  Trash2,
  KeyRound,
  Loader2,
} from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  type: string;
  link_code: string;
  commission_percent: number;
  is_sales_paused: boolean;
  is_active: boolean;
  created_at: string;
  user_id: string | null;
  permission_profile: { id: string; name: string } | null;
}

interface MemberFormData {
  name: string;
  email: string;
  phone: string;
  commission_percent: number;
  permission_profile_id: string;
}

const emptyForm: MemberFormData = {
  name: '',
  email: '',
  phone: '',
  commission_percent: 0,
  permission_profile_id: '',
};

export default function Equipe() {
  const { affiliate, hasPermission } = useAffiliate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [formData, setFormData] = useState<MemberFormData>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<TeamMember | null>(null);
  const [createUserTarget, setCreateUserTarget] = useState<TeamMember | null>(null);
  const [createUserData, setCreateUserData] = useState({ email: '', password: '' });

  // Fetch team members (cambistas under this manager)
  const { data: team, isLoading } = useQuery({
    queryKey: ['affiliate-team', affiliate?.id],
    queryFn: () => api.get<TeamMember[]>(`/affiliates/${affiliate?.id}/team`),
    enabled: !!affiliate?.id && affiliate?.type === 'manager' && hasPermission('can_manage_cambistas'),
  });

  // Fetch team sales stats
  const { data: teamStats } = useQuery({
    queryKey: ['affiliate-team-stats', affiliate?.id],
    queryFn: () => api.get<Record<string, { total: number; confirmed: number }>>(`/affiliates/${affiliate?.id}/team-stats`),
    enabled: !!team?.length,
  });

  // Fetch permission profiles
  const { data: profiles } = useQuery({
    queryKey: ['permission-profiles', affiliate?.company_id],
    queryFn: () => api.get<{ id: string; name: string }[]>(`/permission-profiles/${affiliate?.company_id}`),
    enabled: !!affiliate?.company_id,
  });

  const invalidateTeam = () => {
    queryClient.invalidateQueries({ queryKey: ['affiliate-team', affiliate?.id] });
    queryClient.invalidateQueries({ queryKey: ['affiliate-team-stats', affiliate?.id] });
  };

  // Create cambista
  const createMutation = useMutation({
    mutationFn: (data: MemberFormData) =>
      api.post(`/affiliates/${affiliate?.id}/team`, {
        name: data.name,
        email: data.email || undefined,
        phone: data.phone || undefined,
        commission_percent: data.commission_percent,
        permission_profile_id: data.permission_profile_id || undefined,
      }),
    onSuccess: () => {
      invalidateTeam();
      setFormOpen(false);
      setFormData(emptyForm);
      toast({ title: 'Operador criado', description: 'O operador foi cadastrado com sucesso.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Erro ao criar operador', description: err.message, variant: 'destructive' });
    },
  });

  // Update cambista
  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: MemberFormData & { id: string }) =>
      api.patch(`/affiliates/${affiliate?.id}/team/${id}`, {
        name: data.name,
        email: data.email || undefined,
        phone: data.phone || undefined,
        commission_percent: data.commission_percent,
        permission_profile_id: data.permission_profile_id || undefined,
      }),
    onSuccess: () => {
      invalidateTeam();
      setFormOpen(false);
      setEditingMember(null);
      setFormData(emptyForm);
      toast({ title: 'Operador atualizado', description: 'As informações foram atualizadas.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Erro ao atualizar', description: err.message, variant: 'destructive' });
    },
  });

  // Toggle pause
  const pauseMutation = useMutation({
    mutationFn: (memberId: string) =>
      api.patch(`/affiliates/${affiliate?.id}/team/${memberId}/pause`),
    onSuccess: () => {
      invalidateTeam();
      toast({ title: 'Status atualizado' });
    },
    onError: (err: Error) => {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    },
  });

  // Delete cambista
  const deleteMutation = useMutation({
    mutationFn: (memberId: string) =>
      api.delete(`/affiliates/${affiliate?.id}/team/${memberId}`),
    onSuccess: () => {
      invalidateTeam();
      setDeleteTarget(null);
      toast({ title: 'Operador removido' });
    },
    onError: (err: Error) => {
      toast({ title: 'Erro ao remover', description: err.message, variant: 'destructive' });
    },
  });

  // Create user account
  const createUserMutation = useMutation({
    mutationFn: ({ memberId, email, password }: { memberId: string; email: string; password: string }) =>
      api.post(`/affiliates/${affiliate?.id}/team/${memberId}/create-user`, { email, password }),
    onSuccess: () => {
      invalidateTeam();
      setCreateUserTarget(null);
      setCreateUserData({ email: '', password: '' });
      toast({ title: 'Conta criada', description: 'O operador agora pode fazer login.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Erro ao criar conta', description: err.message, variant: 'destructive' });
    },
  });

  const openCreate = () => {
    setEditingMember(null);
    setFormData(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (member: TeamMember) => {
    setEditingMember(member);
    setFormData({
      name: member.name,
      email: member.email || '',
      phone: member.phone || '',
      commission_percent: Number(member.commission_percent),
      permission_profile_id: member.permission_profile?.id || '',
    });
    setFormOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }
    if (editingMember) {
      updateMutation.mutate({ ...formData, id: editingMember.id });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredTeam = team?.filter((member) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      member.name?.toLowerCase().includes(search) ||
      member.email?.toLowerCase().includes(search) ||
      member.phone?.includes(search)
    );
  });

  const totals = {
    active: team?.filter((m) => m.is_active && !m.is_sales_paused).length || 0,
    paused: team?.filter((m) => m.is_sales_paused).length || 0,
    inactive: team?.filter((m) => !m.is_active).length || 0,
  };

  if (affiliate?.type !== 'manager' || !hasPermission('can_manage_cambistas')) {
    return (
      <AffiliateLayout title="Minha Equipe">
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold">Acesso Negado</h2>
            <p className="text-muted-foreground">
              Apenas gerentes podem acessar a gestão de equipe.
            </p>
          </div>
        </div>
      </AffiliateLayout>
    );
  }

  if (isLoading) {
    return (
      <AffiliateLayout title="Minha Equipe">
        <LoadingState message="Carregando equipe..." />
      </AffiliateLayout>
    );
  }

  const isMutating = createMutation.isPending || updateMutation.isPending;

  return (
    <AffiliateLayout title="Minha Equipe" description="Gerencie seus operadores">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ativos</p>
                  <p className="text-2xl font-bold text-green-600">{totals.active}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pausados</p>
                  <p className="text-2xl font-bold text-amber-600">{totals.paused}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <XCircle className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Inativos</p>
                  <p className="text-2xl font-bold text-gray-600">{totals.inactive}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search + Add Button */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email ou telefone..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Operador
          </Button>
        </div>

        {/* Team Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Operadores
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Comissão</TableHead>
                  <TableHead>Vendas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Desde</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeam?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum operador encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTeam?.map((member) => {
                    const stats = teamStats?.[member.id] || { total: 0, confirmed: 0 };
                    const isPaused = member.is_sales_paused;
                    const isActive = member.is_active;

                    return (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{member.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">
                                {member.link_code}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {member.email && (
                              <p className="text-sm">{member.email}</p>
                            )}
                            {member.phone && (
                              <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {member.phone}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {member.commission_percent}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <span className="font-medium">{stats.confirmed}</span>
                            <span className="text-muted-foreground"> / {stats.total}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {!isActive ? (
                            <Badge variant="outline">Inativo</Badge>
                          ) : isPaused ? (
                            <Badge variant="secondary">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Pausado
                            </Badge>
                          ) : (
                            <Badge variant="default">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Ativo
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(member.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(member)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              {isActive && (
                                <DropdownMenuItem onClick={() => pauseMutation.mutate(member.id)}>
                                  {isPaused ? (
                                    <>
                                      <Play className="h-4 w-4 mr-2" />
                                      Reativar Vendas
                                    </>
                                  ) : (
                                    <>
                                      <Pause className="h-4 w-4 mr-2" />
                                      Pausar Vendas
                                    </>
                                  )}
                                </DropdownMenuItem>
                              )}
                              {!member.user_id && (
                                <DropdownMenuItem onClick={() => {
                                  setCreateUserTarget(member);
                                  setCreateUserData({ email: member.email || '', password: '' });
                                }}>
                                  <KeyRound className="h-4 w-4 mr-2" />
                                  Criar Login
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleteTarget(member)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remover
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={(open) => {
        if (!open) { setFormOpen(false); setEditingMember(null); setFormData(emptyForm); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMember ? 'Editar Operador' : 'Novo Operador'}</DialogTitle>
            <DialogDescription>
              {editingMember ? 'Atualize as informações do operador.' : 'Cadastre um novo operador na sua equipe.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nome do operador"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="commission">Comissão (%) - sobre a cartela</Label>
                <Input
                  id="commission"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formData.commission_percent}
                  onChange={(e) => setFormData(prev => ({ ...prev, commission_percent: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Perfil de Permissão</Label>
                <Select
                  value={formData.permission_profile_id}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, permission_profile_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={isMutating}>
              {isMutating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingMember ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover operador?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{deleteTarget?.name}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create User Account Dialog */}
      <Dialog open={!!createUserTarget} onOpenChange={(open) => {
        if (!open) { setCreateUserTarget(null); setCreateUserData({ email: '', password: '' }); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Login</DialogTitle>
            <DialogDescription>
              Crie uma conta de acesso para <strong>{createUserTarget?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="user-email">Email *</Label>
              <Input
                id="user-email"
                type="email"
                value={createUserData.email}
                onChange={(e) => setCreateUserData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-password">Senha *</Label>
              <Input
                id="user-password"
                type="password"
                value={createUserData.password}
                onChange={(e) => setCreateUserData(prev => ({ ...prev, password: e.target.value }))}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateUserTarget(null)}>Cancelar</Button>
            <Button
              onClick={() => createUserTarget && createUserMutation.mutate({
                memberId: createUserTarget.id,
                email: createUserData.email,
                password: createUserData.password,
              })}
              disabled={createUserMutation.isPending || !createUserData.email || !createUserData.password}
            >
              {createUserMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Conta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AffiliateLayout>
  );
}
