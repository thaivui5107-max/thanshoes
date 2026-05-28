import * as ExcelJS from "exceljs";
import { ExcelImportAdapter, CompatibilityIssue } from "./excel-adapter.interface";
import type { ProductModuleConfig, ExcelOptionDef } from "@/lib/excel/product-schema-builder";
import type { ParsedProductRecord } from "@/app/admin/products/actions/excel-actions";

// Helper an toàn để lấy text từ Cell của ExcelJS, tránh lỗi no-base-to-string và hỗ trợ Rich Text / Hyperlink
function getCellText(cell: ExcelJS.Cell): string {
  const val = cell.value;
  if (val === null || val === undefined) return "";
  if (typeof val === "object") {
    if ("richText" in val && Array.isArray(val.richText)) {
      return val.richText.map((t: any) => t.text || "").join("").trim();
    }
    if ("text" in val) {
      return String(val.text).trim();
    }
    if ("hyperlink" in val) {
      return String(val.hyperlink).trim();
    }
  }
  return String(val).trim();
}

export const SapoThanShoesAdapter: ExcelImportAdapter = {
  id: "sapo_thanshoes",
  name: "ThanShoes Sapo Excel",
  description: "Bộ chuyển đổi dữ liệu sản phẩm xuất từ hệ thống Sapo của ThanShoes.",

  detect(workbook: ExcelJS.Workbook): boolean {
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) return false;
    
    const row1 = worksheet.getRow(1);
    let hasSku = false;
    let hasProductName = false;
    
    row1.eachCell({ includeEmpty: true }, (cell) => {
      const val = getCellText(cell).toLowerCase();
      if (val === "mã sku" || val === "sku") hasSku = true;
      if (val === "tên sản phẩm") hasProductName = true;
    });

    // Đối chiếu thêm: Sheet đầu tiên thường không có tên là "SanPham" (chỉ có trong template hệ thống mới)
    return hasSku && hasProductName && worksheet.name !== "SanPham";
  },

  checkCompatibility(config: ProductModuleConfig): CompatibilityIssue[] {
    const issues: CompatibilityIssue[] = [];

    if (!config.hasVariants) {
      issues.push({
        key: "variantEnabled",
        label: "Phiên bản (variantEnabled = true)",
        expected: true,
        actual: false,
        description: "Yêu cầu bật tính năng Phiên bản để import các thuộc tính như kích cỡ (size)."
      });
    }

    if (config.priceStrategy !== "VARIANT_LEVEL") {
      issues.push({
        key: "variantPricing",
        label: "Giá bán cấp Phiên bản (variantPricing = variant)",
        expected: "VARIANT_LEVEL",
        actual: config.priceStrategy,
        description: "Yêu cầu quản lý giá ở cấp Phiên bản để import giá riêng biệt cho từng size."
      });
    }

    if (config.inventoryStrategy !== "VARIANT_LEVEL") {
      issues.push({
        key: "variantStock",
        label: "Tồn kho cấp Phiên bản (variantStock = variant)",
        expected: "VARIANT_LEVEL",
        actual: config.inventoryStrategy,
        description: "Yêu cầu quản lý tồn kho ở cấp Phiên bản để import số lượng tồn từng size."
      });
    }

    return issues;
  },

  async parse(
    workbook: ExcelJS.Workbook,
    config: ProductModuleConfig,
    options?: ExcelOptionDef[]
  ): Promise<ParsedProductRecord[]> {
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) throw new Error("Không tìm thấy worksheet hợp lệ");

    const recordsMap = new Map<string, ParsedProductRecord>();
    const rowCount = worksheet.rowCount;

    // Map cột động dựa trên tên header ở dòng 1
    const headerRow = worksheet.getRow(1);
    const colMap: Record<string, number> = {};
    
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const val = getCellText(cell).toLowerCase();
      if (val) colMap[val] = colNumber;
    });

    const getColIndex = (names: string[], defaultCol: number): number => {
      for (const name of names) {
        const lowerName = name.toLowerCase();
        if (colMap[lowerName]) return colMap[lowerName];
      }
      return defaultCol;
    };

    // Xác định cột động (nếu không map được, dùng fallback mặc định dựa trên cấu trúc Sapo ThanShoes cũ)
    const skuCol = getColIndex(["mã sku", "sku"], 14);      // N
    const nameCol = getColIndex(["tên sản phẩm"], 1);       // A
    const typeCol = getColIndex(["loại sản phẩm", "loại"], 3); // C
    const brandCol = getColIndex(["nhãn hiệu", "thương hiệu"], 5); // E
    const descCol = getColIndex(["mô tả", "mô tả sản phẩm"], 4); // D
    const sizeCol = getColIndex(["thuộc tính 1", "size", "kích cỡ"], 8); // H
    const priceCol = getColIndex(["giá bán lẻ", "giá bán"], 32); // AF
    const stockCol = getColIndex(["tồn kho", "tồn kho thực tế"], 27); // AA
    const imageCol = getColIndex(["ảnh đại diện", "đường dẫn ảnh", "ảnh biến thể"], 18); // R

    let currentProductName = "";
    let currentBrand = "";
    let currentType = "";
    let currentDesc = "";

    for (let r = 2; r <= rowCount; r++) {
      const row = worksheet.getRow(r);
      
      const skuVal = getCellText(row.getCell(skuCol));
      if (!skuVal) continue; // Bỏ qua dòng trống hoặc không có SKU

      // Đọc các thông tin chung của sản phẩm cha nếu có
      const nameVal = getCellText(row.getCell(nameCol));
      if (nameVal) {
        currentProductName = nameVal;
        currentType = getCellText(row.getCell(typeCol));
        currentBrand = getCellText(row.getCell(brandCol));
        currentDesc = getCellText(row.getCell(descCol));
      }

      // Sapo gom SKU biến thể là "SKUCHA-SIZE". Ta lấy SKUCHA làm SKU sản phẩm
      const skuParts = skuVal.split("-");
      const parentSku = skuParts[0];

      let parentRecord = recordsMap.get(parentSku);
      if (!parentRecord) {
        parentRecord = {
          sku: parentSku,
          name: currentProductName || parentSku,
          productType: "physical",
          imageUrl: getCellText(row.getCell(imageCol)) || undefined,
          variants: []
        };
        recordsMap.set(parentSku, parentRecord);
      }

      // Xử lý giá trị số (Giá & Tồn)
      const parseNumber = (cellVal: any): number => {
        if (cellVal === null || cellVal === undefined) return 0;
        const clean = cellVal.toString().replace(/[,.]/g, "");
        const num = Number(clean);
        return isNaN(num) ? 0 : num;
      };

      const priceVal = parseNumber(row.getCell(priceCol).value);
      const stockVal = parseNumber(row.getCell(stockCol).value);

      // Thêm biến thể
      parentRecord.variants.push({
        variantOption1: getCellText(row.getCell(sizeCol)) || undefined,
        price: priceVal,
        salePrice: priceVal,
        stock: stockVal,
        imageUrl: getCellText(row.getCell(imageCol)) || undefined,
      });
    }

    return Array.from(recordsMap.values());
  }
};
