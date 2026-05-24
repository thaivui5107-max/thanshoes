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

export default function ProductTypeCreatePage() {
  const router = useRouter();
  const createType = useMutation(api.productTypes.create);
  const attributeGroups = useQuery(api.attributeGroups.listAll);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [order, setOrder] = useState<number>(0);
  const [selectedAttributeGroupIds, setSelectedAttributeGroupIds] = useState<Id<"attributeGroups">[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const toggleAttributeGroup = (groupId: Id<"attributeGroups">) => {
    setSelectedAttributeGroupIds(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) {return;}

    setIsSubmitting(true);
    try {
      await createType({
        active,
        description: description.trim() || undefined,
        name: name.trim(),
        slug: slug.trim(),
        order,
        attributeGroupIds: selectedAttributeGroupIds,
      });
      toast.success('Tạo loại sản phẩm thành công');
      router.push('/admin/product-types');
    } catch (error) {
      toast.error(getAdminMutationErrorMessage(error, 'Không thể tạo loại sản phẩm'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Thêm loại sản phẩm</h1>
          <Link href="/admin/product-types" className="text-sm text-orange-600 hover:underline">
            Quay lại danh sách
          </Link>
        </div>
      </div>

      <Card className="max-w-xl mx-auto md:mx-0">
        <form onSubmit={handleSubmit}>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-2">
              <Label>Tên loại sản phẩm <span className="text-red-500">*</span></Label>
              <Input 
                value={name} 
                onChange={handleNameChange} 
                required 
                placeholder="Ví dụ: Rượu Vang, Phụ kiện..." 
                autoFocus 
              />
            </div>

            <div className="space-y-2">
              <Label>Slug</Label>
              <Input 
                value={slug} 
                onChange={(e) => { setSlug(e.target.value); }} 
                placeholder="tu-dong-tao-tu-ten" 
                className="font-mono text-sm" 
              />
            </div>

            <div className="space-y-2">
              <Label>Mô tả</Label>
              <textarea
                value={description}
                onChange={(e) => { setDescription(e.target.value); }}
                placeholder="Mô tả ngắn về loại sản phẩm..."
                className="w-full min-h-[80px] rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Thứ tự hiển thị</Label>
                <Input 
                  type="number"
                  value={order} 
                  onChange={(e) => { setOrder(parseInt(e.target.value) || 0); }} 
                  placeholder="0" 
                />
              </div>

              <div className="space-y-2">
                <Label>Trạng thái</Label>
                <select 
                  value={active ? 'active' : 'inactive'}
                  onChange={(e) => { setActive(e.target.value === 'active'); }}
                  className="w-full h-10 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                >
                  <option value="active">Hoạt động</option>
                  <option value="inactive">Ẩn</option>
                </select>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div>
                <Label className="text-base font-semibold">Nhóm thuộc tính</Label>
                <p className="text-sm text-slate-500">Chọn các nhóm thuộc tính áp dụng cho loại sản phẩm này.</p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto p-2 border border-slate-200 dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-900/50">
                {attributeGroups === undefined ? (
                  <div className="col-span-2 flex justify-center py-4">
                    <Loader2 size={24} className="animate-spin text-slate-400" />
                  </div>
                ) : attributeGroups.length === 0 ? (
                  <div className="col-span-2 text-center py-4 text-sm text-slate-500">
                    Chưa có nhóm thuộc tính nào.
                  </div>
                ) : (
                  attributeGroups.map(group => (
                    <label key={group._id} className="flex items-start gap-2 p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={selectedAttributeGroupIds.includes(group._id)}
                        onChange={() => toggleAttributeGroup(group._id)}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium text-sm">{group.name}</div>
                        <div className="text-xs text-slate-500">{group.code}</div>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>
          </CardContent>
          
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 rounded-b-lg flex justify-end gap-3">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={() => { router.push('/admin/product-types'); }}
            >
              Hủy bỏ
            </Button>
            <Button type="submit" variant="accent" disabled={isSubmitting}>
              {isSubmitting && <Loader2 size={16} className="animate-spin mr-2" />}
              Tạo loại sản phẩm
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
