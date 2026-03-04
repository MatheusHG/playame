import { useState } from 'react';
import { Tag, Flame, Check, Ticket } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface RaffleDiscount {
  id: string;
  raffle_id: string;
  min_quantity: number;
  discount_percent: number;
  is_active: boolean;
}

interface PromotionCombosProps {
  discounts: RaffleDiscount[];
  ticketPrice: number;
  currentQuantity: number;
  onSelectCombo: (quantity: number) => void;
}

export function PromotionCombos({ discounts, ticketPrice, currentQuantity, onSelectCombo }: PromotionCombosProps) {
  const [animatingComboId, setAnimatingComboId] = useState<string | null>(null);
  const [animatingCount, setAnimatingCount] = useState(0);

  const activeDiscounts = discounts
    .filter(d => d.is_active)
    .sort((a, b) => a.min_quantity - b.min_quantity);

  if (activeDiscounts.length === 0) return null;

  const maxDiscount = Math.max(...activeDiscounts.map(d => Number(d.discount_percent)));

  // The discount currently being applied = highest min_quantity that is <= currentQuantity
  const appliedDiscount = [...activeDiscounts]
    .reverse()
    .find(d => currentQuantity >= d.min_quantity);

  // Mark the "popular" one — highest discount or middle one
  const popularIndex = activeDiscounts.length <= 2
    ? activeDiscounts.length - 1
    : Math.floor(activeDiscounts.length / 2);

  const handleComboClick = (discount: RaffleDiscount) => {
    const qty = discount.min_quantity;
    const ticketsToAdd = qty - currentQuantity;

    if (ticketsToAdd > 0) {
      // Trigger ghost animation
      setAnimatingComboId(discount.id);
      setAnimatingCount(Math.min(ticketsToAdd, 5)); // cap visual at 5

      // Fire the actual combo selection after a brief delay for visual feedback
      setTimeout(() => {
        onSelectCombo(qty);
      }, 150);

      // Clear animation after it completes
      setTimeout(() => {
        setAnimatingComboId(null);
        setAnimatingCount(0);
      }, 800);
    } else {
      onSelectCombo(qty);
    }
  };

  return (
    <div className="space-y-3">
      <style>{`
        @keyframes flyToCart {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          50% { opacity: 0.7; transform: translateY(-40px) scale(0.8); }
          100% { opacity: 0; transform: translateY(-80px) scale(0.4); }
        }
      `}</style>

      <div className="flex items-center gap-2">
        <Tag className="h-4 w-4 text-green-600" />
        <span className="font-semibold">Economize nos combos</span>
        <Badge className="bg-green-600 text-white text-xs px-2 py-0.5">
          Até {maxDiscount}% OFF
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {activeDiscounts.map((discount, index) => {
          const pct = Number(discount.discount_percent);
          const qty = discount.min_quantity;
          const originalTotal = ticketPrice * qty;
          const discountedTotal = originalTotal * (1 - pct / 100);
          const discountedUnit = ticketPrice * (1 - pct / 100);
          const savings = originalTotal - discountedTotal;
          const isApplied = appliedDiscount?.id === discount.id;
          const isExceeded = !isApplied && currentQuantity >= qty;
          const isPopular = index === popularIndex;
          const isAnimating = animatingComboId === discount.id;

          return (
            <button
              key={discount.id}
              onClick={() => handleComboClick(discount)}
              className={cn(
                'relative flex flex-col rounded-2xl border-2 p-4 text-left transition-all overflow-hidden',
                isApplied
                  ? 'border-green-500 bg-green-50 dark:bg-green-950/30 shadow-md ring-1 ring-green-500/20'
                  : isExceeded
                    ? 'border-muted/60 bg-muted/20 opacity-60'
                    : 'border-muted hover:border-primary/50 hover:shadow-sm bg-card',
                isPopular && !isApplied && !isExceeded && 'border-primary/60 shadow-sm'
              )}
            >
              {/* Popular badge */}
              {isPopular && !isExceeded && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground text-xs px-3 py-0.5 gap-1 shadow-sm">
                    <Flame className="h-3 w-3" />
                    POPULAR
                  </Badge>
                </div>
              )}

              {/* Applied check */}
              {isApplied && (
                <div className="absolute top-3 right-3">
                  <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                </div>
              )}

              {/* Ghost tickets animation */}
              {isAnimating && (
                <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center gap-2">
                  {Array.from({ length: animatingCount }, (_, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 bg-primary text-primary-foreground rounded-lg px-2.5 py-1.5 text-xs font-bold shadow-lg"
                      style={{
                        animation: 'flyToCart 650ms ease-out forwards',
                        animationDelay: `${i * 100}ms`,
                        opacity: 0,
                        animationFillMode: 'forwards',
                      }}
                    >
                      <Ticket className="h-3.5 w-3.5" />
                      +1
                    </span>
                  ))}
                </div>
              )}

              {/* Discount badge */}
              <div className="flex items-center gap-2 mb-2">
                <Badge
                  className={cn(
                    'text-sm font-bold px-2.5 py-0.5',
                    isApplied
                      ? 'bg-green-600 text-white'
                      : isExceeded
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-primary/10 text-primary'
                  )}
                >
                  {pct}% OFF
                </Badge>
              </div>

              {/* Main CTA text */}
              <p className={cn('text-base font-bold mb-1', isExceeded && 'text-muted-foreground')}>
                Compre {qty} cartelas
              </p>

              {/* Price comparison */}
              <div className="flex items-baseline gap-2 mb-1">
                <span className={cn('text-lg font-bold', isExceeded ? 'text-muted-foreground' : 'text-green-600')}>
                  R$ {discountedTotal.toFixed(2)}
                </span>
                <span className="text-sm line-through text-muted-foreground">
                  R$ {originalTotal.toFixed(2)}
                </span>
              </div>

              {/* Unit price + savings */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>R$ {discountedUnit.toFixed(2)} por cartela</span>
                <span className={cn('font-medium', isExceeded ? 'text-muted-foreground' : 'text-green-600')}>
                  Economia: R$ {savings.toFixed(2)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
