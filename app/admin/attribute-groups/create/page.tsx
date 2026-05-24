'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getAdminMutationErrorMessage } from '@/app/admin/lib/mutation-error';
import { Button, Card, CardContent, Input, Label } from '../../components/ui';

export default function AttributeGroupCreatePage() {
  const router = useRouter();
  const createGroup = useMutation(api.attributeGroups.create);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [slug, setSlug] = useState('');
  const [filterType, setFilterType] = useState('single');
  const [inputType, setInputType] = useState('select');
  const [isFilterable, setIsFilterable] = useState(true);
  const [order, setOrder] = useState('0');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) {return;}

    setIsSubmitting(true);
    try {
      await createGroup({
        name: name.trim(),
        code: code.trim(),
        slug: slug.trim(),
        filterType,
        inputType,
        isFilterable,
        order: parseInt(order) || 0,
      });
      toast.success('Tạo nhóm thuộc tính thành công');
      router.push('/admin/attribute-groups');
    } catch (error) {
      toast.error(getAdminMutationErrorMessage(error, 'Không thể tạo nhóm thuộc tính'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Thêm nhóm thuộc tính</h1>
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
                onChange={handleNameChange} 
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
                placeholder="tu-dong-tao-tu-ten" 
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
              Tạo nhóm thuộc tính
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
