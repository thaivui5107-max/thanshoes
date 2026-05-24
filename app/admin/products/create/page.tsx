'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { ExternalLink, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { getAdminMutationErrorMessage } from '@/app/admin/lib/mutation-error';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '../../components/ui';
import { LexicalEditor } from '../../components/LexicalEditor';
import { ImageUploader } from '../../components/ImageUploader';
import type { ImageItem } from '../../components/MultiImageUploader';
import { MultiImageUploader } from '../../components/MultiImageUploader';
import { ModuleGuard } from '../../components/ModuleGuard';
import { DigitalCredentialsForm } from '@/components/orders/DigitalCredentialsForm';
import { stripHtml, truncateText } from '@/lib/seo';
import { ProductCategoryCombobox } from '@/app/admin/products/components/ProductCategoryCombobox';
import { QuickCreateCategoryModal } from '@/app/admin/products/components/QuickCreateCategoryModal';
import { resolveProductImageAspectRatio } from '@/lib/products/image-aspect-ratio';
import { HomeComponentStickyFooter } from '@/app/admin/home-components/_shared/components/HomeComponentStickyFooter';
import { AiEntityImportDialog, type AiEntityImportPayload } from '@/app/admin/components/AiEntityImportDialog';
import { CategoryTagsInput } from '@/app/admin/components/AdditionalCategoriesSelect';
import { InlineMatrixBuilder, type OptionCatalogItem, type VariantOptionSelection, type VariantRow } from '@/app/admin/products/components/inline-matrix-builder';
import { normalizeVariantRows, normalizeVariantSelections, validateVariantPayload } from '@/app/admin/products/components/inline-variant-utils';

const MODULE_KEY = 'products';

export default function ProductCreatePage() {
  return (
    <ModuleGuard moduleKey="products">
      <ProductCreateContent />
    </ModuleGuard>
  );
}

function ProductCreateContent() {
  const router = useRouter();
  const categoriesData = useQuery(api.productCategories.listActive);
  const createProduct = useMutation(api.productsSmart.createProductWithVariants);
  const fieldsData = useQuery(api.admin.modules.listEnabledModuleFields, { moduleKey: MODULE_KEY });
  const settingsData = useQuery(api.admin.modules.listModuleSettings, { moduleKey: MODULE_KEY });
  const optionsData = useQuery(api.productOptions.listActiveWithValues);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [stock, setStock] = useState('0');
  const [affiliateLink, setAffiliateLink] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [additionalCategoryIds, setAdditionalCategoryIds] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [renderType, setRenderType] = useState<'content' | 'markdown' | 'html'>('content');
  const [markdownRender, setMarkdownRender] = useState('');
  const [htmlRender, setHtmlRender] = useState('');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [image, setImage] = useState<string | undefined>();
  const [imageStorageId, setImageStorageId] = useState<Id<'_storage'> | undefined>();
  const [galleryItems, setGalleryItems] = useState<ImageItem[]>([]);
  const [status, setStatus] = useState<'Draft' | 'Active' | 'Archived'>('Draft');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editorResetKey, setEditorResetKey] = useState(0);
  const [hasVariants, setHasVariants] = useState(false);
  const [variantSelections, setVariantSelections] = useState<VariantOptionSelection[]>([]);
  const [variantRows, setVariantRows] = useState<VariantRow[]>([]);
  const [productType, setProductType] = useState<'physical' | 'digital'>('physical');
  const [digitalDeliveryType, setDigitalDeliveryType] = useState<'account' | 'license' | 'download' | 'custom'>('account');
  const [digitalCredentialsTemplate, setDigitalCredentialsTemplate] = useState<{
    username?: string;
    password?: string;
    licenseKey?: string;
    downloadUrl?: string;
    customContent?: string;
    expiresAt?: number;
  }>({});
  const lastGeneratedSkuRef = useRef('');
  const generatedSku = useQuery(
    api.productsSmart.generateSmartSku,
    name.trim()
      ? { name: name.trim(), categoryId: categoryId ? categoryId as Id<"productCategories"> : undefined }
      : 'skip'
  );
  const resolvedSkuPreview = sku.trim() || generatedSku || '';
  const skuExists = useQuery(
    api.productsSmart.checkSkuExists,
    resolvedSkuPreview ? { sku: resolvedSkuPreview } : 'skip'
  );

  const enabledFields = useMemo(() => {
    const fields = new Set<string>();
    fieldsData?.forEach(f => fields.add(f.fieldKey));
    return fields;
  }, [fieldsData]);

  const hasMarkdownRender = enabledFields.has('markdownRender');
  const hasHtmlRender = enabledFields.has('htmlRender');
  const showAdvancedRenderCard = hasMarkdownRender || hasHtmlRender;

  // Apply defaultStatus from settings
  const defaultStatus = useMemo(() => {
    const setting = settingsData?.find(s => s.settingKey === 'defaultStatus');
    return (setting?.value as string) || 'Draft';
  }, [settingsData]);

  const variantEnabled = useMemo(() => {
    const setting = settingsData?.find(s => s.settingKey === 'variantEnabled');
    return Boolean(setting?.value);
  }, [settingsData]);

  const variantPricing = useMemo(() => {
    const setting = settingsData?.find(s => s.settingKey === 'variantPricing');
    return (setting?.value as string) || 'variant';
  }, [settingsData]);

  const variantStock = useMemo(() => {
    const setting = settingsData?.find(s => s.settingKey === 'variantStock');
    return (setting?.value as string) || 'variant';
  }, [settingsData]);

  const productTypeMode = useMemo(() => {
    const setting = settingsData?.find(s => s.settingKey === 'productTypeMode');
    const value = setting?.value as 'physical' | 'digital' | 'both' | undefined;
    return value ?? 'both';
  }, [settingsData]);
  const multiCategoryEnabled = useMemo(() => (
    Boolean(settingsData?.find(s => s.settingKey === 'enableMultipleCategories')?.value)
  ), [settingsData]);

  const enableProductTypes = useMemo(() => {
    const setting = settingsData?.find(s => s.settingKey === 'enableProductTypes');
    return setting?.value === true;
  }, [settingsData]);

  const productTypesData = useQuery(api.productTypes.listAll, enableProductTypes ? {} : 'skip');
  const [productTypeId, setProductTypeId] = useState('');
  const [attributeTermIds, setAttributeTermIds] = useState<Id<"attributeTerms">[]>([]);
  const formConfig = useQuery(api.productTypes.getFormConfig, productTypeId ? { typeId: productTypeId as Id<"productTypes"> } : 'skip');

  const digitalEnabled = productTypeMode !== 'physical';

  const defaultDigitalDeliveryType = useMemo(() => {
    const setting = settingsData?.find(s => s.settingKey === 'defaultDigitalDeliveryType');
    return (setting?.value as 'account' | 'license' | 'download' | 'custom') ?? 'account';
  }, [settingsData]);

  const saleMode = useMemo(() => {
    const setting = settingsData?.find(s => s.settingKey === 'saleMode');
    const value = setting?.value;
    if (value === 'contact' || value === 'affiliate') {
      return value;
    }
    return 'cart';
  }, [settingsData]);

  const enableCombos = useMemo(() => {
    const setting = settingsData?.find(s => s.settingKey === 'enableCombos');
    return setting?.value === true;
  }, [settingsData]);

  const enableImageCrop = useMemo(() => {
    const setting = settingsData?.find(s => s.settingKey === 'enableImageCrop');
    return Boolean(setting?.value);
  }, [settingsData]);
  const defaultImageAspectRatio = useMemo(() => {
    const setting = settingsData?.find(s => s.settingKey === 'defaultImageAspectRatio');
    return resolveProductImageAspectRatio(setting?.value);
  }, [settingsData]);

  const isAffiliateMode = saleMode === 'affiliate';
  const isPriceRequired = saleMode === 'cart';
  const showProductTypeSelector = productTypeMode === 'both';
  const hideBasePricing = variantEnabled && hasVariants && variantPricing === 'variant';
  const hideBaseStock = variantEnabled && hasVariants && variantStock === 'variant';
  const optionCatalog = useMemo<OptionCatalogItem[]>(() =>
    (optionsData ?? [])
      .map((option) => ({
        id: option._id,
        name: option.name,
        order: option.order,
        values: option.values
          .filter((value) => value.active)
          .sort((a, b) => a.order - b.order)
          .map((value) => ({
            id: value._id,
            label: value.label ?? value.value,
            order: value.order,
          })),
      }))
      .sort((a, b) => a.order - b.order),
  [optionsData]);
  const normalizedVariantSelections = useMemo(() => normalizeVariantSelections(variantSelections), [variantSelections]);
  const normalizedVariantRows = useMemo(() => normalizeVariantRows(variantRows), [variantRows]);

  useEffect(() => {
    if (defaultStatus) {
      setStatus(defaultStatus as 'Draft' | 'Active' | 'Archived');
    }
  }, [defaultStatus]);

  const categoryData = categoriesData?.find((c) => c._id === categoryId);
  const categorySlugPreview = categoryData?.slug || 'chua-phan-loai';


  useEffect(() => {
    if (defaultDigitalDeliveryType) {
      setDigitalDeliveryType(defaultDigitalDeliveryType);
    }
  }, [defaultDigitalDeliveryType]);

  useEffect(() => {
    if (productTypeMode === 'physical' || productTypeMode === 'digital') {
      setProductType(productTypeMode);
    }
  }, [productTypeMode]);

  useEffect(() => {
    if (!generatedSku) {
      return;
    }
    setSku((currentSku) => {
      const shouldUseGenerated = !currentSku.trim() || currentSku === lastGeneratedSkuRef.current;
      lastGeneratedSkuRef.current = generatedSku;
      return shouldUseGenerated ? generatedSku : currentSku;
    });
  }, [generatedSku]);

  useEffect(() => {
    if (!isAffiliateMode) {
      setAffiliateLink('');
    }
  }, [isAffiliateMode]);

  const resolveSalePrice = (value: string) => {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return null;
    }
    const parsedValue = Number.parseInt(trimmedValue);
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      return null;
    }
    return parsedValue;
  };

  const formatNumberHelper = (value: string) => {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return '';
    }
    const parsedValue = Number.parseInt(trimmedValue);
    if (!Number.isFinite(parsedValue)) {
      return '';
    }
    return new Intl.NumberFormat('en-US').format(parsedValue);
  };

  const priceHelper = formatNumberHelper(price);
  const salePriceHelper = formatNumberHelper(salePrice);

  const generateSlugFromTitle = (value: string) => value.toLowerCase()
    .normalize("NFD").replaceAll(/[\u0300-\u036F]/g, "")
    .replaceAll(/[đĐ]/g, "d")
    .replaceAll(/[^a-z0-9\s]/g, '')
    .replaceAll(/\s+/g, '-');

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    setSlug(generateSlugFromTitle(val));
  };

  const handleApplyAiProduct = (item: AiEntityImportPayload) => {
    const nextName = item.name?.trim() || item.title?.trim() || '';
    if (!nextName) {return;}

    setName(nextName);
    setSlug(item.slug?.trim() || generateSlugFromTitle(nextName));
    if (typeof item.price === 'number') {setPrice(String(item.price));}
    if (typeof item.salePrice === 'number') {setSalePrice(String(item.salePrice));}
    if (typeof item.stock === 'number') {setStock(String(item.stock));}
    const nextDescription = item.content || item.description || item.excerpt || item.htmlRender || item.markdownRender || '';
    setDescription(nextDescription);
    if (item.content) {
      setRenderType('content');
      setHtmlRender(item.htmlRender || '');
      setMarkdownRender(item.markdownRender || '');
    } else if (item.htmlRender) {
      setRenderType('html');
      setHtmlRender(item.htmlRender);
      setMarkdownRender(item.markdownRender || '');
    } else if (item.markdownRender) {
      setRenderType('markdown');
      setMarkdownRender(item.markdownRender);
      setHtmlRender('');
    }
    setMetaTitle(item.metaTitle || truncateText(nextName, 60));
    setMetaDescription(item.metaDescription || truncateText(stripHtml(nextDescription), 160));
    if (item.image) {
      setImage(item.image);
      setImageStorageId(undefined);
    }
    setEditorResetKey((prev) => prev + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!name.trim() || !categoryId || (!hideBasePricing && isPriceRequired && (!price || Number(price) <= 0))) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }
    const variantPayload = {
      options: variantEnabled && hasVariants ? normalizedVariantSelections : [],
      variants: variantEnabled && hasVariants ? normalizedVariantRows : [],
    };
    if (variantEnabled && hasVariants) {
      const variantError = validateVariantPayload(
        variantPayload.options,
        variantPayload.variants,
        variantPricing === 'variant'
      );
      if (variantError) {
        toast.error(variantError);
        return;
      }
    }
    if (isAffiliateMode && !affiliateLink.trim()) {
      toast.error('Vui lòng nhập link affiliate cho sản phẩm');
      return;
    }
    if (galleryItems.some(item => Boolean(item.url)) && !image) {
      toast.error('Vui lòng chọn ảnh chính trước khi thêm ảnh vào thư viện');
      return;
    }
    const resolvedProductSku = sku.trim() || generatedSku || `SKU-${Date.now()}`;
    if (resolvedProductSku && skuExists === true) {
      toast.error('Mã SKU đã tồn tại, vui lòng chọn mã khác');
      return;
    }
    if (!hideBasePricing && salePrice.trim() !== '') {
      const parsedSalePrice = resolveSalePrice(salePrice);
      if (parsedSalePrice) {
        const parsedPrice = Number.parseInt(price) || 0;
        if (parsedPrice <= 0 || parsedSalePrice <= parsedPrice) {
          toast.error('Giá so sánh phải lớn hơn giá bán');
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const resolvedStock = productType === 'digital' || hideBaseStock ? 0 : (Number.parseInt(stock) || 0);
      const resolvedMetaTitle = truncateText(name.trim(), 60);
      const resolvedMetaDescription = truncateText(stripHtml(description || ''), 160);
      const resolvedGalleryItems = galleryItems
        .map(item => ({ url: item.url, storageId: item.storageId }))
        .filter(item => Boolean(item.url));
      const resolvedImages = resolvedGalleryItems.map(item => item.url);
      const resolvedImageStorageIds = resolvedGalleryItems.map(item => item.storageId ?? null);
      const resolvedSalePrice = hideBasePricing ? undefined : resolveSalePrice(salePrice);
      await createProduct({
        ...(isAffiliateMode ? { affiliateLink: affiliateLink.trim() || undefined } : {}),
        categoryId: categoryId as Id<"productCategories">,
        additionalCategoryIds: multiCategoryEnabled
          ? additionalCategoryIds.filter((id) => id !== categoryId) as Id<"productCategories">[]
          : undefined,
        description: description.trim() || undefined,
        renderType,
        markdownRender: markdownRender.trim() || undefined,
        htmlRender: htmlRender.trim() || undefined,
        hasVariants: variantEnabled ? hasVariants : false,
        image,
        imageStorageId: image ? (imageStorageId ?? null) : null,
        images: enabledFields.has('images') ? resolvedImages : undefined,
        imageStorageIds: enabledFields.has('images') ? resolvedImageStorageIds : undefined,
        metaDescription: enabledFields.has('metaDescription')
          ? (metaDescription.trim() || resolvedMetaDescription || undefined)
          : undefined,
        metaTitle: enabledFields.has('metaTitle')
          ? (metaTitle.trim() || resolvedMetaTitle || undefined)
          : undefined,
        name: name.trim(),
        options: variantPayload.options,
        variants: variantPayload.variants,
        price: hideBasePricing ? 0 : (Number.parseInt(price) || 0),
        salePrice: resolvedSalePrice,
        sku: resolvedProductSku,
        slug: slug.trim() || name.toLowerCase().replaceAll(/\s+/g, '-'),
        status,
        stock: resolvedStock,
        productTypeId: enableProductTypes && productTypeId ? productTypeId as Id<"productTypes"> : undefined,
        attributeTermIds: enableProductTypes ? attributeTermIds : undefined,
        productType: digitalEnabled ? productType : undefined,
        digitalDeliveryType: digitalEnabled && productType === 'digital' ? digitalDeliveryType : undefined,
        digitalCredentialsTemplate: digitalEnabled && productType === 'digital' && Object.keys(digitalCredentialsTemplate).length > 0
          ? digitalCredentialsTemplate
          : undefined,
      });
      toast.success("Tạo sản phẩm mới thành công");
      router.push('/admin/products');
    } catch (error) {
      toast.error(getAdminMutationErrorMessage(error, 'Không thể tạo sản phẩm'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
    <QuickCreateCategoryModal
      isOpen={showCategoryModal} 
      onClose={() =>{  setShowCategoryModal(false); }} 
      onCreated={(id) =>{  setCategoryId(id); }}
    />
    <form onSubmit={handleSubmit} className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Thêm sản phẩm mới</h1>
          <Link href="/admin/products" className="text-sm text-orange-600 hover:underline">Quay lại danh sách</Link>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Thông tin cơ bản</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Tên sản phẩm <span className="text-red-500">*</span></Label>
                <Input value={name} onChange={handleNameChange} required placeholder="Nhập tên sản phẩm..." autoFocus />
              </div>
              <div className={enabledFields.has('sku') ? "grid grid-cols-2 gap-4" : ""}>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input value={slug} onChange={(e) =>{  setSlug(e.target.value); }} placeholder="tu-dong-tao-tu-ten" className="font-mono text-sm" />
                </div>
                {enabledFields.has('sku') && (
                  <div className="space-y-2">
                    <Label>Mã gốc SKU / Prefix</Label>
                    <Input value={sku} onChange={(e) =>{  setSku(e.target.value); }} placeholder="VD: NK-AM90, để trống sẽ tự sinh" className="font-mono" />
                    {skuExists === true && (
                      <p className="text-xs text-red-500">SKU này đã tồn tại.</p>
                    )}
                    <p className="text-xs text-slate-500">Phiên bản sẽ nối đuôi theo mã này, ví dụ NK-AM90-BLK-42.</p>
                  </div>
                )}
              </div>
              {enabledFields.has('description') && (
                <div className="space-y-2">
                  <Label>Mô tả sản phẩm</Label>
                    <LexicalEditor onChange={setDescription} initialContent={description} resetKey={editorResetKey} />
                </div>
              )}
            </CardContent>
          </Card>

          {showAdvancedRenderCard && (
            <Card>
              <CardHeader><CardTitle className="text-base">Render nâng cao</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Kiểu render</Label>
                  <select
                    value={renderType}
                    onChange={(e) =>{  setRenderType(e.target.value as 'content' | 'markdown' | 'html'); }}
                    className="w-full h-10 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                  >
                    <option value="content">Content (mặc định)</option>
                    {hasMarkdownRender && <option value="markdown">Markdown</option>}
                    {hasHtmlRender && <option value="html">HTML</option>}
                  </select>
                </div>
                {hasMarkdownRender && (
                  <div className="space-y-2">
                    <Label>Markdown render</Label>
                    <textarea
                      value={markdownRender}
                      onChange={(e) =>{  setMarkdownRender(e.target.value); }}
                      className="w-full min-h-[120px] rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-mono"
                      placeholder="Dán markdown để render..."
                    />
                  </div>
                )}
                {hasHtmlRender && (
                  <div className="space-y-2">
                    <Label>HTML render</Label>
                    <textarea
                      value={htmlRender}
                      onChange={(e) =>{  setHtmlRender(e.target.value); }}
                      className="w-full min-h-[120px] rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-mono"
                      placeholder="Dán HTML inline để render..."
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Giá & Kho hàng</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {!hideBasePricing && (
                <div className={enabledFields.has('salePrice') ? "grid grid-cols-2 gap-4" : ""}>
                  <div className="space-y-2">
                    <Label>
                      Giá bán (VNĐ)
                      {isPriceRequired && <span className="text-red-500">*</span>}
                    </Label>
                    <Input
                      type="number"
                      value={price}
                      onChange={(e) =>{  setPrice(e.target.value); }}
                      required={isPriceRequired}
                      placeholder="0"
                      min="0"
                    />
                    {priceHelper && (
                      <p className="text-xs text-slate-500">{priceHelper}</p>
                    )}
                  </div>
                  {enabledFields.has('salePrice') && (
                    <div className="space-y-2">
                      <Label>Giá so sánh (trước giảm)</Label>
                      <Input type="number" value={salePrice} onChange={(e) =>{  setSalePrice(e.target.value); }} placeholder="0" min="0" />
                      {salePriceHelper && (
                        <p className="text-xs text-slate-500">{salePriceHelper}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
              {enabledFields.has('stock') && productType !== 'digital' && !hideBaseStock && (
                <div className="space-y-2">
                  <Label>Số lượng tồn kho</Label>
                  <Input type="number" value={stock} onChange={(e) =>{  setStock(e.target.value); }} placeholder="0" min="0" />
                </div>
              )}
              {isAffiliateMode && (
                <div className="space-y-2">
                  <Label>Link Affiliate <span className="text-red-500">*</span></Label>
                  <Input
                    type="url"
                    value={affiliateLink}
                    onChange={(e) => { setAffiliateLink(e.target.value); }}
                    placeholder="https://..."
                    required
                  />
                  <p className="text-xs text-slate-500">Nút “Mua ngay” trên frontend sẽ mở link này.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {digitalEnabled && (
            <Card>
              <CardHeader><CardTitle className="text-base">Loại sản phẩm</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {showProductTypeSelector && (
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="productType"
                        checked={productType === 'physical'}
                        onChange={() => setProductType('physical')}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">Vật lý (cần giao hàng)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="productType"
                        checked={productType === 'digital'}
                        onChange={() => setProductType('digital')}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">Digital (giao qua mạng)</span>
                    </label>
                  </div>
                )}

                {productType === 'digital' && (
                  <>
                    <div className="space-y-2">
                      <Label>Loại giao hàng Digital</Label>
                      <select
                        value={digitalDeliveryType}
                        onChange={(e) => setDigitalDeliveryType(e.target.value as 'account' | 'license' | 'download' | 'custom')}
                        className="w-full h-10 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                      >
                        <option value="account">Tài khoản (username/password)</option>
                        <option value="license">License Key</option>
                        <option value="download">File Download</option>
                        <option value="custom">Tùy chỉnh</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label>Template Credentials (tùy chọn)</Label>
                      <p className="text-xs text-slate-500">Nhập sẵn thông tin sẽ tự động giao khi xác nhận thanh toán</p>
                      <DigitalCredentialsForm
                        type={digitalDeliveryType}
                        value={digitalCredentialsTemplate}
                        onChange={setDigitalCredentialsTemplate}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {variantEnabled && (
            <Card>
              <CardHeader><CardTitle className="text-base">Phiên bản sản phẩm</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Quản lý tùy chọn</Label>
                  <Link href="/admin/product-options" target="_blank">
                    <Button type="button" variant="outline" className="h-7 px-2 text-xs gap-1">
                      <ExternalLink size={12} />
                      Mở
                    </Button>
                  </Link>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="has-variants"
                    checked={hasVariants}
                    onChange={(e) =>{  setHasVariants(e.target.checked); }}
                    className="w-4 h-4 rounded border-slate-300"
                  />
                  <Label htmlFor="has-variants" className="cursor-pointer">Sản phẩm có nhiều phiên bản</Label>
                </div>
                {hasVariants && (
                  <InlineMatrixBuilder
                    baseSku={resolvedSkuPreview || 'SP'}
                    basePrice={Number.parseInt(price) || 0}
                    optionCatalog={optionCatalog}
                    initialSelections={variantSelections}
                    initialVariants={variantRows}
                    onChange={(selections, variants) => {
                      setVariantSelections(selections);
                      setVariantRows(variants);
                    }}
                  />
                )}
              </CardContent>
            </Card>
          )}

          {enableCombos && saleMode === 'contact' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles size={16} className="text-orange-500 shrink-0" />
                  Combo ưu đãi
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-3.5 rounded-lg border border-orange-100 bg-orange-50/50 text-orange-800 text-xs dark:border-orange-950/20 dark:bg-orange-950/10 dark:text-orange-400">
                  <p className="font-semibold mb-1">Cấu hình Combo</p>
                  <p>Hệ thống Combo chỉ có thể cấu hình sau khi sản phẩm được tạo thành công. Vui lòng tạo sản phẩm trước, sau đó truy cập trang chỉnh sửa sản phẩm để thiết lập Combo.</p>
                </div>
              </CardContent>
            </Card>
          )}

          {(enabledFields.has('metaTitle') || enabledFields.has('metaDescription')) && (
            <Card>
              <CardHeader><CardTitle className="text-base">SEO</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {enabledFields.has('metaTitle') && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Meta Title</Label>
                      <span className={`text-xs ${metaTitle.length > 60 ? 'text-red-500' : 'text-slate-400'}`}>
                        {metaTitle.length}/60
                      </span>
                    </div>
                    <Input
                      value={metaTitle}
                      onChange={(e) =>{  setMetaTitle(e.target.value); }}
                      placeholder="Lấy theo tên sản phẩm nếu để trống"
                    />
                  </div>
                )}
                {enabledFields.has('metaDescription') && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Meta Description</Label>
                      <span className={`text-xs ${metaDescription.length > 160 ? 'text-red-500' : 'text-slate-400'}`}>
                        {metaDescription.length}/160
                      </span>
                    </div>
                    <textarea
                      value={metaDescription}
                      onChange={(e) =>{  setMetaDescription(e.target.value); }}
                      className="w-full min-h-[90px] rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                      placeholder="Lấy theo mô tả sản phẩm nếu bạn để trống"
                    />
                  </div>
                )}
                <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 text-sm">
                  <div className="text-blue-600 font-medium truncate">
                    {metaTitle.trim() || name || 'Tên sản phẩm'}
                  </div>
                  <div className="text-emerald-600 text-xs">
                    /{categorySlugPreview}/{slug || 'san-pham'}
                  </div>
                  <div className="text-slate-600 text-xs mt-1 line-clamp-2">
                    {metaDescription.trim() || stripHtml(description || '') || 'Mô tả ngắn sẽ hiển thị tại đây.'}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Xuất bản</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Trạng thái</Label>
                <select 
                  value={status} 
                  onChange={(e) =>{  setStatus(e.target.value as 'Draft' | 'Active' | 'Archived'); }}
                  className="w-full h-10 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                >
                  <option value="Draft">Bản nháp</option>
                  <option value="Active">Đang bán</option>
                  <option value="Archived">Lưu trữ</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Danh mục <span className="text-red-500">*</span></Label>
                {multiCategoryEnabled ? (
                  <>
                  <CategoryTagsInput
                    categories={categoriesData}
                    value={[categoryId, ...additionalCategoryIds].filter(Boolean)}
                    onQuickCreate={() =>{  setShowCategoryModal(true); }}
                    onChange={(ids) => {
                      setCategoryId(ids[0] ?? '');
                      setAdditionalCategoryIds(ids.slice(1));
                    }}
                  />
                  <p className="text-xs text-slate-500">Thẻ đầu tiên là danh mục chính/canonical, các thẻ sau là danh mục phụ.</p>
                  </>
                ) : (
                  <ProductCategoryCombobox
                    categories={categoriesData}
                    value={categoryId}
                    onChange={setCategoryId}
                    onQuickCreate={() =>{  setShowCategoryModal(true); }}
                  />
                )}
              </div>
            </CardContent>
          </Card>
          
          {enableProductTypes && (
            <Card>
              <CardHeader><CardTitle className="text-base">Phân loại chuyên sâu</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Kiểu sản phẩm</Label>
                  <select
                    value={productTypeId}
                    onChange={(e) => {
                      setProductTypeId(e.target.value);
                      setAttributeTermIds([]); // Reset terms when type changes
                    }}
                    className="w-full h-10 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                  >
                    <option value="">Chọn kiểu sản phẩm...</option>
                    {productTypesData?.map((type) => (
                      <option key={type._id} value={type._id}>{type.name}</option>
                    ))}
                  </select>
                </div>
                {formConfig && formConfig.groups.map(group => (
                  <div key={group._id} className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <Label>{group.name}</Label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      {group.terms.map(term => (
                        <label key={term._id} className="flex items-center gap-2 cursor-pointer bg-slate-50 dark:bg-slate-900 px-2 py-1.5 rounded-md border border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                          <input
                            type={group.inputType === 'radio' || group.filterType === 'single' ? 'radio' : 'checkbox'}
                            name={`attr_${group._id}`}
                            checked={attributeTermIds.includes(term._id)}
                            onChange={(e) => {
                              if (group.inputType === 'radio' || group.filterType === 'single') {
                                const otherTermIds = group.terms.map(t => t._id).filter(id => id !== term._id);
                                setAttributeTermIds(prev => [...prev.filter(id => !otherTermIds.includes(id)), term._id]);
                              } else {
                                if (e.target.checked) {
                                  setAttributeTermIds(prev => [...prev, term._id]);
                                } else {
                                  setAttributeTermIds(prev => prev.filter(id => id !== term._id));
                                }
                              }
                            }}
                            className="w-3.5 h-3.5"
                          />
                          <span className="text-xs truncate">{term.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Ảnh sản phẩm</CardTitle></CardHeader>
            <CardContent>
              <ImageUploader
                value={image}
                storageId={imageStorageId}
                onChange={(url, storageId) => {
                  setImage(url);
                  setImageStorageId(storageId);
                }}
                folder="products"
                naming={{ entityName: slug.trim() || 'product', style: 'slug-index', index: 1 }}
                deleteMode="defer"
                aspectRatio="square"
                cropAspectRatio={defaultImageAspectRatio}
              />
            </CardContent>
          </Card>

          {enabledFields.has('images') && image && (
            <Card>
              <CardHeader><CardTitle className="text-base">Thư viện ảnh</CardTitle></CardHeader>
              <CardContent>
                <MultiImageUploader<ImageItem>
                  items={galleryItems}
                  onChange={setGalleryItems}
                  folder="products"
                  naming={{ entityName: slug.trim() || 'product', style: 'slug-index' }}
                  namingIndexOffset={1}
                  deleteMode="defer"
                  imageKey="url"
                  minItems={0}
                  maxItems={20}
                  aspectRatio="square"
                  enableCrop={enableImageCrop}
                  cropAspectRatio={defaultImageAspectRatio}
                  imageAspectRatio={defaultImageAspectRatio}
                  columns={2}
                  addButtonText="Thêm ảnh"
                  emptyText="Chưa có ảnh trong thư viện"
                  layout="vertical"
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <HomeComponentStickyFooter
        isSubmitting={isSubmitting}
        submitLabel="Tạo sản phẩm"
        onCancel={() =>{  router.push('/admin/products'); }}
        disableSave={isSubmitting}
      >
        <>
          <Button type="button" variant="ghost" onClick={() =>{  router.push('/admin/products'); }}>Hủy bỏ</Button>
          <div className="flex flex-wrap justify-end gap-2">
            <AiEntityImportDialog kind="product" enabledFields={enabledFields} onApply={handleApplyAiProduct} />
            <Button type="button" variant="secondary" onClick={() =>{  setStatus('Draft'); }}>Lưu nháp</Button>
            <Button type="submit" variant="accent" disabled={isSubmitting}>
              {isSubmitting && <Loader2 size={16} className="animate-spin mr-2" />}
              Tạo sản phẩm
            </Button>
          </div>
        </>
      </HomeComponentStickyFooter>
    </form>
    </>
  );
}
