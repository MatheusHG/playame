import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Affiliate } from '@/types/affiliate.types';
import { Users } from 'lucide-react';

interface AffiliateSelectorProps {
  companyId: string;
  value?: string;
  onChange: (affiliateId: string | undefined) => void;
}

export function AffiliateSelector({ companyId, value, onChange }: AffiliateSelectorProps) {
  const [selectedManager, setSelectedManager] = useState<string | undefined>();
  const [selectedCambista, setSelectedCambista] = useState<string | undefined>();

  // Fetch active affiliates
  const { data: affiliates = [] } = useQuery({
    queryKey: ['public-affiliates', companyId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('affiliates')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('name');

      if (error) throw error;
      return data as Affiliate[];
    },
    enabled: !!companyId,
  });

  const managers = affiliates.filter(a => a.type === 'manager');
  const cambistas = selectedManager 
    ? affiliates.filter(a => a.type === 'cambista' && a.parent_affiliate_id === selectedManager)
    : [];

  // Update parent when selections change
  useEffect(() => {
    // Priority: cambista > manager
    if (selectedCambista) {
      onChange(selectedCambista);
    } else if (selectedManager) {
      onChange(selectedManager);
    } else {
      onChange(undefined);
    }
  }, [selectedManager, selectedCambista, onChange]);

  // Reset cambista when manager changes
  useEffect(() => {
    setSelectedCambista(undefined);
  }, [selectedManager]);

  if (managers.length === 0) {
    return null; // No affiliates available
  }

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Users className="h-4 w-4" />
        Indicação (opcional)
      </div>
      
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="manager">Gerente</Label>
          <Select value={selectedManager} onValueChange={setSelectedManager}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione (opcional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Nenhum</SelectItem>
              {managers.map((manager) => (
                <SelectItem key={manager.id} value={manager.id}>
                  {manager.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedManager && selectedManager !== '__none__' && cambistas.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="cambista">Cambista</Label>
            <Select value={selectedCambista} onValueChange={setSelectedCambista}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nenhum</SelectItem>
                {cambistas.map((cambista) => (
                  <SelectItem key={cambista.id} value={cambista.id}>
                    {cambista.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Se você foi indicado por um vendedor, selecione-o acima para que ele receba a comissão.
      </p>
    </div>
  );
}
