'use client';

import React from 'react';
import { ShoppingCart } from 'lucide-react';
import { type ProductsListColors } from '@/components/site/products/colors';

interface ProductCardActionsProps {
  product: {
    _id: string;
    name: string;
    price?: number;
    salePrice?: number;
    slug?: string | null;
    categoryId?: string;
    stock?: number;
    hasVariants?: boolean;
  };
  tokens: ProductsListColors;
  showStock: boolean;
  showAddToCartButton: boolean;
  showBuyNowButton: boolean;
  buyNowLabel: string;
  onAddToCart: (product: any) => void;
  onBuyNow: (product: any) => void;
  cartButtonsLayout?: 'stack' | 'grid-2';
}

export function ProductCardActions({
  product,
  tokens,
  showStock,
  showAddToCartButton,
  showBuyNowButton,
  buyNowLabel,
  onAddToCart,
  onBuyNow,
  cartButtonsLayout,
}: ProductCardActionsProps) {
  if (!showAddToCartButton && !showBuyNowButton) {
    return null;
  }

  const isOutOfStock = showStock && (product.stock ?? 0) <= 0;
  const secondaryLabel = isOutOfStock ? 'Hết hàng' : buyNowLabel;
  const isGrid2 = cartButtonsLayout === 'grid-2' && showAddToCartButton && showBuyNowButton;
  const actionHeightClass = showAddToCartButton && showBuyNowButton && !isGrid2 ? 'min-h-[76px]' : 'min-h-[36px]';
  const gridColsClass = isGrid2 ? 'grid-cols-2' : 'grid-cols-1';

  return (
    <div className={`mt-2 sm:mt-3 grid ${gridColsClass} gap-1 sm:gap-2 ${actionHeightClass}`}>
      {showAddToCartButton && (
        <button
          className="w-full rounded-lg py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-all duration-300 flex items-center justify-center gap-1 sm:gap-1.5 disabled:opacity-55 disabled:cursor-not-allowed hover:brightness-95 hover:scale-[1.02] active:scale-[0.98] shadow-sm hover:shadow-md"
          style={{ backgroundColor: tokens.primaryActionBg, color: tokens.primaryActionText }}
          onClick={(event) => { event.preventDefault(); onAddToCart(product); }}
          disabled={isOutOfStock}
        >
          <ShoppingCart size={12} className="sm:w-[14px] sm:h-[14px]" />
          <span className="hidden sm:inline">Thêm vào giỏ</span>
          <span className="sm:hidden">Thêm giỏ</span>
        </button>
      )}
      {showBuyNowButton && (
        <button
          className="w-full rounded-lg py-1.5 sm:py-2 text-xs sm:text-sm font-medium border transition-all duration-300 disabled:opacity-55 disabled:cursor-not-allowed hover:bg-[var(--btn-hover-bg)] hover:scale-[1.02] active:scale-[0.98] shadow-sm hover:shadow-md"
          style={{
            borderColor: tokens.secondaryActionBorder,
            color: tokens.secondaryActionText,
            '--btn-hover-bg': tokens.secondaryActionHoverBg,
          } as React.CSSProperties}
          onClick={(event) => { event.preventDefault(); onBuyNow(product); }}
          disabled={isOutOfStock}
        >
          <span className="hidden sm:inline">{secondaryLabel}</span>
          <span className="sm:hidden">{isOutOfStock ? 'Hết' : 'Mua'}</span>
        </button>
      )}
    </div>
  );
}
