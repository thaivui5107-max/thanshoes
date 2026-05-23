"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Button, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui";
import { Trash2, Wand2, Plus, AlertTriangle, X } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";

// Define Types
export type VariantOption = { name: string; values: string[] };
export type VariantRow = {
  id?: string;
  sku: string;
  price: number;
  salePrice?: number;
  stock: number;
  optionValues: string[];
};

interface InlineMatrixBuilderProps {
  baseSku: string;
  basePrice: number;
  initialOptions?: VariantOption[];
  initialVariants?: VariantRow[];
  onChange: (options: VariantOption[], variants: VariantRow[]) => void;
}

export function InlineMatrixBuilder({
  baseSku,
  basePrice,
  initialOptions = [],
  initialVariants = [],
  onChange
}: InlineMatrixBuilderProps) {
  const [options, setOptions] = useState<VariantOption[]>(initialOptions);
  const [variants, setVariants] = useState<VariantRow[]>(initialVariants);
  
  // 2-step delete confirmation state
  const [variantToDelete, setVariantToDelete] = useState<VariantRow | null>(null);
  
  // Check if variant has orders using Convex
  // We can't safely call useQuery conditionally per row, so we just use the API dynamically
  // Or fetch orders logic on demand. For simplicity, we just assume it's risky.
  // We'll call `removeVariantWithCascade` which handles cascade.
  const removeVariantAPI = useMutation(api.productsSmart.removeVariantWithCascade);

  // Auto-generate variants whenever Options change
  useEffect(() => {
    if (options.length === 0) {
      // If no options, variants should be empty
      if (variants.length > 0) {
         setVariants([]);
         onChange(options, []);
      }
      return;
    }

    // Cartesian product
    const generateCombinations = (opts: VariantOption[]): string[][] => {
      const result: string[][] = [];
      const helper = (arr: string[], i: number) => {
        if (i === opts.length) {
          result.push([...arr]);
          return;
        }
        if (opts[i].values.length === 0) {
          // If this option has no values yet, just skip it or pass null
          helper(arr, i + 1);
        } else {
          for (let j = 0; j < opts[i].values.length; j++) {
            arr.push(opts[i].values[j]);
            helper(arr, i + 1);
            arr.pop();
          }
        }
      };
      helper([], 0);
      return result;
    };

    const combinations = generateCombinations(options);
    
    if (combinations.length === 0 || combinations[0].length === 0) {
       // All options are empty
       setVariants([]);
       onChange(options, []);
       return;
    }

    // Map new combinations to existing variants to preserve inputted price/stock
    const newVariants: VariantRow[] = combinations.map((combo, idx) => {
      const comboKey = combo.join("-");
      // Find if we already have this combo
      const existing = variants.find(v => v.optionValues.join("-") === comboKey);
      if (existing) return existing;
      
      return {
        sku: "", // Will be filled by magic wand
        price: basePrice,
        stock: 0,
        optionValues: combo,
      };
    });

    // Only update if it changed
    if (JSON.stringify(newVariants) !== JSON.stringify(variants)) {
      setVariants(newVariants);
      onChange(options, newVariants);
    }
  }, [options, basePrice]);

  // Handle Option Changes
  const addOption = () => {
    setOptions([...options, { name: "", values: [] }]);
  };

  const updateOptionName = (idx: number, name: string) => {
    const newOpts = [...options];
    newOpts[idx].name = name;
    setOptions(newOpts);
  };

  const addOptionValue = (idx: number, val: string) => {
    if (!val.trim()) return;
    const newOpts = [...options];
    if (!newOpts[idx].values.includes(val.trim())) {
      newOpts[idx].values.push(val.trim());
      setOptions(newOpts);
    }
  };

  const removeOptionValue = (optIdx: number, valIdx: number) => {
    const newOpts = [...options];
    newOpts[optIdx].values.splice(valIdx, 1);
    // If no values left, maybe remove option? Or keep it empty.
    setOptions(newOpts);
  };

  const removeOption = (idx: number) => {
    const newOpts = [...options];
    newOpts.splice(idx, 1);
    setOptions(newOpts);
  };

  // Magic Wand
  const handleMagicWand = () => {
    const safeBaseSku = baseSku.trim() || "SP";
    const newVariants = variants.map(v => {
      const suffix = v.optionValues.map(val => {
        // e.g. "Đen" -> "DEN", "XL" -> "XL"
        return val.toUpperCase().replace(/\s+/g, "").substring(0, 3);
      }).join("-");
      return { ...v, sku: `${safeBaseSku}-${suffix}` };
    });
    setVariants(newVariants);
    onChange(options, newVariants);
    toast.success("Đã tự động sinh SKU cho toàn bộ biến thể!");
  };

  // Inline Variant Field Edit
  const updateVariantField = (idx: number, field: keyof VariantRow, value: any) => {
    const newVars = [...variants];
    newVars[idx] = { ...newVars[idx], [field]: value };
    setVariants(newVars);
    onChange(options, newVars);
  };

  // Delete Variant
  const handleDeleteVariantClick = (variant: VariantRow) => {
    if (!variant.id) {
      // It's a new variant, just remove it locally
      const newVars = variants.filter(v => v !== variant);
      setVariants(newVars);
      onChange(options, newVars);
    } else {
      // Existing variant: ask for 2-step confirmation
      setVariantToDelete(variant);
    }
  };

  const confirmDeleteVariant = async () => {
    if (!variantToDelete?.id) return;
    
    try {
      await removeVariantAPI({ variantId: variantToDelete.id as Id<"productVariants"> });
      
      const newVars = variants.filter(v => v.id !== variantToDelete.id);
      setVariants(newVars);
      onChange(options, newVars);
      toast.success("Đã xóa biến thể và dọn dẹp các dữ liệu liên quan.");
    } catch (error) {
      toast.error("Lỗi khi xóa biến thể.");
    } finally {
      setVariantToDelete(null);
    }
  };

  return (
    <div className="space-y-6 border rounded-lg p-6 bg-slate-50">
      <div>
        <h3 className="text-lg font-medium">Thuộc tính Sản phẩm (Tùy chọn)</h3>
        <p className="text-sm text-muted-foreground">Thêm màu sắc, kích thước, chất liệu...</p>
      </div>

      {/* Options Builder */}
      <div className="space-y-4">
        {options.map((opt, oIdx) => (
          <div key={oIdx} className="flex flex-col md:flex-row gap-4 items-start p-4 bg-white border rounded-md shadow-sm">
            <div className="w-full md:w-1/3">
              <Input 
                placeholder="Tên thuộc tính (VD: Màu sắc)" 
                value={opt.name} 
                onChange={(e) => updateOptionName(oIdx, e.target.value)}
              />
            </div>
            <div className="flex-1 w-full flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                {opt.values.map((v, vIdx) => (
                  <span key={vIdx} className="px-3 py-1 bg-slate-100 border rounded-full text-sm flex items-center gap-1">
                    {v}
                    <X className="w-3 h-3 cursor-pointer text-slate-400 hover:text-red-500" onClick={() => removeOptionValue(oIdx, vIdx)} />
                  </span>
                ))}
              </div>
              <Input 
                placeholder="Thêm giá trị và nhấn Enter (VD: Đen)" 
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addOptionValue(oIdx, e.currentTarget.value);
                    e.currentTarget.value = "";
                  }
                }}
              />
            </div>
            <Button variant="ghost" size="icon" className="text-red-500 mt-1 md:mt-0" onClick={() => removeOption(oIdx)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}

        <Button type="button" variant="outline" onClick={addOption} className="gap-2">
          <Plus className="w-4 h-4" /> Thêm Thuộc Tính
        </Button>
      </div>

      {/* Matrix Table */}
      {variants.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-slate-700">Bảng Biến Thể ({variants.length})</h4>
          </div>
          
          <div className="border rounded-md bg-white overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-[150px]">Phân loại</TableHead>
                  <TableHead>
                    <div className="flex items-center gap-2">
                      SKU
                      <Button type="button" size="sm" variant="secondary" onClick={handleMagicWand} className="h-7 px-2 text-xs font-semibold text-purple-600 bg-purple-100 hover:bg-purple-200">
                        <Wand2 className="w-3 h-3 mr-1" /> Tự sinh SKU
                      </Button>
                    </div>
                  </TableHead>
                  <TableHead className="w-[150px]">Giá bán</TableHead>
                  <TableHead className="w-[150px]">Giá kho</TableHead>
                  <TableHead className="w-[120px]">Tồn kho</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {variants.map((v, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">
                      {v.optionValues.join(" • ")}
                    </TableCell>
                    <TableCell>
                      <Input 
                        value={v.sku} 
                        onChange={(e) => updateVariantField(idx, "sku", e.target.value)}
                        placeholder="VD: SP-DEN-39"
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="number"
                        value={v.price || ""} 
                        onChange={(e) => updateVariantField(idx, "price", parseFloat(e.target.value))}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="number"
                        value={v.salePrice || ""} 
                        onChange={(e) => updateVariantField(idx, "salePrice", parseFloat(e.target.value))}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="number"
                        value={v.stock || ""} 
                        onChange={(e) => updateVariantField(idx, "stock", parseInt(e.target.value))}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Button type="button" variant="ghost" size="icon" onClick={() => handleDeleteVariantClick(v)}>
                        <Trash2 className="w-4 h-4 text-red-400 hover:text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* 2-Step Confirmation Dialog */}
      <Dialog open={!!variantToDelete} onOpenChange={() => setVariantToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" /> Cảnh báo quan trọng!
            </DialogTitle>
            <DialogDescription className="text-slate-700">
              Bạn đang yêu cầu <b>xóa vĩnh viễn (Hard Delete)</b> biến thể <b>{variantToDelete?.optionValues.join(" - ")}</b>.
              <br/><br/>
              Hệ thống sẽ <b>tự động dọn dẹp</b> các Giỏ hàng (Carts) và Danh sách yêu thích (Wishlist) đang chứa biến thể này.
              Lịch sử Đơn hàng (Orders) vẫn sẽ được giữ lại an toàn.
              <br/><br/>
              Bạn có chắc chắn muốn xóa không? Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVariantToDelete(null)}>Hủy</Button>
            <Button onClick={confirmDeleteVariant} className="bg-red-600 hover:bg-red-700 text-white">
              Vẫn xóa vĩnh viễn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
