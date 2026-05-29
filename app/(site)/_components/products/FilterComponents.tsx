'use client';

import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { ChevronDown, SlidersHorizontal, Search, X, Check } from 'lucide-react';
import type { ProductsListColors } from '@/components/site/products/colors';
import { RangeSlider } from '@/components/shared/RangeSlider';
import type { Id } from '@/convex/_generated/dataModel';

export function parseNumericValue(name: string): number | null {
  const match = name.match(/(\d+(\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

export interface PriceRange {
  label: string;
  slug: string;
  minPrice?: number;
  maxPrice?: number;
}

interface AttributeFilterGroupWidgetProps {
  group: any;
  selectedAttributes: Record<string, string[]> | undefined;
  onAttributeChange: ((groupSlug: string, termId: any, checked: boolean) => void) | undefined;
  tokens: ProductsListColors;
}

export function AttributeFilterGroupWidget({
  group,
  selectedAttributes,
  onAttributeChange,
  tokens
}: AttributeFilterGroupWidgetProps) {
  const inputType = group.inputType || 'radio';
  const filterType = group.filterType || 'single';

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const toggleDropdown = (open: boolean) => {
    setIsDropdownOpen(open);
  };

  // Range Slider logic
  const numericTerms = useMemo(() => {
    return (group.terms || [])
      .map((t: any) => ({ term: t, value: parseNumericValue(t.name) }))
      .filter((item: any) => item.value !== null)
      .sort((a: any, b: any) => a.value - b.value);
  }, [group.terms]);

  const { minLimit, maxLimit } = useMemo(() => {
    if (numericTerms.length === 0) {
      return { minLimit: 0, maxLimit: 100 };
    }
    return {
      minLimit: numericTerms[0].value,
      maxLimit: numericTerms[numericTerms.length - 1].value
    };
  }, [numericTerms]);

  const step = useMemo(() => {
    const diff = maxLimit - minLimit;
    if (diff <= 0) return 1;
    if (diff <= 2) return 0.1;
    if (diff <= 20) return 0.5;
    return 1;
  }, [minLimit, maxLimit]);

  const [sliderMin, setSliderMin] = useState(minLimit);
  const [sliderMax, setSliderMax] = useState(maxLimit);
  const lastAppliedSlugsRef = useRef<string[] | null>(null);

  // Sync slider state khi URL thay đổi từ bên ngoài
  const currentSelectedTermIds = selectedAttributes?.[group._id] || [];

  useEffect(() => {
    if (filterType === 'range' && numericTerms.length > 0) {
      const isSelfChange = lastAppliedSlugsRef.current &&
        lastAppliedSlugsRef.current.length === currentSelectedTermIds.length &&
        lastAppliedSlugsRef.current.every(slug => currentSelectedTermIds.includes(slug));

      if (isSelfChange) return;

      if (currentSelectedTermIds.length > 0) {
        const selectedValues = numericTerms
          .filter((item: any) => currentSelectedTermIds.includes(item.term.slug))
          .map((item: any) => item.value);
        if (selectedValues.length > 0) {
          setSliderMin(Math.min(...selectedValues));
          setSliderMax(Math.max(...selectedValues));
          return;
        }
      }
      setSliderMin(minLimit);
      setSliderMax(maxLimit);
    }
  }, [currentSelectedTermIds, minLimit, maxLimit, numericTerms, filterType]);

  const applyRangeFilter = useCallback((newMin: number, newMax: number) => {
    setSliderMin(newMin);
    setSliderMax(newMax);
    if (newMin === minLimit && newMax === maxLimit) {
      lastAppliedSlugsRef.current = [];
      onAttributeChange?.(group.slug, [], false);
    } else {
      const matchedTermSlugs = numericTerms
        .filter((item: any) => item.value >= newMin && item.value <= newMax)
        .map((item: any) => item.term.slug);
      lastAppliedSlugsRef.current = matchedTermSlugs;
      onAttributeChange?.(group.slug, matchedTermSlugs, true);
    }
  }, [minLimit, maxLimit, numericTerms, onAttributeChange, group.slug]);

  const unit = useMemo(() => {
    if (group.terms && group.terms.length > 0) {
      const name = group.terms[0].name;
      const clean = name.replace(/[\d\s.-]/g, '');
      return clean || '';
    }
    return '';
  }, [group.terms]);

  // RENDER DUAL RANGE SLIDER (dùng Radix UI Slider)
  if (filterType === 'range') {
    if (numericTerms.length === 0) {
      return <div className="text-xs italic opacity-60">Không có dữ liệu số để lọc theo khoảng.</div>;
    }

    return (
      <RangeSlider
        minLimit={minLimit}
        maxLimit={maxLimit}
        valueMin={sliderMin}
        valueMax={sliderMax}
        step={step}
        primaryColor={tokens.filterChipActiveBg}
        trackColor={tokens.filterChipBg}
        thumbBorderColor="#ffffff"
        unit={unit}
        onValueCommit={applyRangeFilter}
      />
    );
  }

  // RENDER CUSTOM DROPDOWN SELECT
  if (inputType === 'select') {
    const handleSelectTerm = (slug: string) => {
      if (!slug) {
        onAttributeChange?.(group.slug, '', false);
        return;
      }
      if (filterType === 'single') {
        onAttributeChange?.(group.slug, slug, true);
      } else {
        const isChecked = selectedAttributes?.[group._id]?.includes(slug) ?? false;
        onAttributeChange?.(group.slug, slug, !isChecked);
      }
    };

    const getDropdownLabel = () => {
      const selectedSlugs = selectedAttributes?.[group._id] || [];
      if (selectedSlugs.length === 0) {
        return filterType === 'single' ? `Chọn ${group.name}` : `Thêm ${group.name}...`;
      }
      const found = (group.terms || []).filter((t: any) => selectedSlugs.includes(t.slug));
      if (found.length === 0) {
        return filterType === 'single' ? `Chọn ${group.name}` : `Thêm ${group.name}...`;
      }
      return found.map((f: any) => f.name).join(', ');
    };

    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => toggleDropdown(!isDropdownOpen)}
          className="w-full flex items-center justify-between h-10 px-3 py-2 text-sm rounded-lg border bg-white dark:bg-slate-800 transition-all font-medium"
          style={{ borderColor: tokens.inputBorder, color: tokens.inputText }}
        >
          <span className="truncate">{getDropdownLabel()}</span>
          <ChevronDown size={16} className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} style={{ color: tokens.inputIcon }} />
        </button>

        {isDropdownOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => toggleDropdown(false)} />
            <div className="absolute left-0 right-0 mt-1 z-20 max-h-60 overflow-y-auto rounded-lg border bg-white dark:bg-slate-800 shadow-lg p-1 space-y-0.5" style={{ borderColor: tokens.inputBorder }}>
              {filterType === 'single' && (
                <button
                  type="button"
                  onClick={() => {
                    handleSelectTerm('');
                    toggleDropdown(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm rounded-md text-left text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  Tất cả
                </button>
              )}
              {group.terms.map((term: any) => {
                const isSelected = selectedAttributes?.[group._id]?.includes(term.slug) ?? false;
                return (
                  <button
                    key={term._id}
                    type="button"
                    onClick={() => {
                      handleSelectTerm(term.slug);
                      if (filterType !== 'multiple') toggleDropdown(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-md text-left transition-colors ${
                      isSelected
                        ? 'font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                    style={isSelected ? { backgroundColor: tokens.filterChipActiveBg, color: tokens.filterChipActiveText } : {}}
                  >
                    <span>{term.name}</span>
                    {isSelected && <Check size={14} />}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Selected tags list for multiple filter select */}
        {filterType === 'multiple' && currentSelectedTermIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {currentSelectedTermIds.map((termSlug: string) => {
              const term = group.terms.find((t: any) => t.slug === termSlug);
              if (!term) return null;
              return (
                <span
                  key={termSlug}
                  onClick={() => onAttributeChange?.(group.slug, termSlug, false)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm cursor-pointer border hover:opacity-85 transition-opacity"
                  style={{
                    backgroundColor: tokens.filterChipBg,
                    color: tokens.filterChipText,
                    borderColor: tokens.filterChipBorder,
                  }}
                >
                  {term.name}
                  <X size={10} />
                </span>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // RENDER BUTTONS (Chips)
  if (inputType === 'buttons') {
    return (
      <div className="flex flex-wrap gap-2">
        {group.terms.map((term: any) => {
          const isChecked = selectedAttributes?.[group._id]?.includes(term.slug) ?? false;
          const handleButtonClick = () => {
            onAttributeChange?.(group.slug, term.slug, !isChecked);
          };
          return (
            <button
              key={term._id}
              type="button"
              onClick={handleButtonClick}
              className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors border"
              style={isChecked
                ? { backgroundColor: tokens.filterChipActiveBg, color: tokens.filterChipActiveText, borderColor: tokens.filterChipActiveBorder }
                : { backgroundColor: tokens.filterChipBg, color: tokens.filterChipText, borderColor: tokens.filterChipBorder }
              }
            >
              {term.name}
            </button>
          );
        })}
      </div>
    );
  }

  // RENDER RADIO / CHECKBOX
  return (
    <div className="space-y-2">
      {group.terms.map((term: any) => {
        const isChecked = selectedAttributes?.[group._id]?.includes(term.slug) ?? false;
        const isRadio = filterType === 'single' || inputType === 'radio';
        const handleLabelClick = () => {
          onAttributeChange?.(group.slug, term.slug, !isChecked);
        };

        return (
          <button
            key={term._id}
            type="button"
            onClick={handleLabelClick}
            className="w-full min-h-9 flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-left leading-5 transition-colors group hover:opacity-85"
            style={{ color: tokens.bodyText }}
          >
            <div
              className={`w-4 h-4 flex shrink-0 items-center justify-center transition-all ${
                isRadio ? 'rounded-full' : 'rounded border'
              }`}
              style={{
                borderWidth: '1px',
                borderColor: isChecked ? tokens.filterChipActiveBg : tokens.inputBorder,
                backgroundColor: isChecked ? tokens.filterChipActiveBg : tokens.inputBackground,
                color: tokens.filterChipActiveText
              }}
            >
              {isChecked && (
                isRadio ? (
                  <div className="w-1.5 h-1.5 rounded-full bg-white" style={{ backgroundColor: tokens.filterChipActiveText }} />
                ) : (
                  <Check size={11} className="stroke-[3]" style={{ color: tokens.filterChipActiveText }} />
                )
              )}
            </div>
            <span className={isChecked ? 'font-semibold' : 'font-normal'}>
              {term.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ========== MOBILE PRODUCTS FILTERS ==========
interface MobileProductsFiltersProps {
  categories: any[];
  selectedCategory: Id<"productCategories"> | null;
  onCategoryChange: (id: Id<"productCategories"> | null) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  sortBy: string;
  onSortChange: (s: any) => void;
  tokens: ProductsListColors;
  filterableGroups?: any[];
  selectedAttributes?: Record<string, string[]>;
  onAttributeChange?: (groupSlug: string, termSlug: any, checked: boolean) => void;
  productType?: any;
  selectedPriceRange?: PriceRange | null;
  onPriceRangeChange?: (range: PriceRange | null) => void;
  enableProductTypes?: boolean;
  productTypes?: any[];
  onProductTypeChange?: (slug: string | null) => void;
  attributeFilter?: any;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  radiusClass?: string;
}

export function MobileProductsFilters({
  categories,
  selectedCategory,
  onCategoryChange,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  tokens,
  filterableGroups,
  selectedAttributes,
  onAttributeChange,
  productType,
  selectedPriceRange,
  onPriceRangeChange,
  enableProductTypes,
  productTypes,
  onProductTypeChange,
  hasActiveFilters,
  onClearFilters,
  radiusClass
}: MobileProductsFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="lg:hidden mb-6 space-y-4">
      {/* Trigger Buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`flex-1 h-10 px-4 ${radiusClass || 'rounded-xl'} border flex items-center justify-center gap-2 font-semibold text-sm transition-all duration-300`}
          style={{
            borderColor: tokens.filterChipBorder,
            backgroundColor: tokens.filterChipBg,
            color: tokens.filterChipText
          }}
        >
          <SlidersHorizontal size={16} />
          <span>Bộ lọc</span>
        </button>

        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value)}
          className={`h-10 px-4 ${radiusClass || 'rounded-xl'} border font-semibold text-sm outline-none`}
          style={{
            borderColor: tokens.filterChipBorder,
            backgroundColor: tokens.filterChipBg,
            color: tokens.filterChipText
          }}
        >
          <option value="newest">Mới nhất</option>
          <option value="popular">Bán chạy</option>
          <option value="price_asc">Giá thấp → cao</option>
          <option value="price_desc">Giá cao → thấp</option>
          <option value="name">Tên A-Z</option>
        </select>
      </div>

      {/* Drawer Overlay & Panel */}
      {isOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50 transition-opacity" onClick={() => setIsOpen(false)} />
          <div className="fixed inset-y-0 right-0 w-full max-w-xs bg-white dark:bg-slate-900 z-50 flex flex-col shadow-2xl p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-6 pb-2 border-b">
              <h3 className="font-bold text-lg">Bộ lọc tìm kiếm</h3>
              <button onClick={() => setIsOpen(false)} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                <X size={20} />
              </button>
            </div>

            {/* Content Filters */}
            <div className="flex-1 space-y-6 overflow-y-auto pr-1">
              {/* Search Bar */}
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm sản phẩm..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="w-full h-10 pl-9 pr-8 rounded-lg border outline-none text-sm"
                  style={{ borderColor: tokens.inputBorder }}
                />
                {searchQuery && (
                  <button onClick={() => onSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Product Types Filter */}
              {enableProductTypes && productTypes && productTypes.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">Nhóm sản phẩm</h4>
                  <div className="space-y-1">
                    <button
                      onClick={() => { onProductTypeChange?.(null); setIsOpen(false); }}
                      className={`w-full py-2 px-3 rounded-lg text-left text-sm font-medium ${!productType ? 'bg-slate-100 dark:bg-slate-800 font-semibold' : ''}`}
                    >
                      Tất cả nhóm
                    </button>
                    {productTypes.map((t) => (
                      <button
                        key={t._id}
                        onClick={() => { onProductTypeChange?.(t.slug); setIsOpen(false); }}
                        className={`w-full py-2 px-3 rounded-lg text-left text-sm font-medium ${productType?.slug === t.slug ? 'bg-slate-100 dark:bg-slate-800 font-semibold' : ''}`}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Categories Filter */}
              <div className="space-y-3">
                <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">Danh mục sản phẩm</h4>
                <div className="space-y-1">
                  <button
                    onClick={() => { onCategoryChange(null); setIsOpen(false); }}
                    className={`w-full py-2 px-3 rounded-lg text-left text-sm font-medium ${!selectedCategory ? 'bg-slate-100 dark:bg-slate-800 font-semibold' : ''}`}
                  >
                    Tất cả danh mục
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat._id}
                      onClick={() => { onCategoryChange(cat._id); setIsOpen(false); }}
                      className={`w-full py-2 px-3 rounded-lg text-left text-sm font-medium ${selectedCategory === cat._id ? 'bg-slate-100 dark:bg-slate-800 font-semibold' : ''}`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price Ranges Filter */}
              {enableProductTypes && productType?.priceRanges && productType.priceRanges.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">Khoảng giá</h4>
                  <div className="space-y-1">
                    <button
                      onClick={() => { onPriceRangeChange?.(null); setIsOpen(false); }}
                      className={`w-full py-2 px-3 rounded-lg text-left text-sm font-medium ${!selectedPriceRange ? 'bg-slate-100 dark:bg-slate-800 font-semibold' : ''}`}
                    >
                      Tất cả khoảng giá
                    </button>
                    {productType.priceRanges.map((range: PriceRange) => (
                      <button
                        key={range.slug}
                        onClick={() => { onPriceRangeChange?.(range); setIsOpen(false); }}
                        className={`w-full py-2 px-3 rounded-lg text-left text-sm font-medium ${selectedPriceRange?.slug === range.slug ? 'bg-slate-100 dark:bg-slate-800 font-semibold' : ''}`}
                      >
                        {range.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Attributes Filters */}
              {filterableGroups && filterableGroups.length > 0 && (
                <div className="space-y-6 pt-4 border-t">
                  {filterableGroups.map((group) => (
                    <div key={group._id} className="space-y-3">
                      <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">{group.name}</h4>
                      <AttributeFilterGroupWidget
                        group={group}
                        selectedAttributes={selectedAttributes}
                        onAttributeChange={onAttributeChange}
                        tokens={tokens}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Clear All Filters Button */}
            {hasActiveFilters && onClearFilters && (
              <div className="pt-4 border-t mt-4">
                <button
                  type="button"
                  onClick={() => { onClearFilters(); setIsOpen(false); }}
                  className="w-full h-10 rounded-lg border font-semibold text-sm transition-colors text-slate-700 bg-slate-100 hover:bg-slate-200 flex items-center justify-center gap-2"
                >
                  <X size={16} />
                  <span>Xóa bộ lọc</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
