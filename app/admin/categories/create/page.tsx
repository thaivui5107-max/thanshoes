'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getAdminMutationErrorMessage } from '@/app/admin/lib/mutation-error';
import { Button, Card, CardContent, Input, Label } from '../../components/ui';
import { LexicalEditor } from '../../components/LexicalEditor';
import { FaqForm } from '@/app/admin/home-components/faq/_components/FaqForm';
import type { FaqItem, FaqStyle, FaqConfig } from '@/app/admin/home-components/faq/_types';

const MODULE_KEY = 'productCategories';

export default function CategoryCreatePage() {
  const router = useRouter();
  const categoriesData = useQuery(api.productCategories.listAll, {});
  const createCategory = useMutation(api.productCategories.create);
  const fieldsData = useQuery(api.admin.modules.listEnabledModuleFields, { moduleKey: MODULE_KEY });
  const hierarchyFeature = useQuery(api.admin.modules.getModuleFeature, {
    featureKey: 'enableCategoryHierarchy',
    moduleKey: 'products',
  });
  void fieldsData; // Mark as intentionally unused for now

  // System settings toggles
  const showCategorySubtitleSetting = useQuery(api.admin.modules.getModuleSetting, { moduleKey: 'products', settingKey: 'showCategorySubtitle' });
  const enableCategoryFilterFooterContentSetting = useQuery(api.admin.modules.getModuleSetting, { moduleKey: 'products', settingKey: 'enableCategoryFilterFooterContent' });
  const enableCategoryProductDetailSuffixSetting = useQuery(api.admin.modules.getModuleSetting, { moduleKey: 'products', settingKey: 'enableCategoryProductDetailSuffix' });
  const enableCategoryProductDetailFaqSetting = useQuery(api.admin.modules.getModuleSetting, { moduleKey: 'products', settingKey: 'enableCategoryProductDetailFaq' });

  const showCategorySubtitle = showCategorySubtitleSetting?.value === true;
  const enableCategoryFilterFooterContent = enableCategoryFilterFooterContentSetting?.value === true;
  const enableCategoryProductDetailSuffix = enableCategoryProductDetailSuffixSetting?.value === true;
  const enableCategoryProductDetailFaq = enableCategoryProductDetailFaqSetting?.value === true;

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState('');
  const [active, setActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New fields state
  const [filterFooterContent, setFilterFooterContent] = useState('');
  const [productDetailSuffixContent, setProductDetailSuffixContent] = useState('');
  const [faqItems, setFaqItems] = useState<FaqItem[]>([{ id: Date.now(), question: '', answer: '' }]);
  const [faqStyle, setFaqStyle] = useState<FaqStyle>('accordion');
  const [faqConfig, setFaqConfig] = useState<FaqConfig>({ description: '', buttonText: '', buttonLink: '' });

  const enabledFields = useMemo(() => {
    const fields = new Set<string>();
    fieldsData?.forEach(f => fields.add(f.fieldKey));
    return fields;
  }, [fieldsData]);
  const isHierarchyEnabled = hierarchyFeature?.enabled === true;

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    const generatedSlug = val.toLowerCase()
      .normalize("NFD").replaceAll(/[\u0300-\u036F]/g, "")
      .replaceAll(/[đĐ]/g, "d")
      .replaceAll(/[^a-z0-9\s]/g, '')
      .replaceAll(/\s+/g, '-');
    setSlug(generatedSlug);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) {return;}

    setIsSubmitting(true);
    try {
      const resolvedFaqItems = faqItems
        .filter(f => f.question.trim() || f.answer.trim())
        .map((f, idx) => ({
          id: String(f.id),
          question: f.question.trim(),
          answer: f.answer.trim(),
          order: idx,
        }));

      await createCategory({
        active,
        description: description.trim() || undefined,
        name: name.trim(),
        parentId: isHierarchyEnabled && parentId ? parentId as Id<"productCategories"> : undefined,
        slug: slug.trim(),
        filterFooterContent: enableCategoryFilterFooterContent && filterFooterContent.trim() ? filterFooterContent : undefined,
        productDetailSuffixContent: enableCategoryProductDetailSuffix && productDetailSuffixContent.trim() ? productDetailSuffixContent : undefined,
        productDetailFaqItems: enableCategoryProductDetailFaq && resolvedFaqItems.length > 0 ? resolvedFaqItems : undefined,
        productDetailFaqStyle: enableCategoryProductDetailFaq ? faqStyle : undefined,
      });
      toast.success('Tạo danh mục thành công');
      router.push('/admin/categories');
    } catch (error) {
      toast.error(getAdminMutationErrorMessage(error, 'Không thể tạo danh mục'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Thêm danh mục mới</h1>
          <Link href="/admin/categories" className="text-sm text-orange-600 hover:underline">Quay lại danh sách</Link>
        </div>
      </div>

      <Card className="w-full">
        <form onSubmit={handleSubmit}>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Tên danh mục <span className="text-red-500">*</span></Label>
                  <Input value={name} onChange={handleNameChange} required placeholder="Ví dụ: Điện thoại, Áo sơ mi..." autoFocus />
                </div>

                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input value={slug} onChange={(e) =>{  setSlug(e.target.value); }} placeholder="tu-dong-tao-tu-ten" className="font-mono text-sm" />
                </div>
              </div>

              <div className="space-y-4">
                {isHierarchyEnabled && (
                  <div className="space-y-2">
                    <Label>Danh mục cha</Label>
                    <select 
                      value={parentId}
                      onChange={(e) =>{  setParentId(e.target.value); }}
                      className="w-full h-10 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                    >
                      <option value="">-- Không có (Danh mục gốc) --</option>
                      {categoriesData?.filter(c => c.active).map(cat => (
                        <option key={cat._id} value={cat._id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Trạng thái</Label>
                  <select 
                    value={active ? 'active' : 'inactive'}
                    onChange={(e) =>{  setActive(e.target.value === 'active'); }}
                    className="w-full h-10 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                  >
                    <option value="active">Hoạt động</option>
                    <option value="inactive">Ẩn</option>
                  </select>
                </div>
              </div>
            </div>

            {(enabledFields.has('description') || showCategorySubtitle) && (
              <div className="space-y-2">
                <Label>Mô tả ngắn (Subtitle)</Label>
                <textarea
                  value={description}
                  onChange={(e) =>{  setDescription(e.target.value); }}
                  placeholder="Mô tả ngắn hiển thị dưới tên danh mục..."
                  className="w-full min-h-[80px] rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                />
              </div>
            )}

            {enableCategoryFilterFooterContent && (
              <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                <Label className="text-base font-semibold block">Nội dung cuối trang danh mục</Label>
                <LexicalEditor onChange={setFilterFooterContent} initialContent={filterFooterContent} />
              </div>
            )}

            {enableCategoryProductDetailSuffix && (
              <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                <Label className="text-base font-semibold block">Nội dung nối đuôi chi tiết sản phẩm</Label>
                <LexicalEditor onChange={setProductDetailSuffixContent} initialContent={productDetailSuffixContent} />
              </div>
            )}

            {enableCategoryProductDetailFaq && (
              <div className="space-y-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                <Label className="text-base font-semibold block">FAQ chi tiết sản phẩm</Label>
                <FaqForm
                  faqItems={faqItems}
                  setFaqItems={setFaqItems}
                  faqStyle={faqStyle}
                  brandColor="#f97316"
                  faqConfig={faqConfig}
                  setFaqConfig={setFaqConfig}
                />
              </div>
            )}
          </CardContent>
          
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 rounded-b-lg flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() =>{  router.push('/admin/categories'); }}>Hủy bỏ</Button>
            <Button type="submit" variant="accent" disabled={isSubmitting}>
              {isSubmitting && <Loader2 size={16} className="animate-spin mr-2" />}
              Tạo danh mục
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
