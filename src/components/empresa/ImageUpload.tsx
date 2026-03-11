import { useState } from 'react';
// import { api } from '@/lib/api'; // TODO: descomentar quando S3 estiver configurado
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Link as LinkIcon } from 'lucide-react';
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
  const [urlInput, setUrlInput] = useState(value || '');

  // TODO: descomentar quando S3 estiver configurado
  // const [uploading, setUploading] = useState(false);
  // const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const file = e.target.files?.[0];
  //   if (!file) return;
  //   setUploading(true);
  //   try {
  //     const publicUrl = await api.upload(file, companyId, folder);
  //     onChange(publicUrl);
  //     toast({ title: 'Imagem enviada!' });
  //   } catch (error: any) {
  //     toast({ variant: 'destructive', title: 'Erro ao enviar imagem', description: error.message });
  //   } finally {
  //     setUploading(false);
  //   }
  // };

  const handleUrlSubmit = () => {
    const trimmed = urlInput.trim();
    if (trimmed) {
      onChange(trimmed);
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
            onClick={() => { onChange(null); setUrlInput(''); }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            placeholder="Cole a URL da imagem"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleUrlSubmit(); } }}
          />
          <Button type="button" variant="outline" onClick={handleUrlSubmit} disabled={!urlInput.trim()}>
            <LinkIcon className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
