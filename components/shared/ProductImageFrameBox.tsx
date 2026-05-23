'use client';

import React, { useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

// Simple overlay config - chỉ 1 URL global, không còn activeProductFrameId
export function useProductFrameConfig() {
  const enabledSetting = useQuery(api.settings.getValue, {
    key: 'enable_product_frames',
    defaultValue: false,
  });
  const overlaySetting = useQuery(api.settings.getValue, {
    key: 'product_frame_overlay_url',
  });

  const enabled = enabledSetting === true;
  const overlayUrl = typeof overlaySetting === 'string' && overlaySetting ? overlaySetting : null;

  return useMemo(
    () => ({ enabled, overlayUrl: enabled ? overlayUrl : null }),
    [enabled, overlayUrl]
  );
}

type ProductImageFrameBoxProps = {
  overlayUrl?: string | null;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
};

export function ProductImageFrameBox({
  overlayUrl,
  className,
  style,
  children,
}: ProductImageFrameBoxProps) {
  return (
    <div className={className ? `relative ${className}` : 'relative'} style={style}>
      {children}
      <ProductImageFrameOverlay overlayUrl={overlayUrl} />
    </div>
  );
}

export function ProductImageFrameOverlay({
  overlayUrl,
}: {
  overlayUrl?: string | null;
}) {
  if (!overlayUrl) {
    return null;
  }
  return (
    <img
      src={overlayUrl}
      alt=""
      aria-hidden="true"
      className="absolute inset-0 h-full w-full object-contain pointer-events-none select-none"
    />
  );
}
