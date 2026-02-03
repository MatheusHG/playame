import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AffiliateLayout } from '@/components/layouts/AffiliateLayout';
import { useAffiliate } from '@/contexts/AffiliateContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LoadingState } from '@/components/shared/LoadingState';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Users,
  Search,
  User,
  Phone,
  DollarSign,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';

export default function Equipe() {
  const { slug } = useParams<{ slug: string }>();
  const { affiliate, hasPermission } = useAffiliate();
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch team members (cambistas under this manager)
  const { data: team, isLoading } = useQuery({
    queryKey: ['affiliate-team', affiliate?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('affiliates')
        .select('*')
        .eq('parent_affiliate_id', affiliate?.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!affiliate?.id && affiliate?.type === 'manager' && hasPermission('can_manage_cambistas'),
  });

  // Fetch team sales stats
  const { data: teamStats } = useQuery({
    queryKey: ['affiliate-team-stats', affiliate?.id],
    queryFn: async () => {
      if (!team?.length) return {};

      const teamIds = team.map((m: any) => m.id);
      
      const { data, error } = await (supabase as any)
        .from('tickets')
        .select('affiliate_id, status')
        .in('affiliate_id', teamIds);

      if (error) throw error;

      const stats: Record<string, { total: number; confirmed: number }> = {};
      data?.forEach((ticket: any) => {
        if (!stats[ticket.affiliate_id]) {
          stats[ticket.affiliate_id] = { total: 0, confirmed: 0 };
        }
        stats[ticket.affiliate_id].total++;
        if (ticket.status === 'active') {
          stats[ticket.affiliate_id].confirmed++;
        }
      });

      return stats;
    },
    enabled: !!team?.length,
  });

  const filteredTeam = team?.filter((member: any) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      member.name?.toLowerCase().includes(search) ||
      member.email?.toLowerCase().includes(search) ||
      member.phone?.includes(search)
    );
  });

  // Calculate totals
  const totals = {
    active: team?.filter((m: any) => m.is_active && !m.is_sales_paused).length || 0,
    paused: team?.filter((m: any) => m.is_sales_paused).length || 0,
    inactive: team?.filter((m: any) => !m.is_active).length || 0,
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

  return (
    <AffiliateLayout title="Minha Equipe" description="Gerencie seus cambistas">
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

        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email ou telefone..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Team Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Cambistas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Comissão</TableHead>
                  <TableHead>Vendas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Desde</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeam?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum cambista encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTeam?.map((member: any) => {
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
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AffiliateLayout>
  );
}
