import { useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ImagePlus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  companyId: string;
  folder: string;
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  aspectRatio?: string;
  className?: string;
}

export function ImageUpload({
  companyId,
  folder,
  value,
  onChange,
  label = 'Imagem',
  aspectRatio = 'aspect-video',
  className,
}: ImageUploadProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const publicUrl = await api.upload(file, companyId, folder);
      onChange(publicUrl);
      toast({ title: 'Imagem enviada!' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro ao enviar imagem', description: error.message });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <Label>{label}</Label>
      {value ? (
        <div className={cn('relative rounded-lg overflow-hidden border', aspectRatio)}>
          <img
            src={value}
            alt="Preview"
            className="w-full h-full object-cover"
          />
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="absolute top-2 right-2"
            onClick={() => onChange(null)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <label className={cn(
          'flex flex-col items-center justify-center border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors',
          aspectRatio
        )}>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
            disabled={uploading}
          />
          {uploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : (
            <>
              <ImagePlus className="h-8 w-8 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">Clique para fazer upload</span>
            </>
          )}
        </label>
      )}
    </div>
  );
}
