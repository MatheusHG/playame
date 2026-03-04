import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Plus, GripVertical } from 'lucide-react';
import { ImageUpload } from '@/components/empresa/ImageUpload';

interface SocialLink {
    id: string;
    name: string;
    image_url: string;
    redirect_url: string;
}

interface MenuLink {
    id: string;
    name: string;
    redirect_url: string;
}

interface FooterSettingsManagerProps {
    socialLinks: SocialLink[];
    menus: MenuLink[];
    onChange: (data: { footer_social_links: SocialLink[]; footer_menus: MenuLink[] }) => void;
    companyId: string;
}

export function FooterSettingsManager({
    socialLinks = [],
    menus = [],
    onChange,
    companyId,
}: FooterSettingsManagerProps) {
    const [localSocials, setLocalSocials] = useState<SocialLink[]>(
        Array.isArray(socialLinks) ? socialLinks : []
    );
    const [localMenus, setLocalMenus] = useState<MenuLink[]>(
        Array.isArray(menus) ? menus : []
    );

    const triggerChange = (newSocials: SocialLink[], newMenus: MenuLink[]) => {
        onChange({
            footer_social_links: newSocials,
            footer_menus: newMenus,
        });
    };

    // Social Links Handlers
    const addSocial = () => {
        const newSocials = [
            ...localSocials,
            { id: Date.now().toString(), name: '', image_url: '', redirect_url: '' },
        ];
        setLocalSocials(newSocials);
        triggerChange(newSocials, localMenus);
    };

    const updateSocial = (id: string, field: keyof SocialLink, value: string) => {
        const newSocials = localSocials.map((s) => (s.id === id ? { ...s, [field]: value } : s));
        setLocalSocials(newSocials);
        triggerChange(newSocials, localMenus);
    };

    const removeSocial = (id: string) => {
        const newSocials = localSocials.filter((s) => s.id !== id);
        setLocalSocials(newSocials);
        triggerChange(newSocials, localMenus);
    };

    // Menu Handlers
    const addMenu = () => {
        const newMenus = [
            ...localMenus,
            { id: Date.now().toString(), name: '', redirect_url: '' },
        ];
        setLocalMenus(newMenus);
        triggerChange(localSocials, newMenus);
    };

    const updateMenu = (id: string, field: keyof MenuLink, value: string) => {
        const newMenus = localMenus.map((m) => (m.id === id ? { ...m, [field]: value } : m));
        setLocalMenus(newMenus);
        triggerChange(localSocials, newMenus);
    };

    const removeMenu = (id: string) => {
        const newMenus = localMenus.filter((m) => m.id !== id);
        setLocalMenus(newMenus);
        triggerChange(localSocials, newMenus);
    };

    return (
        <div className="space-y-6">
            {/* Social Networks */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Redes Sociais do Rodapé</CardTitle>
                            <CardDescription>Adicione links e ícones das suas redes sociais.</CardDescription>
                        </div>
                        <Button type="button" onClick={addSocial} variant="outline" size="sm">
                            <Plus className="mr-2 h-4 w-4" />
                            Adicionar Rede
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {localSocials.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                            Nenhuma rede social adicionada.
                        </p>
                    )}

                    {localSocials.map((social) => (
                        <div key={social.id} className="flex gap-4 p-4 border rounded-lg bg-card items-start">
                            <div className="pt-2">
                                <GripVertical className="h-5 w-5 text-muted-foreground" />
                            </div>

                            <div className="grid gap-4 flex-1 md:grid-cols-3">
                                <div className="space-y-2">
                                    <Label>Nome</Label>
                                    <Input
                                        placeholder="Ex: Instagram"
                                        value={social.name}
                                        onChange={(e) => updateSocial(social.id, 'name', e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Ícone (URL ou Upload)</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="https://...icone.png"
                                            value={social.image_url}
                                            onChange={(e) => updateSocial(social.id, 'image_url', e.target.value)}
                                        />
                                        {/* Reuse image upload slightly modified if needed or just simple text input for simplicity */}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Link de Redirecionamento</Label>
                                    <Input
                                        placeholder="https://instagram.com/sua_pagina"
                                        value={social.redirect_url}
                                        onChange={(e) => updateSocial(social.id, 'redirect_url', e.target.value)}
                                    />
                                </div>
                            </div>

                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-destructive mt-[26px]"
                                onClick={() => removeSocial(social.id)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </CardContent>
            </Card>

            {/* Custom Menus */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Menus Adicionais</CardTitle>
                            <CardDescription>Adicione links úteis no rodapé (Ex: Termos, Contato).</CardDescription>
                        </div>
                        <Button type="button" onClick={addMenu} variant="outline" size="sm">
                            <Plus className="mr-2 h-4 w-4" />
                            Adicionar Menu
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {localMenus.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                            Nenhum menu adicionado.
                        </p>
                    )}

                    {localMenus.map((menu) => (
                        <div key={menu.id} className="flex gap-4 p-4 border rounded-lg bg-card items-start">
                            <div className="pt-2">
                                <GripVertical className="h-5 w-5 text-muted-foreground" />
                            </div>

                            <div className="grid gap-4 flex-1 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Nome do Menu</Label>
                                    <Input
                                        placeholder="Ex: Termos de Uso"
                                        value={menu.name}
                                        onChange={(e) => updateMenu(menu.id, 'name', e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Link de Redirecionamento</Label>
                                    <Input
                                        placeholder="/termos ou https://..."
                                        value={menu.redirect_url}
                                        onChange={(e) => updateMenu(menu.id, 'redirect_url', e.target.value)}
                                    />
                                </div>
                            </div>

                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-destructive mt-[26px]"
                                onClick={() => removeMenu(menu.id)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
