import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { AffiliateForm, AffiliateFormData } from './AffiliateForm';
import { useAffiliates } from '@/hooks/useAffiliates';
import { Affiliate } from '@/types/affiliate.types';
import { 
  Plus, 
  MoreHorizontal, 
  Pencil, 
  Trash2, 
  Users, 
  UserPlus,
  Percent,
  Phone,
  Mail,
  Eye,
} from 'lucide-react';

interface AffiliatesListProps {
  companyId: string;
}

export function AffiliatesList({ companyId }: AffiliatesListProps) {
  const { slug } = useParams<{ slug: string }>();
  const {
    managers,
    getCambistas,
    isLoading,
    createAffiliate,
    updateAffiliate,
    deleteAffiliate,
  } = useAffiliates(companyId);

  const [formOpen, setFormOpen] = useState(false);
  const [editingAffiliate, setEditingAffiliate] = useState<Affiliate | undefined>();
  const [newAffiliateType, setNewAffiliateType] = useState<'manager' | 'cambista'>('manager');
  const [parentManagerId, setParentManagerId] = useState<string | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [affiliateToDelete, setAffiliateToDelete] = useState<Affiliate | null>(null);

  const handleOpenNewManager = () => {
    setEditingAffiliate(undefined);
    setNewAffiliateType('manager');
    setParentManagerId(undefined);
    setFormOpen(true);
  };

  const handleOpenNewCambista = (managerId: string) => {
    setEditingAffiliate(undefined);
    setNewAffiliateType('cambista');
    setParentManagerId(managerId);
    setFormOpen(true);
  };

  const handleEdit = (affiliate: Affiliate) => {
    setEditingAffiliate(affiliate);
    setNewAffiliateType(affiliate.type);
    setFormOpen(true);
  };

  const handleDelete = (affiliate: Affiliate) => {
    setAffiliateToDelete(affiliate);
    setDeleteDialogOpen(true);
  };

  const handleFormSubmit = (data: AffiliateFormData) => {
    if (editingAffiliate) {
      updateAffiliate.mutate(
        {
          id: editingAffiliate.id,
          name: data.name,
          phone: data.phone || undefined,
          email: data.email || undefined,
          commission_percent: data.commission_percent,
        },
        { onSuccess: () => setFormOpen(false) }
      );
    } else {
      createAffiliate.mutate(
        {
          company_id: companyId,
          type: newAffiliateType,
          name: data.name,
          phone: data.phone || undefined,
          email: data.email || undefined,
          commission_percent: data.commission_percent,
          parent_affiliate_id: parentManagerId,
        },
        { onSuccess: () => setFormOpen(false) }
      );
    }
  };

  const confirmDelete = () => {
    if (affiliateToDelete) {
      deleteAffiliate.mutate(affiliateToDelete.id, {
        onSuccess: () => {
          setDeleteDialogOpen(false);
          setAffiliateToDelete(null);
        },
      });
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Gerentes e Cambistas</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie sua rede de afiliados e configure comissões
          </p>
        </div>
        <Button onClick={handleOpenNewManager}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Gerente
        </Button>
      </div>

      {managers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h4 className="font-semibold mb-2">Nenhum gerente cadastrado</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Comece cadastrando um gerente para sua rede de afiliados.
            </p>
            <Button onClick={handleOpenNewManager}>
              <Plus className="h-4 w-4 mr-2" />
              Cadastrar Gerente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {managers.map((manager) => {
            const cambistas = getCambistas(manager.id);
            
            return (
              <AccordionItem key={manager.id} value={manager.id} className="border rounded-lg">
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div className="text-left">
                        <div className="font-medium flex items-center gap-2">
                          {manager.name}
                          {!manager.is_active && (
                            <Badge variant="secondary">Inativo</Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <Percent className="h-3 w-3" />
                          {manager.commission_percent}% de comissão
                          <span className="mx-1">•</span>
                          {cambistas.length} cambista{cambistas.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to={`/empresa/${slug}/afiliados/${manager.id}`}>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver Detalhes
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleOpenNewCambista(manager.id)}>
                          <UserPlus className="h-4 w-4 mr-2" />
                          Adicionar Cambista
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEdit(manager)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDelete(manager)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remover
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="ml-12 space-y-3">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {manager.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {manager.phone}
                        </span>
                      )}
                      {manager.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {manager.email}
                        </span>
                      )}
                    </div>

                    <div className="border-t pt-3">
                      <div className="flex justify-between items-center mb-2">
                        <h5 className="text-sm font-medium">Cambistas</h5>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleOpenNewCambista(manager.id)}
                        >
                          <UserPlus className="h-3 w-3 mr-1" />
                          Adicionar
                        </Button>
                      </div>

                      {cambistas.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">
                          Nenhum cambista cadastrado para este gerente.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {cambistas.map((cambista) => (
                            <div
                              key={cambista.id}
                              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                            >
                              <div>
                                <div className="font-medium flex items-center gap-2">
                                  {cambista.name}
                                  {!cambista.is_active && (
                                    <Badge variant="secondary" className="text-xs">
                                      Inativo
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {cambista.commission_percent}% sobre o gerente
                                  {cambista.phone && ` • ${cambista.phone}`}
                                </div>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem asChild>
                                    <Link to={`/empresa/${slug}/afiliados/${cambista.id}`}>
                                      <Eye className="h-4 w-4 mr-2" />
                                      Ver Detalhes
                                    </Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleEdit(cambista)}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleDelete(cambista)}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Remover
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      <AffiliateForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleFormSubmit}
        affiliate={editingAffiliate}
        managers={managers}
        type={newAffiliateType}
        loading={createAffiliate.isPending || updateAffiliate.isPending}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Remover Afiliado"
        description={`Tem certeza que deseja remover ${affiliateToDelete?.name}? Esta ação não pode ser desfeita.`}
        confirmLabel="Remover"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </div>
  );
}
