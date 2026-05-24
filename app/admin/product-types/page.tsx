'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { ChevronDown, Edit, FolderTree, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge, Button, Card, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui';
import { BulkActionBar, ColumnToggle, generatePaginationItems, SelectCheckbox, SortableHeader, useSortableData } from '../components/TableUtilities';
import { ModuleGuard } from '../components/ModuleGuard';
import { DeleteConfirmDialog } from '../components/DeleteConfirmDialog';
import { usePersistedPageSize } from '../components/usePersistedPageSize';

export default function ProductTypesListPage() {
  return (
    <ModuleGuard moduleKey="products">
      <ProductTypesContent />
    </ModuleGuard>
  );
}

function ProductTypesContent() {
  const productsData = useQuery(api.products.listAll, { limit: 1000 });
  const deleteType = useMutation(api.productTypes.remove);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string | null; direction: 'asc' | 'desc' }>({ direction: 'asc', key: null });
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    if (typeof window === 'undefined') {
      return [];
    }
    try {
      const stored = window.localStorage.getItem('admin_product_types_visible_columns');
      if (stored) {
        const parsed = JSON.parse(stored) as string[];
        return parsed.length > 0 ? parsed : [];
      }
    } catch {
      return [];
    }
    return [];
  });
  const [manualSelectedIds, setManualSelectedIds] = useState<Id<"productTypes">[]>([]);
  const [selectionMode, setSelectionMode] = useState<'manual' | 'all'>('manual');
  const [currentPage, setCurrentPage] = useState(1);
  const [resolvedPageSize, setPageSizeOverride] = usePersistedPageSize('admin_product_types_page_size', 20);
  const [deleteTargetId, setDeleteTargetId] = useState<Id<"productTypes"> | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);

  const isSelectAllActive = selectionMode === 'all';

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => { clearTimeout(timer); };
  }, [searchTerm]);

  useEffect(() => {
    if (visibleColumns.length > 0) {
      window.localStorage.setItem('admin_product_types_visible_columns', JSON.stringify(visibleColumns));
    }
  }, [visibleColumns]);

  const offset = (currentPage - 1) * resolvedPageSize;

  const typesData = useQuery(api.productTypes.listAdminWithOffset, {
    limit: resolvedPageSize,
    offset,
    search: debouncedSearchTerm.trim() ? debouncedSearchTerm.trim() : undefined,
  });

  const deleteInfo = useQuery(
    api.productTypes.getDeleteInfo,
    deleteTargetId ? { id: deleteTargetId } : 'skip'
  );

  const totalCountData = useQuery(api.productTypes.countAdmin, {
    search: debouncedSearchTerm.trim() ? debouncedSearchTerm.trim() : undefined,
  });

  // Since productTypes doesn't have listAdminIds, we just use listAll if "select all" is needed
  // It's usually a small list anyway
  const allTypesData = useQuery(
    api.productTypes.listAll,
    isSelectAllActive ? {} : 'skip'
  );

  const isTableLoading = typesData === undefined || totalCountData === undefined || productsData === undefined;

  const productCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    productsData?.forEach(product => {
      if (product.productTypeId) {
        map[product.productTypeId] = (map[product.productTypeId] || 0) + 1;
      }
    });
    return map;
  }, [productsData]);

  const types = useMemo(() => typesData?.map(t => ({
      ...t,
      id: t._id,
      count: productCountMap[t._id] || 0,
    })) ?? [], [typesData, productCountMap]);

  const columns = [
    { key: 'select', label: 'Chọn' },
    { key: 'name', label: 'Loại sản phẩm', required: true },
    { key: 'slug', label: 'Slug' },
    { key: 'count', label: 'Số sản phẩm' },
    { key: 'status', label: 'Trạng thái' },
    { key: 'actions', label: 'Hành động', required: true }
  ];
  const resolvedVisibleColumns = visibleColumns.length > 0 ? visibleColumns : columns.map(c => c.key);

  const handleSort = (key: string) => {
    setSortConfig(prev => ({ direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc', key }));
    setCurrentPage(1);
    applyManualSelection([]);
  };

  const sortedData = useSortableData(types, sortConfig);

  const totalCount = totalCountData?.count ?? 0;
  const totalPages = totalCount ? Math.ceil(totalCount / resolvedPageSize) : 1;
  const paginatedData = sortedData;
  const tableColumnCount = resolvedVisibleColumns.length;
  
  let selectedIds = manualSelectedIds;
  if (isSelectAllActive && allTypesData) {
    const filteredAllIds = allTypesData
      .filter(t => !debouncedSearchTerm || t.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) || t.slug.toLowerCase().includes(debouncedSearchTerm.toLowerCase()))
      .map(t => t._id);
    selectedIds = filteredAllIds;
  }
  const isSelectingAll = isSelectAllActive && allTypesData === undefined;

  const applyManualSelection = (nextIds: Id<"productTypes">[]) => {
    setSelectionMode('manual');
    setManualSelectedIds(nextIds);
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setDebouncedSearchTerm('');
    setCurrentPage(1);
    setPageSizeOverride(null);
    applyManualSelection([]);
  };

  const selectedOnPage = paginatedData.filter(t => selectedIds.includes(t.id as Id<"productTypes">));
  const isPageSelected = paginatedData.length > 0 && selectedOnPage.length === paginatedData.length;
  const isPageIndeterminate = selectedOnPage.length > 0 && selectedOnPage.length < paginatedData.length;

  const toggleSelectAll = () => {
    if (isPageSelected) {
      const remaining = selectedIds.filter(id => !paginatedData.some(t => t.id === id));
      applyManualSelection(remaining);
      return;
    }
    const next = new Set(selectedIds);
    paginatedData.forEach(t => next.add(t.id as Id<"productTypes">));
    applyManualSelection(Array.from(next));
  };
  const toggleSelectItem = (id: Id<"productTypes">) => {  
    const next = selectedIds.includes(id)
      ? selectedIds.filter(i => i !== id)
      : [...selectedIds, id];
    applyManualSelection(next);
  };

  const handleDelete = async (id: Id<"productTypes">) => {
    setDeleteTargetId(id);
    setIsDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) {return;}
    setIsDeleteLoading(true);
    try {
      await deleteType({ id: deleteTargetId });
      toast.success('Đã xóa loại sản phẩm thành công');
      setIsDeleteOpen(false);
      setDeleteTargetId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể xóa loại sản phẩm');
    } finally {
      setIsDeleteLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (confirm(`Xóa ${selectedIds.length} loại sản phẩm đã chọn? Các sản phẩm sử dụng loại này sẽ không bị xóa nhưng sẽ mất liên kết.`)) {
      try {
        for (const id of selectedIds) {
          await deleteType({ id });
        }
        applyManualSelection([]);
        toast.success(`Đã xóa ${selectedIds.length} loại sản phẩm`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Một số loại sản phẩm không thể xóa do có sản phẩm đang sử dụng');
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Loại sản phẩm</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Quản lý các loại sản phẩm và nhóm thuộc tính</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/product-types/create"><Button className="gap-2"><Plus size={16}/> Thêm loại</Button></Link>
        </div>
      </div>

      <BulkActionBar
        selectedCount={selectedIds.length}
        entityLabel="loại sản phẩm"
        selectionScope={isSelectAllActive ? 'all_results' : isPageSelected ? 'page' : 'partial'}
        pageItemCount={paginatedData.length}
        totalMatchingCount={totalCount}
        onSelectPage={() => { applyManualSelection(paginatedData.map(t => t.id as Id<"productTypes">)); }}
        onSelectAllResults={() => { setSelectionMode('all'); }}
        isSelectingAllResults={isSelectingAll}
        onDelete={handleBulkDelete}
        onClearSelection={() => { applyManualSelection([]); }}
      />
      
      <Card>
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex gap-4 flex-1">
            <div className="relative max-w-xs flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input placeholder="Tìm kiếm loại..." className="pl-9" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); applyManualSelection([]); }} />
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleResetFilters}>Xóa lọc</Button>
          <ColumnToggle columns={columns} visibleColumns={resolvedVisibleColumns} onToggle={(key) => {
            setVisibleColumns(prev => {
              const base = prev.length > 0 ? prev : columns.map(c => c.key);
              return base.includes(key) ? base.filter(col => col !== key) : [...base, key];
            });
          }} />
        </div>
        <Table>
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white dark:[&_th]:bg-slate-900">
            <TableRow>
              {resolvedVisibleColumns.includes('select') && (
                <TableHead className="w-[40px]">
                  <SelectCheckbox checked={isPageSelected} onChange={toggleSelectAll} indeterminate={isPageIndeterminate} />
                </TableHead>
              )}
              {resolvedVisibleColumns.includes('name') && <SortableHeader label="Loại sản phẩm" sortKey="name" sortConfig={sortConfig} onSort={handleSort} />}
              {resolvedVisibleColumns.includes('slug') && <SortableHeader label="Slug" sortKey="slug" sortConfig={sortConfig} onSort={handleSort} />}
              {resolvedVisibleColumns.includes('count') && <SortableHeader label="Số sản phẩm" sortKey="count" sortConfig={sortConfig} onSort={handleSort} className="text-center" />}
              {resolvedVisibleColumns.includes('status') && <SortableHeader label="Trạng thái" sortKey="status" sortConfig={sortConfig} onSort={handleSort} />}
              {resolvedVisibleColumns.includes('actions') && <TableHead className="text-right">Hành động</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isTableLoading ? (
              Array.from({ length: resolvedPageSize }).map((_, index) => (
                <TableRow key={`loading-${index}`}>
                  <TableCell colSpan={tableColumnCount}>
                    <div className="h-4 w-full rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <>
                {paginatedData.map(t => (
                  <TableRow key={t.id} className={selectedIds.includes(t.id) ? 'bg-orange-500/5' : ''}>
                {resolvedVisibleColumns.includes('select') && (
                  <TableCell><SelectCheckbox checked={selectedIds.includes(t.id)} onChange={() => { toggleSelectItem(t.id); }} /></TableCell>
                )}
                {resolvedVisibleColumns.includes('name') && (
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <FolderTree size={16} className="text-orange-500" />
                      {t.name}
                    </div>
                  </TableCell>
                )}
                {resolvedVisibleColumns.includes('slug') && <TableCell className="text-slate-500 font-mono text-sm">{t.slug}</TableCell>}
                {resolvedVisibleColumns.includes('count') && <TableCell className="text-center"><Badge variant="secondary">{t.count}</Badge></TableCell>}
                {resolvedVisibleColumns.includes('status') && (
                  <TableCell>
                    <Badge variant={t.active ? 'success' : 'secondary'}>{t.active ? 'Hoạt động' : 'Ẩn'}</Badge>
                  </TableCell>
                )}
                {resolvedVisibleColumns.includes('actions') && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/admin/product-types/${t.id}/edit`}><Button variant="ghost" size="icon"><Edit size={16}/></Button></Link>
                      <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600" onClick={ async () => handleDelete(t.id as Id<"productTypes">)}><Trash2 size={16}/></Button>
                    </div>
                  </TableCell>
                )}
                  </TableRow>
                ))}
              </>
            )}
            {!isTableLoading && paginatedData.length === 0 && (
              <TableRow>
                <TableCell colSpan={tableColumnCount} className="text-center py-8 text-slate-500">
                  {searchTerm ? 'Không tìm thấy kết quả phù hợp' : 'Chưa có loại sản phẩm nào.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {totalCount > 0 && !isTableLoading && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="order-2 flex w-full items-center justify-between text-sm text-slate-500 sm:order-1 sm:w-auto sm:justify-start sm:gap-6">
              <div className="flex items-center gap-2">
                <span className="text-slate-600">Hiển thị</span>
                <select
                  value={resolvedPageSize}
                  onChange={(event) => { setPageSizeOverride(Number(event.target.value)); setCurrentPage(1); applyManualSelection([]); }}
                  className="h-8 w-[70px] appearance-none rounded-md border border-slate-200 bg-white px-2 text-sm font-medium text-slate-900 shadow-sm focus:border-slate-300 focus:outline-none"
                  aria-label="Số dòng mỗi trang"
                >
                  {[10, 20, 30, 50, 100].map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
                <span>loại/trang</span>
              </div>

              <div className="text-right sm:text-left">
                <span className="font-medium text-slate-900">
                  {totalCount ? ((currentPage - 1) * resolvedPageSize) + 1 : 0}–{Math.min(currentPage * resolvedPageSize, totalCount)}
                </span>
                <span className="mx-1 text-slate-300">/</span>
                <span className="font-medium text-slate-900">
                  {totalCount}{totalCountData?.hasMore ? '+' : ''}
                </span>
                <span className="ml-1 text-slate-500">loại</span>
              </div>
            </div>

            <div className="order-1 flex w-full justify-center sm:order-2 sm:w-auto sm:justify-end">
              <nav className="flex items-center space-x-1 sm:space-x-2" aria-label="Phân trang">
                <button
                  onClick={() => { setCurrentPage((prev) => Math.max(1, prev - 1)); }}
                  disabled={currentPage === 1}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Trang trước"
                >
                  <ChevronDown className="h-4 w-4 rotate-90" />
                </button>

                {generatePaginationItems(currentPage, totalPages).map((item, index) => {
                  if (item === 'ellipsis') {
                    return (
                      <div key={`ellipsis-${index}`} className="flex h-8 w-8 items-center justify-center text-slate-400">
                        …
                      </div>
                    );
                  }

                  const pageNum = item as number;
                  const isActive = pageNum === currentPage;
                  const isMobileHidden = !isActive && pageNum !== 1 && pageNum !== totalPages;

                  return (
                    <button
                      key={pageNum}
                      onClick={() => { setCurrentPage(pageNum); }}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm transition-all duration-200 ${
                        isActive
                          ? 'bg-orange-600 text-white shadow-sm border font-medium'
                          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                      } ${isMobileHidden ? 'hidden sm:inline-flex' : ''}`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  onClick={() => { setCurrentPage((prev) => Math.min(totalPages, prev + 1)); }}
                  disabled={currentPage >= totalPages}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Trang sau"
                >
                  <ChevronDown className="h-4 w-4 -rotate-90" />
                </button>
              </nav>
            </div>
          </div>
        )}
      </Card>
      <DeleteConfirmDialog
        open={isDeleteOpen}
        onOpenChange={(open) => {
          setIsDeleteOpen(open);
          if (!open) {setDeleteTargetId(null);}
        }}
        title="Xóa loại sản phẩm"
        itemName={types.find((t) => t.id === deleteTargetId)?.name ?? 'loại sản phẩm'}
        dependencies={deleteInfo?.dependencies ?? []}
        onConfirm={async () => handleConfirmDelete()}
        isLoading={isDeleteLoading}
      />
    </div>
  );
}
