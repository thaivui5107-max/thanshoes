'use client';

import React, { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getAdminMutationErrorMessage } from '@/app/admin/lib/mutation-error';
import { Button, Card, CardContent, Input, Label } from '../../../components/ui';

const MODULE_KEY = 'productTypes';

export default function ProductTypeEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const typeData = useQuery(api.productTypes.getById, { id: id as Id<"productTypes"> });
  const updateType = useMutation(api.productTypes.update);
  const fieldsData = useQuery(api.admin.modules.listEnabledModuleFields, { moduleKey: MODULE_KEY });

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [order, setOrder] = useState('0');
  const [attributeGroupIds, setAttributeGroupIds] = useState<Id<"attributeGroups">[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const attributeGroups = useQuery(api.attributeGroups.listAll);
  const assignedGroupsData = useQuery(api.productTypes.listAssignedGroups, { typeId: id as Id<"productTypes"> });

  const enabledFields = useMemo(() => {
    const fields = new Set<string>();
    fieldsData?.forEach(f => fields.add(f.fieldKey));
    return fields;
  }, [fieldsData]);

  useEffect(() => {
    if (typeData) {
      setName(typeData.name);
      setSlug(typeData.slug);
      setDescription(typeData.description ?? '');
      setActive(typeData.active);
      setOrder((typeData.order ?? 0).toString());
    }
  }, [typeData]);

  useEffect(() => {
    if (assignedGroupsData) {
      setAttributeGroupIds(assignedGroupsData.map(g => g._id));
    }
  }, [assignedGroupsData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {return;}

    setIsSubmitting(true);
    try {
      await updateType({
        active,
        description: description.trim() || undefined,
        id: id as Id<"productTypes">,
        name: name.trim(),
        slug: slug.trim(),
        order: parseInt(order) || 0,
        attributeGroupIds,
      });
      toast.success('Cập nhật kiểu thành công');
    } catch (error) {
      toast.error(getAdminMutationErrorMessage(error, 'Không thể cập nhật kiểu'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (typeData === undefined) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-orange-500" />
      </div>
    );
  }

  if (typeData === null) {
    return (
      <div className="text-center py-8 text-slate-500">
        Không tìm thấy kiểu
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Chỉnh sửa kiểu</h1>
          <Link href="/admin/product-types" className="text-sm text-orange-600 hover:underline">
            Quay lại danh sách
          </Link>
        </div>
      </div>

      <Card className="max-w-md mx-auto md:mx-0">
        <form onSubmit={handleSubmit}>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label>Tên kiểu <span className="text-red-500">*</span></Label>
              <Input 
                value={name} 
                onChange={(e) =>{  setName(e.target.value); }} 
                required 
                placeholder="Nhập tên kiểu..." 
                autoFocus 
              />
            </div>

            <div className="space-y-2">
              <Label>Slug</Label>
              <Input 
                value={slug} 
                onChange={(e) =>{  setSlug(e.target.value); }} 
                placeholder="slug" 
                className="font-mono text-sm" 
              />
            </div>

            {enabledFields.has('description') && (
              <div className="space-y-2">
                <Label>Mô tả</Label>
                <textarea
                  value={description}
                  onChange={(e) =>{  setDescription(e.target.value); }}
                  placeholder="Mô tả ngắn về kiểu sản phẩm..."
                  className="w-full min-h-[80px] rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Thứ tự hiển thị</Label>
              <Input 
                type="number"
                value={order} 
                onChange={(e) => setOrder(e.target.value)} 
              />
            </div>

            <div className="space-y-2">
              <Label>Các nhóm thuộc tính (Được gán vào kiểu này)</Label>
              <div className="border border-slate-200 dark:border-slate-700 rounded-md p-3 max-h-60 overflow-y-auto space-y-2">
                {attributeGroups === undefined ? (
                  <p className="text-sm text-slate-500 italic">Đang tải...</p>
                ) : attributeGroups.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">Chưa có nhóm thuộc tính nào.</p>
                ) : (
                  attributeGroups.map(group => (
                    <label key={group._id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={attributeGroupIds.includes(group._id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAttributeGroupIds(prev => [...prev, group._id]);
                          } else {
                            setAttributeGroupIds(prev => prev.filter(id => id !== group._id));
                          }
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                      />
                      <span className="text-sm">{group.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

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
          </CardContent>
          
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 rounded-b-lg flex justify-end gap-3">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={() =>{  router.push('/admin/product-types'); }}
            >
              Hủy bỏ
            </Button>
            <Button type="submit" variant="accent" disabled={isSubmitting}>
              {isSubmitting && <Loader2 size={16} className="animate-spin mr-2" />}
              Lưu thay đổi
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
