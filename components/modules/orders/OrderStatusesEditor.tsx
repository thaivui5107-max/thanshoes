'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, cn } from '@/app/admin/components/ui';
import type { OrderStatusConfig } from '@/lib/orders/statuses';
import { AlertCircle, Trash2, Undo2 } from 'lucide-react';

interface OrderStatusesEditorProps {
  statuses: OrderStatusConfig[];
  onChange: (statuses: OrderStatusConfig[]) => void;
}

const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

export function OrderStatusesEditor({ statuses, onChange }: OrderStatusesEditorProps) {
  // Trạng thái xác nhận xóa cho từng hàng (key -> true/false)
  const [deleteConfirms, setDeleteConfirms] = useState<Record<string, boolean>>({});
  // Hỗ trợ Undo cho trạng thái vừa xóa
  const [lastDeleted, setLastDeleted] = useState<{ status: OrderStatusConfig; index: number } | null>(null);

  const handleAdd = () => {
    onChange([
      ...statuses,
      { key: `status-${Date.now()}`, label: '', color: '#64748b', step: 1, isFinal: false, allowCancel: false },
    ]);
  };

  const handleRemoveClick = (key: string, index: number) => {
    if (deleteConfirms[key]) {
      const statusToRemove = statuses[index];
      setLastDeleted({ status: statusToRemove, index });
      onChange(statuses.filter((_, idx) => idx !== index));
      setDeleteConfirms((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } else {
      setDeleteConfirms((prev) => ({ ...prev, [key]: true }));
    }
  };

  // Tự động reset confirmation sau 4 giây
  useEffect(() => {
    const activeKeys = Object.keys(deleteConfirms).filter((k) => deleteConfirms[k]);
    if (activeKeys.length === 0) return;

    const timer = setTimeout(() => {
      setDeleteConfirms({});
    }, 4000);

    return () => clearTimeout(timer);
  }, [deleteConfirms]);

  const handleUndo = () => {
    if (!lastDeleted) return;
    const nextStatuses = [...statuses];
    nextStatuses.splice(lastDeleted.index, 0, lastDeleted.status);
    onChange(nextStatuses);
    setLastDeleted(null);
  };

  const handleUpdate = (index: number, patch: Partial<OrderStatusConfig>) => {
    onChange(statuses.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  };

  // Kiểm tra trùng Key
  const duplicateKeys = useMemo(() => {
    const counts: Record<string, number> = {};
    statuses.forEach((s) => {
      const key = s.key.trim();
      if (key) counts[key] = (counts[key] || 0) + 1;
    });
    return new Set(Object.keys(counts).filter((key) => counts[key] > 1));
  }, [statuses]);

  // Kiểm tra xem có tối thiểu 1 trạng thái chưa hoàn thành không
  const hasNonFinal = useMemo(() => statuses.some((s) => !s.isFinal), [statuses]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Định nghĩa Tiến trình Trạng thái</p>
          <p className="text-xs text-slate-500">Thiết lập các trạng thái để theo dõi vòng đời đơn hàng</p>
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
            + Thêm trạng thái
          </Button>
        </div>
      </div>

      {statuses.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500 dark:border-slate-800">
          Chưa có trạng thái nào được thiết lập. Hãy click Thêm trạng thái.
        </div>
      ) : (
        <>
          {statuses.length > 0 && !hasNonFinal && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-800 dark:text-rose-400 flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>Cảnh báo: Danh sách trạng thái cần có tối thiểu một trạng thái chưa hoàn thành (isFinal = false) để làm điểm khởi tạo đơn hàng.</span>
            </div>
          )}

          {/* BẢN DESKTOP: TABLE */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            <Table>
              <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                <TableRow>
                  <TableHead className="text-xs font-semibold w-1/5">Mã trạng thái</TableHead>
                  <TableHead className="text-xs font-semibold w-1/4">Tên hiển thị</TableHead>
                  <TableHead className="text-xs font-semibold w-1/4">Màu sắc</TableHead>
                  <TableHead className="text-xs font-semibold w-16">Bước</TableHead>
                  <TableHead className="text-xs font-semibold text-center w-20">Kết thúc</TableHead>
                  <TableHead className="text-xs font-semibold text-center w-20">Khách hủy</TableHead>
                  <TableHead className="text-xs font-semibold text-right w-24">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statuses.map((status, index) => {
                  const isKeyEmpty = !status.key.trim();
                  const isLabelEmpty = !status.label.trim();
                  const isDuplicate = duplicateKeys.has(status.key.trim());
                  const isColorInvalid = !HEX_COLOR_REGEX.test(status.color.trim());
                  const isStepInvalid = !Number.isInteger(status.step) || status.step < 1 || status.step > 4;
                  const hasError = isKeyEmpty || isLabelEmpty || isDuplicate || isColorInvalid || isStepInvalid;

                  return (
                    <TableRow key={`${status.key || 'status'}-${index}`} className={cn(hasError && "bg-rose-50/20 dark:bg-rose-950/5")}>
                      <TableCell className="p-3">
                        <div className="space-y-1">
                          <Input
                            placeholder="Pending, Shipped..."
                            value={status.key}
                            onChange={(event) => handleUpdate(index, { key: event.target.value.replace(/\s+/g, '') })}
                            className={cn((isKeyEmpty || isDuplicate) && "border-rose-500 focus-visible:ring-rose-500")}
                          />
                          {isKeyEmpty && (
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
                            placeholder="Chờ xử lý, Đang giao..."
                            value={status.label}
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
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={HEX_COLOR_REGEX.test(status.color) ? status.color : '#64748b'}
                              onChange={(event) => handleUpdate(index, { color: event.target.value })}
                              className="h-8 w-10 shrink-0 cursor-pointer rounded border border-slate-200 dark:border-slate-800"
                            />
                            <Input
                              value={status.color}
                              onChange={(event) => handleUpdate(index, { color: event.target.value })}
                              className={cn("font-mono text-xs", isColorInvalid && "border-rose-500 focus-visible:ring-rose-500")}
                            />
                          </div>
                          {isColorInvalid && (
                            <span className="text-[10px] text-rose-500 flex items-center gap-1">
                              <AlertCircle size={10} /> Định dạng Hex sai (ví dụ: #64748b)
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="p-3">
                        <div className="space-y-1">
                          <Input
                            type="number"
                            min={1}
                            max={4}
                            value={Number.isFinite(status.step) ? status.step : 1}
                            onChange={(event) => handleUpdate(index, { step: Number(event.target.value || 1) })}
                            className={cn("w-16 text-center", isStepInvalid && "border-rose-500 focus-visible:ring-rose-500")}
                          />
                          {isStepInvalid && (
                            <span className="text-[10px] text-rose-500 block text-center">Step 1-4</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={status.isFinal}
                          onChange={(event) => handleUpdate(index, { isFinal: event.target.checked })}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={status.allowCancel}
                          onChange={(event) => handleUpdate(index, { allowCancel: event.target.checked })}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="p-3 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveClick(status.key, index)}
                          className={cn(
                            "text-xs transition-colors h-9 px-3",
                            deleteConfirms[status.key]
                              ? "bg-rose-600 hover:bg-rose-500 text-white font-bold animate-pulse"
                              : "text-slate-500 hover:text-rose-600 hover:bg-rose-50/50"
                          )}
                        >
                          {deleteConfirms[status.key] ? 'Xác nhận?' : <Trash2 size={14} />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* BẢN MOBILE: CARDS */}
          <div className="block md:hidden space-y-4">
            {statuses.map((status, index) => {
              const isKeyEmpty = !status.key.trim();
              const isLabelEmpty = !status.label.trim();
              const isDuplicate = duplicateKeys.has(status.key.trim());
              const isColorInvalid = !HEX_COLOR_REGEX.test(status.color.trim());
              const isStepInvalid = !Number.isInteger(status.step) || status.step < 1 || status.step > 4;
              const hasError = isKeyEmpty || isLabelEmpty || isDuplicate || isColorInvalid || isStepInvalid;

              return (
                <div
                  key={`${status.key || 'status'}-${index}`}
                  className={cn(
                    "p-4 rounded-xl border space-y-3 bg-white dark:bg-slate-950 transition-colors",
                    hasError
                      ? "border-rose-300 bg-rose-50/5 dark:border-rose-900/50"
                      : "border-slate-200 dark:border-slate-800"
                  )}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-emerald-600">Trạng thái #{index + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveClick(status.key, index)}
                      className={cn(
                        "text-xs h-8 px-3 font-semibold",
                        deleteConfirms[status.key]
                          ? "bg-rose-600 text-white animate-pulse rounded-md"
                          : "text-rose-500 hover:bg-rose-50/50"
                      )}
                    >
                      {deleteConfirms[status.key] ? 'Xác nhận xóa?' : 'Xóa'}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-500 block">Mã trạng thái (Key)</label>
                      <Input
                        placeholder="Mã (ví dụ: Pending, Shipped...)"
                        value={status.key}
                        onChange={(event) => handleUpdate(index, { key: event.target.value.replace(/\s+/g, '') })}
                        className={cn((isKeyEmpty || isDuplicate) && "border-rose-500 focus-visible:ring-rose-500")}
                      />
                      {isKeyEmpty && (
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
                        placeholder="Chờ xử lý, Đang giao..."
                        value={status.label}
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
                      <label className="text-[10px] font-semibold text-slate-500 block">Màu sắc hiển thị</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={HEX_COLOR_REGEX.test(status.color) ? status.color : '#64748b'}
                          onChange={(event) => handleUpdate(index, { color: event.target.value })}
                          className="h-9 w-10 shrink-0 cursor-pointer rounded border border-slate-200 dark:border-slate-800"
                        />
                        <Input
                          value={status.color}
                          onChange={(event) => handleUpdate(index, { color: event.target.value })}
                          className={cn("font-mono text-xs", isColorInvalid && "border-rose-500 focus-visible:ring-rose-500")}
                        />
                      </div>
                      {isColorInvalid && (
                        <span className="text-[10px] text-rose-500 flex items-center gap-1">
                          <AlertCircle size={10} /> Định dạng Hex sai (ví dụ: #64748b)
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-2 items-center">
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-slate-500 block">Bước (1-4)</label>
                        <Input
                          type="number"
                          min={1}
                          max={4}
                          value={Number.isFinite(status.step) ? status.step : 1}
                          onChange={(event) => handleUpdate(index, { step: Number(event.target.value || 1) })}
                          className={cn("text-center", isStepInvalid && "border-rose-500 focus-visible:ring-rose-500")}
                        />
                      </div>

                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[9px] font-semibold text-slate-500 block">Cột mốc hoàn thành</span>
                        <input
                          type="checkbox"
                          checked={status.isFinal}
                          onChange={(event) => handleUpdate(index, { isFinal: event.target.checked })}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </div>

                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[9px] font-semibold text-slate-500 block">Cho khách hủy đơn</span>
                        <input
                          type="checkbox"
                          checked={status.allowCancel}
                          onChange={(event) => handleUpdate(index, { allowCancel: event.target.checked })}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </div>
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
