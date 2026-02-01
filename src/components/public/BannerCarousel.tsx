import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Banner {
  id: string;
  image_url: string;
  redirect_url: string | null;
  display_order: number;
}

interface BannerCarouselProps {
  banners: Banner[];
  className?: string;
}

export function BannerCarousel({ banners, className }: BannerCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const sortedBanners = [...banners].sort((a, b) => a.display_order - b.display_order);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % sortedBanners.length);
  }, [sortedBanners.length]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + sortedBanners.length) % sortedBanners.length);
  }, [sortedBanners.length]);

  // Auto-advance every 5 seconds
  useEffect(() => {
    if (sortedBanners.length <= 1 || isHovered) return;
    
    const interval = setInterval(goToNext, 5000);
    return () => clearInterval(interval);
  }, [sortedBanners.length, isHovered, goToNext]);

  if (sortedBanners.length === 0) return null;

  const handleBannerClick = (redirectUrl: string | null) => {
    if (redirectUrl) {
      window.open(redirectUrl, '_blank');
    }
  };

  return (
    <div 
      className={cn('relative overflow-hidden rounded-xl', className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Banners Container */}
      <div
        className="flex transition-transform duration-500 ease-in-out"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {sortedBanners.map((banner) => (
          <div
            key={banner.id}
            className={cn(
              'min-w-full aspect-[21/9] md:aspect-[3/1] relative',
              banner.redirect_url && 'cursor-pointer'
            )}
            onClick={() => handleBannerClick(banner.redirect_url)}
          >
            <img
              src={banner.image_url}
              alt="Banner"
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>

      {/* Navigation Arrows */}
      {sortedBanners.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white rounded-full"
            onClick={(e) => {
              e.stopPropagation();
              goToPrev();
            }}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white rounded-full"
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </>
      )}

      {/* Dots Indicator */}
      {sortedBanners.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {sortedBanners.map((_, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(idx);
              }}
              className={cn(
                'w-2 h-2 rounded-full transition-all',
                idx === currentIndex ? 'bg-white w-6' : 'bg-white/50'
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
