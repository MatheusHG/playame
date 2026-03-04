import { useState, useEffect } from 'react';
import { X, MessageCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CommunityChannelBannerProps {
  communityName: string;
  communityUrl: string;
  companySlug: string;
  primaryColor?: string;
  /** Se true, não mostra o botão X (banner fixo) */
  permanent?: boolean;
}

const COOKIE_PREFIX = 'community_dismissed_';
const THREE_DAYS_SECONDS = 259200; // 3 * 24 * 60 * 60

function isDismissed(slug: string): boolean {
  return document.cookie.includes(`${COOKIE_PREFIX}${slug}=true`);
}

function setDismissedCookie(slug: string) {
  document.cookie = `${COOKIE_PREFIX}${slug}=true; path=/; max-age=${THREE_DAYS_SECONDS}`;
}

export function CommunityChannelBanner({
  communityName,
  communityUrl,
  companySlug,
  primaryColor = '#3B82F6',
  permanent = false,
}: CommunityChannelBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (permanent) {
      setVisible(true);
    } else {
      setVisible(!isDismissed(companySlug));
    }
  }, [companySlug, permanent]);

  if (!visible) return null;

  const handleDismiss = () => {
    setDismissedCookie(companySlug);
    setVisible(false);
  };

  return (
    <div
      className="w-full py-2.5 px-4"
      style={{ backgroundColor: primaryColor }}
    >
      <div className="container mx-auto flex items-center justify-between gap-3">
        <a
          href={communityUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-white text-sm hover:opacity-90 transition-opacity min-w-0 flex-1"
        >
          <MessageCircle className="h-4 w-4 shrink-0" />
          <span className="truncate">
            Participe do nosso canal do <strong>{communityName}</strong>!
          </span>
          <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" />
        </a>

        {!permanent && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-white hover:bg-white/20 shrink-0"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
