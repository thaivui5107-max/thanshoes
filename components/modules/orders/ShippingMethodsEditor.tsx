'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, cn } from '@/app/admin/components/ui';
import { AlertCircle, Info, Trash2, Undo2 } from 'lucide-react';

export interface ShippingMethodConfig {
  id: string;
  label: string;
  description?: string;
  fee: number;
  estimate?: string;
  /** Ngưỡng đặt hàng tối thiểu (đ) để được miễn phí ship. 0 = không áp dụng */
  freeShipThreshold?: number;
}

interface ShippingMethodsEditorProps {
  methods: ShippingMethodConfig[];
  onChange: (methods: ShippingMethodConfig[]) => void;
}

export function ShippingMethodsEditor({ methods, onChange }: ShippingMethodsEditorProps) {
  // Trạng thái xác nhận xóa cho từng ID (id -> true/false)
  const [deleteConfirms, setDeleteConfirms] = useState<Record<string, boolean>>({});
  // Hỗ trợ Undo phương thức xóa gần nhất
  const [lastDeleted, setLastDeleted] = useState<{ method: ShippingMethodConfig; index: number } | null>(null);

  const handleAdd = () => {
    onChange([
      ...methods,
      { id: `shipping-${Date.now()}`, label: '', description: '', fee: 0, estimate: '', freeShipThreshold: 0 },
    ]);
  };

  const handleRemoveClick = (id: string, index: number) => {
    if (deleteConfirms[id]) {
      const methodToRemove = methods[index];
      setLastDeleted({ method: methodToRemove, index });
      onChange(methods.filter((_, idx) => idx !== index));
      setDeleteConfirms((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } else {
      setDeleteConfirms((prev) => ({ ...prev, [id]: true }));
    }
  };

  // Tự động reset trạng thái xác nhận xóa sau 4s
  useEffect(() => {
    const activeIds = Object.keys(deleteConfirms).filter((key) => deleteConfirms[key]);
    if (activeIds.length === 0) return;

    const timer = setTimeout(() => {
      setDeleteConfirms({});
    }, 4000);

    return () => clearTimeout(timer);
  }, [deleteConfirms]);

  const handleUndo = () => {
    if (!lastDeleted) return;
    const nextMethods = [...methods];
    nextMethods.splice(lastDeleted.index, 0, lastDeleted.method);
    onChange(nextMethods);
    setLastDeleted(null);
  };

  const handleUpdate = (index: number, patch: Partial<ShippingMethodConfig>) => {
    onChange(methods.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  };

  const duplicateIds = useMemo(() => {
    const counts: Record<string, number> = {};
    methods.forEach((m) => {
      const id = m.id.trim();
      if (id) counts[id] = (counts[id] || 0) + 1;
    });
    return new Set(Object.keys(counts).filter((id) => counts[id] > 1));
  }, [methods]);

  // Tóm tắt ưu đãi tốt nhất theo ngưỡng để admin dễ hiểu
  const bestDealSummary = useMemo(() => {
    const thresholds = methods
      .filter((m) => (m.freeShipThreshold ?? 0) > 0 && m.fee > 0)
      .sort((a, b) => (a.freeShipThreshold ?? 0) - (b.freeShipThreshold ?? 0));
    if (thresholds.length === 0) return null;
    return thresholds.map((m) => ({
      label: m.label || m.id,
      threshold: m.freeShipThreshold ?? 0,
      fee: m.fee,
    }));
  }, [methods]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Danh sách Hình thức Giao hàng</p>
          <p className="text-xs text-slate-500">Cấu hình các tùy chọn giao hàng và tính phí ship khi thanh toán</p>
        </div>
        <div className="flex items-center gap-2">
          {lastDeleted && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleUndo}
              className="text-xs flex items-center gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50"
            >
              <Undo2 size={12} />
              Hoàn tác xóa
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
            + Thêm hình thức
          </Button>
        </div>
      </div>

      {methods.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500 dark:border-slate-800">
          Chưa có hình thức vận chuyển nào được tạo. Khách mua hàng sẽ mặc định được miễn phí vận chuyển.
        </div>
      ) : (
        <>
          {/* Info: ưu đãi tốt nhất sẽ được auto-apply */}
          {bestDealSummary && bestDealSummary.length > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 text-xs text-emerald-800 dark:text-emerald-400">
              <Info size={14} className="shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold">Ưu đãi tốt nhất sẽ tự động áp dụng khi khách checkout:</p>
                {bestDealSummary.map((item) => (
                  <p key={item.label}>
                    • Đặt hàng ≥ <strong>{item.threshold.toLocaleString('vi-VN')}đ</strong>: <strong>{item.label}</strong> miễn phí ship (thường {item.fee.toLocaleString('vi-VN')}đ)
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* BẢN DESKTOP: TABLE */}
          <div className="hidden sm:block overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            <Table>
              <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                <TableRow>
                  <TableHead className="text-xs font-semibold w-1/5">Mã (ID)</TableHead>
                  <TableHead className="text-xs font-semibold w-1/5">Tên hiển thị</TableHead>
                  <TableHead className="text-xs font-semibold w-1/5">Mô tả</TableHead>
                  <TableHead className="text-xs font-semibold w-28">Phí ship (đ)</TableHead>
                  <TableHead className="text-xs font-semibold w-36">Free ship khi ≥ (đ)</TableHead>
                  <TableHead className="text-xs font-semibold w-28">Thời gian</TableHead>
                  <TableHead className="text-xs font-semibold text-right w-24">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {methods.map((method, index) => {
                  const isIdEmpty = !method.id.trim();
                  const isLabelEmpty = !method.label.trim();
                  const isDuplicate = duplicateIds.has(method.id.trim());
                  const isFeeInvalid = !Number.isFinite(method.fee) || method.fee < 0;
                  const hasError = isIdEmpty || isLabelEmpty || isDuplicate || isFeeInvalid;

                  return (
                    <TableRow key={`${method.id}-${index}`} className={cn(hasError && "bg-rose-50/20 dark:bg-rose-950/5")}>
                      <TableCell className="p-3">
                        <div className="space-y-1">
                          <Input
                            placeholder="Mã (ví dụ: standard, express...)"
                            value={method.id}
                            onChange={(event) => handleUpdate(index, { id: event.target.value.toLowerCase().replace(/\s+/g, '-') })}
                            className={cn((isIdEmpty || isDuplicate) && "border-rose-500 focus-visible:ring-rose-500")}
                          />
                          {isIdEmpty && (
                            <span className="text-[10px] text-rose-500 flex items-center gap-1">
                              <AlertCircle size={10} /> Mã không được rỗng
                            </span>
                          )}
                          {isDuplicate && (
                            <span className="text-[10px] text-rose-500 flex items-center gap-1">
                              <AlertCircle size={10} /> Mã bị trùng lặp
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="p-3">
                        <div className="space-y-1">
                          <Input
                            placeholder="Tên hiển thị khi checkout"
                            value={method.label}
                            onChange={(event) => handleUpdate(index, { label: event.target.value })}
                            className={cn(isLabelEmpty && "border-rose-500 focus-visible:ring-rose-500")}
                          />
                          {isLabelEmpty && (
                            <span className="text-[10px] text-rose-500 flex items-center gap-1">
                              <AlertCircle size={10} /> Tên không được rỗng
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="p-3">
                        <Input
                          placeholder="Mô tả hình thức giao hàng"
                          value={method.description ?? ''}
                          onChange={(event) => handleUpdate(index, { description: event.target.value })}
                        />
                      </TableCell>
                      <TableCell className="p-3">
                        <div className="space-y-1">
                          <Input
                            type="number"
                            placeholder="0"
                            value={Number.isFinite(method.fee) ? method.fee : 0}
                            onChange={(event) => handleUpdate(index, { fee: Number(event.target.value || 0) })}
                            className={cn(isFeeInvalid && "border-rose-500 focus-visible:ring-rose-500")}
                          />
                          {isFeeInvalid && (
                            <span className="text-[10px] text-rose-500 flex items-center gap-1">
                              <AlertCircle size={10} /> Phí ship phải &gt;= 0
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="p-3">
                        <Input
                          placeholder="ví dụ: 2-4 ngày"
                          value={method.estimate ?? ''}
                          onChange={(event) => handleUpdate(index, { estimate: event.target.value })}
                        />
                      </TableCell>
                      {/* Cột điều kiện free ship */}
                      <TableCell className="p-3">
                        <div className="space-y-1">
                          <Input
                            type="number"
                            placeholder="0 = không áp dụng"
                            min={0}
                            value={method.freeShipThreshold ?? 0}
                            onChange={(event) => handleUpdate(index, { freeShipThreshold: Number(event.target.value || 0) })}
                            className="text-sm"
                          />
                          {(method.freeShipThreshold ?? 0) > 0 && (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              ✓ Đơn ≥ {(method.freeShipThreshold ?? 0).toLocaleString('vi-VN')}đ → free ship
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="p-3 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveClick(method.id, index)}
                          className={cn(
                            "text-xs transition-colors h-9 px-3",
                            deleteConfirms[method.id]
                              ? "bg-rose-600 hover:bg-rose-500 text-white font-bold animate-pulse"
                              : "text-slate-500 hover:text-rose-600 hover:bg-rose-50/50"
                          )}
                        >
                          {deleteConfirms[method.id] ? 'Xác nhận?' : <Trash2 size={14} />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* BẢN MOBILE: CARDS */}
          <div className="block sm:hidden space-y-4">
            {methods.map((method, index) => {
              const isIdEmpty = !method.id.trim();
              const isLabelEmpty = !method.label.trim();
              const isDuplicate = duplicateIds.has(method.id.trim());
              const isFeeInvalid = !Number.isFinite(method.fee) || method.fee < 0;
              const hasError = isIdEmpty || isLabelEmpty || isDuplicate || isFeeInvalid;

              return (
                <div
                  key={`${method.id}-${index}`}
                  className={cn(
                    "p-4 rounded-xl border space-y-3 bg-white dark:bg-slate-950 transition-colors",
                    hasError
                      ? "border-rose-300 bg-rose-50/5 dark:border-rose-900/50"
                      : "border-slate-200 dark:border-slate-800"
                  )}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-emerald-600">Hình thức #{index + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveClick(method.id, index)}
                      className={cn(
                        "text-xs h-8 px-3 font-semibold",
                        deleteConfirms[method.id]
                          ? "bg-rose-600 text-white animate-pulse rounded-md"
                          : "text-rose-500 hover:bg-rose-50/50"
                      )}
                    >
                      {deleteConfirms[method.id] ? 'Xác nhận xóa?' : 'Xóa'}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-500 block">Mã hình thức (ID)</label>
                      <Input
                        placeholder="Mã (ví dụ: standard, express...)"
                        value={method.id}
                        onChange={(event) => handleUpdate(index, { id: event.target.value.toLowerCase().replace(/\s+/g, '-') })}
                        className={cn((isIdEmpty || isDuplicate) && "border-rose-500 focus-visible:ring-rose-500")}
                      />
                      {isIdEmpty && (
                        <span className="text-[10px] text-rose-500 flex items-center gap-1">
                          <AlertCircle size={10} /> Mã không được rỗng
                        </span>
                      )}
                      {isDuplicate && (
                        <span className="text-[10px] text-rose-500 flex items-center gap-1">
                          <AlertCircle size={10} /> Mã bị trùng lặp
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-500 block">Tên hiển thị</label>
                      <Input
                        placeholder="Tên hiển thị khi checkout"
                        value={method.label}
                        onChange={(event) => handleUpdate(index, { label: event.target.value })}
                        className={cn(isLabelEmpty && "border-rose-500 focus-visible:ring-rose-500")}
                      />
                      {isLabelEmpty && (
                        <span className="text-[10px] text-rose-500 flex items-center gap-1">
                          <AlertCircle size={10} /> Tên không được rỗng
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-500 block">Mô tả chi tiết</label>
                      <Input
                        placeholder="Mô tả phụ ngắn"
                        value={method.description ?? ''}
                        onChange={(event) => handleUpdate(index, { description: event.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-slate-500 block">Phí ship (đ)</label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={Number.isFinite(method.fee) ? method.fee : 0}
                          onChange={(event) => handleUpdate(index, { fee: Number(event.target.value || 0) })}
                          className={cn(isFeeInvalid && "border-rose-500 focus-visible:ring-rose-500")}
                        />
                        {isFeeInvalid && (
                          <span className="text-[10px] text-rose-500 flex items-center gap-1">
                            <AlertCircle size={10} /> Phí &gt;= 0
                          </span>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-slate-500 block">Thời gian ước tính</label>
                        <Input
                          placeholder="ví dụ: 2-4 ngày"
                          value={method.estimate ?? ''}
                          onChange={(event) => handleUpdate(index, { estimate: event.target.value })}
                        />
                      </div>
                    </div>

                    {/* Điều kiện miễn phí ship */}
                    <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                      <label className="text-[10px] font-semibold text-slate-500 block">
                        Miễn phí ship khi tổng đơn ≥ (đ)
                      </label>
                      <Input
                        type="number"
                        placeholder="0 = không áp dụng"
                        min={0}
                        value={method.freeShipThreshold ?? 0}
                        onChange={(event) => handleUpdate(index, { freeShipThreshold: Number(event.target.value || 0) })}
                      />
                      {(method.freeShipThreshold ?? 0) > 0 && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                          ✓ Đơn ≥ {(method.freeShipThreshold ?? 0).toLocaleString('vi-VN')}đ → free ship tự động
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
