import { Link } from 'react-router-dom';
import { useCompanyBranding } from '@/contexts/TenantContext';

export function PublicFooter() {
    const company = useCompanyBranding();

    if (!company) return null;

    const socialLinks = Array.isArray(company.footer_social_links) ? company.footer_social_links : [];
    const menus = Array.isArray(company.footer_menus) ? company.footer_menus : [];

    // Se não houver configurações, não renderiza nada extra ou renderiza um fallback minimalista
    if (socialLinks.length === 0 && menus.length === 0) {
        return (
            <footer className="border-t border-zinc-900 bg-zinc-950 py-6 mt-12 text-zinc-400">
                <div className="container mx-auto px-4 text-center text-sm">
                    &copy; {new Date().getFullYear()} {company.name}. Todos os direitos reservados.
                </div>
            </footer>
        );
    }

    return (
        <footer className="border-t border-zinc-900 bg-zinc-950 mt-12 relative overflow-hidden text-zinc-300">
            {/* Decoração de Fundo Dinâmica */}
            <div
                className="absolute top-0 left-0 w-full h-1 opacity-20"
                style={{
                    background: `linear-gradient(90deg, ${company.primary_color}, ${company.secondary_color})`
                }}
            />

            <div className="container mx-auto px-4 py-12 md:py-16">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">

                    {/* Brand Info */}
                    <div className="col-span-1 lg:col-span-2 space-y-4">
                        <Link to="/" className="inline-flex items-center gap-3 hover:opacity-80 transition-opacity">
                            {company.logo_url ? (
                                <img
                                    src={company.logo_url}
                                    alt={company.name}
                                    className="h-10 w-auto object-contain brightness-0 invert"
                                />
                            ) : (
                                <div
                                    className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                                    style={{ backgroundColor: company.primary_color }}
                                >
                                    {company.name.charAt(0).toUpperCase()}
                                </div>
                            )}
                            <span className="font-bold text-xl text-white">{company.name}</span>
                        </Link>
                        <p className="text-zinc-400 text-sm max-w-sm">
                            Participando das nossas campanhas, você concorre a prêmios incríveis com total segurança e transparência.
                        </p>
                    </div>

                    {/* Menus Opcionais */}
                    {menus.length > 0 && (
                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg text-white">Links Úteis</h3>
                            <ul className="space-y-2">
                                {menus.map((menu: any) => (
                                    <li key={menu.id}>
                                        {menu.redirect_url.startsWith('http') ? (
                                            <a
                                                href={menu.redirect_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-zinc-400 hover:text-white transition-colors text-sm"
                                            >
                                                {menu.name}
                                            </a>
                                        ) : (
                                            <Link
                                                to={menu.redirect_url}
                                                className="text-zinc-400 hover:text-white transition-colors text-sm"
                                            >
                                                {menu.name}
                                            </Link>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Redes Sociais */}
                    {socialLinks.length > 0 && (
                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg text-white">Acompanhe-nos</h3>
                            <div className="flex flex-wrap gap-4">
                                {socialLinks.map((social: any) => (
                                    <a
                                        key={social.id}
                                        href={social.redirect_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="h-10 w-10 rounded-full border border-zinc-800 bg-zinc-900/50 flex items-center justify-center hover:bg-zinc-800 hover:border-zinc-700 hover:scale-110 transition-all shadow-sm text-zinc-300"
                                        title={social.name}
                                        style={{ padding: social.image_url ? '0' : '8px' }}
                                    >
                                        {social.image_url ? (
                                            <img src={social.image_url} alt={social.name} className="w-6 h-6 object-contain" />
                                        ) : (
                                            <span className="text-xs font-bold">{social.name.charAt(0)}</span>
                                        )}
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-12 pt-8 border-t border-zinc-900 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
                    <p>&copy; {new Date().getFullYear()} {company.name}. Todos os direitos reservados.</p>
                    <p>
                        Desenvolvido com <span className="text-red-500">♥</span> pela equipe da plataforma.
                    </p>
                </div>
            </div>
        </footer>
    );
}
