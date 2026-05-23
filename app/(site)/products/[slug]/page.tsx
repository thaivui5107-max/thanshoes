'use client';

import React from 'react';
import ProductDetailPageShared from '../../[categorySlug]/[recordSlug]/_components/ProductDetailPage';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function LegacyProductDetailPage({ params }: PageProps) {
  return <ProductDetailPageShared params={params} />;
}
