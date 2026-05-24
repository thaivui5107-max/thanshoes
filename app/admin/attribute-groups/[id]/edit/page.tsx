'use client';

import React, { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getAdminMutationErrorMessage } from '@/app/admin/lib/mutation-error';
import { Button, Card, CardContent, Input, Label } from '../../../components/ui';

export default function AttributeGroupEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const groupData = useQuery(api.attributeGroups.getById, { id: id as Id<"attributeGroups"> });
  const updateGroup = useMutation(api.attributeGroups.update);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [slug, setSlug] = useState('');
  const [filterType, setFilterType] = useState('single');
  const [inputType, setInputType] = useState('select');
  const [isFilterable, setIsFilterable] = useState(true);
  const [order, setOrder] = useState('0');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (groupData) {
      setName(groupData.name);
      setCode(groupData.code);
      setSlug(groupData.slug);
      setFilterType(groupData.filterType);
      setInputType(groupData.inputType);
      setIsFilterable(groupData.isFilterable ?? true);
      setOrder(groupData.order.toString());
    }
  }, [groupData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {return;}

    setIsSubmitting(true);
    try {
      await updateGroup({
        id: id as Id<"attributeGroups">,
        name: name.trim(),
        code: code.trim(),
        slug: slug.trim(),
        filterType,
        inputType,
        isFilterable,
        order: parseInt(order) || 0,
      });
      toast.success('Cập nhật nhóm thuộc tính thành công');
    } catch (error) {
      toast.error(getAdminMutationErrorMessage(error, 'Không thể cập nhật nhóm thuộc tính'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (groupData === undefined) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-orange-500" />
      </div>
    );
  }

  if (groupData === null) {
    return (
      <div className="text-center py-8 text-slate-500">
        Không tìm thấy nhóm thuộc tính
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Chỉnh sửa nhóm thuộc tính</h1>
          <Link href="/admin/attribute-groups" className="text-sm text-orange-600 hover:underline">
            Quay lại danh sách
          </Link>
        </div>
      </div>

      <Card className="max-w-md mx-auto md:mx-0">
        <form onSubmit={handleSubmit}>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label>Tên nhóm thuộc tính <span className="text-red-500">*</span></Label>
              <Input 
                value={name} 
                onChange={(e) =>{  setName(e.target.value); }} 
                required 
                placeholder="Nhập tên nhóm thuộc tính..." 
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

            <div className="space-y-2">
              <Label>Mã (Code) <span className="text-red-500">*</span></Label>
              <Input 
                value={code} 
                onChange={(e) => setCode(e.target.value)} 
                required 
                placeholder="VD: color, size..." 
              />
            </div>

            <div className="space-y-2">
              <Label>Kiểu lọc</Label>
              <select 
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full h-10 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              >
                <option value="single">Một lựa chọn (Single)</option>
                <option value="multiple">Nhiều lựa chọn (Multiple)</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Kiểu hiển thị</Label>
              <select 
                value={inputType}
                onChange={(e) => setInputType(e.target.value)}
                className="w-full h-10 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              >
                <option value="select">Dropdown (Select)</option>
                <option value="buttons">Các nút bấm (Buttons)</option>
                <option value="color">Màu sắc (Color/Hình ảnh)</option>
                <option value="radio">Nút tròn (Radio)</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Vị trí hiển thị (Thứ tự)</Label>
              <Input 
                type="number"
                value={order} 
                onChange={(e) => setOrder(e.target.value)} 
              />
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 h-10 border border-slate-100 dark:border-slate-800/50 rounded-md px-3 bg-white dark:bg-slate-900/50">
                <input
                  type="checkbox"
                  id="isFilterable"
                  checked={isFilterable}
                  onChange={(e) => setIsFilterable(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
                <Label htmlFor="isFilterable" className="text-sm font-medium cursor-pointer select-none">
                  Hiển thị trong bộ lọc (Filter)
                </Label>
              </div>
            </div>
          </CardContent>
          
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 rounded-b-lg flex justify-end gap-3">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={() =>{  router.push('/admin/attribute-groups'); }}
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

      <AttributeTermsManager groupId={id as Id<"attributeGroups">} />
    </div>
  );
}

function AttributeTermsManager({ groupId }: { groupId: Id<"attributeGroups"> }) {
  const terms = useQuery(api.attributeTerms.listByGroup, { groupId });
  const createTerm = useMutation(api.attributeTerms.create);
  const removeTerm = useMutation(api.attributeTerms.remove);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [order, setOrder] = useState('0');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      await createTerm({
        groupId,
        name: name.trim(),
        slug: slug.trim(),
        order: parseInt(order) || 0,
        active: true,
      });
      setName('');
      setSlug('');
      setOrder('0');
      toast.success('Đã thêm giá trị thuộc tính');
    } catch (error) {
      toast.error(getAdminMutationErrorMessage(error, 'Lỗi khi thêm giá trị thuộc tính'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async (id: Id<"attributeTerms">) => {
    if (!confirm('Bạn có chắc chắn muốn xóa giá trị này?')) return;
    try {
      await removeTerm({ id });
      toast.success('Đã xóa giá trị thuộc tính');
    } catch (error) {
      toast.error(getAdminMutationErrorMessage(error, 'Lỗi khi xóa giá trị thuộc tính'));
    }
  };

  if (terms === undefined) return <div className="text-center py-4"><Loader2 className="animate-spin mx-auto text-slate-400" /></div>;

  return (
    <Card className="max-w-4xl mx-auto md:mx-0 mt-8">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800">
        <h2 className="text-lg font-semibold">Các giá trị thuộc tính</h2>
      </div>
      <CardContent className="p-6">
        <form onSubmit={handleCreate} className="flex gap-4 items-end mb-6">
          <div className="space-y-1 flex-1">
            <Label className="text-xs">Tên giá trị</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="VD: Đỏ, XL..." />
          </div>
          <div className="space-y-1 flex-1">
            <Label className="text-xs">Slug</Label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="do, xl..." className="font-mono" />
          </div>
          <div className="space-y-1 w-24">
            <Label className="text-xs">Thứ tự</Label>
            <Input type="number" value={order} onChange={(e) => setOrder(e.target.value)} />
          </div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'Thêm'}
          </Button>
        </form>

        <div className="space-y-2">
          {terms.length === 0 ? (
            <p className="text-slate-500 text-sm italic">Chưa có giá trị nào.</p>
          ) : (
            terms.map(term => (
              <div key={term._id} className="flex justify-between items-center p-3 border border-slate-100 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                <div>
                  <div className="font-medium">{term.name}</div>
                  <div className="text-xs text-slate-500 font-mono">{term.slug}</div>
                </div>
                <div className="flex gap-4 items-center">
                  <div className="text-sm text-slate-500">Thứ tự: {term.order}</div>
                  <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleRemove(term._id)}>Xóa</Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
