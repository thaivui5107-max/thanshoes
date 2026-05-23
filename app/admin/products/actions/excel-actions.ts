"use server";

import * as ExcelJS from "exceljs";
import { buildExcelColumns, ProductModuleConfig, ExcelColumnDef } from "@/lib/excel/product-schema-builder";

// ... (existing generateProductTemplateBase64)
export async function generateProductTemplateBase64(
  config: ProductModuleConfig,
  categories: { id: string; name: string }[]
): Promise<string> {
  const columnsDef = buildExcelColumns(config);
  const wb = new ExcelJS.Workbook();
  wb.creator = "SystemAdmin";
  wb.created = new Date();

  const refSheet = wb.addWorksheet("_Data_TuDien", { state: "hidden" });
  refSheet.getColumn(1).values = ["Categories", ...categories.map((c) => `${c.id} | ${c.name}`)];

  const mainSheet = wb.addWorksheet("SanPham", {
    views: [{ state: "frozen", xSplit: 0, ySplit: 3 }],
  });

  const row1 = mainSheet.getRow(1);
  const row2 = mainSheet.getRow(2);
  const row3 = mainSheet.getRow(3);

  let currentGroup = "";
  let groupStartCol = 1;

  columnsDef.forEach((col, index) => {
    const colNum = index + 1;
    row2.getCell(colNum).value = col.header;
    row3.getCell(colNum).value = col.microcopy || "";
    row1.getCell(colNum).value = col.group;

    if (col.group !== currentGroup) {
      if (currentGroup !== "" && groupStartCol < colNum) {
        try { mainSheet.mergeCells(1, groupStartCol, 1, colNum - 1); } catch (e) {}
      }
      currentGroup = col.group;
      groupStartCol = colNum;
    }

    mainSheet.getColumn(colNum).width = col.width;

    let bgColor = "FFFFFFFF";
    if (col.readOnly) bgColor = "FFE0E0E0";
    else if (col.required) bgColor = "FFFFF9C4";

    const columnObj = mainSheet.getColumn(colNum);
    columnObj.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber > 3) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
        if (col.readOnly) {
          cell.protection = { locked: true };
        }
      }
    });

    if (col.type === "dropdown") {
      let formula = "";
      if (col.key === "category") {
        formula = `_Data_TuDien!$A$2:$A$${categories.length + 1}`;
      } else if (col.dropdownValues) {
        formula = `"${col.dropdownValues.join(",")}"`;
      }
      if (formula) {
        for (let r = 4; r <= 1004; r++) {
          mainSheet.getCell(r, colNum).dataValidation = {
            type: "list",
            allowBlank: !col.required,
            formulae: [formula],
            showErrorMessage: true,
            errorTitle: "Lỗi nhập liệu",
            error: "Vui lòng chọn giá trị từ danh sách thả xuống.",
          };
        }
      }
    }
  });

  try { mainSheet.mergeCells(1, groupStartCol, 1, columnsDef.length); } catch (e) {}

  row1.height = 30;
  row1.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF424242" } };
    cell.font = { color: { argb: "FFFFFFFF" }, bold: true, size: 11 };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  row2.height = 25;
  row2.eachCell((cell, colNumber) => {
    const colDef = columnsDef[colNumber - 1];
    let headerColor = "FFE0E0E0";
    if (colDef.required) headerColor = "FFFF9800";
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerColor } };
    cell.font = { bold: true };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
  });

  row3.height = 20;
  row3.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } };
    cell.font = { italic: true, color: { argb: "FF757575" }, size: 9 };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });

  mainSheet.protect("admin_secret_123", {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: false,
    formatColumns: false,
    formatRows: false,
    insertColumns: false,
    insertRows: true,
    insertHyperlinks: true,
    deleteColumns: false,
    deleteRows: true,
    sort: true,
    autoFilter: true,
  });

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer).toString("base64");
}

export interface ParsedProductRecord {
  id?: string;
  sku: string;
  name?: string;
  categoryId?: string;
  productType?: "physical" | "digital";
  price?: number;
  salePrice?: number;
  stock?: number;
  digitalDeliveryType?: string;
  digitalData?: string;
  imageUrl?: string;
  variants: {
    variantOption1?: string;
    variantOption2?: string;
    price?: number;
    salePrice?: number;
    stock?: number;
  }[];
}

export async function parseProductExcelBase64(
  base64String: string,
  config: ProductModuleConfig
): Promise<{ success: boolean; data?: ParsedProductRecord[]; error?: string }> {
  try {
    const buffer = Buffer.from(base64String, "base64");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);

    const mainSheet = wb.getWorksheet("SanPham");
    if (!mainSheet) {
      return { success: false, error: "Không tìm thấy Sheet 'SanPham' trong file." };
    }

    const columnsDef = buildExcelColumns(config);
    const row2 = mainSheet.getRow(2);

    // STRICT MODE CHECK
    for (let i = 0; i < columnsDef.length; i++) {
      const expectedHeader = columnsDef[i].header;
      const actualHeader = row2.getCell(i + 1).value?.toString() || "";
      if (expectedHeader !== actualHeader) {
        return { 
          success: false, 
          error: `Cấu hình hệ thống đã thay đổi (Strict Mode). Cột mong đợi: '${expectedHeader}', Cột trong file: '${actualHeader}'. Vui lòng xuất lại Template mới.` 
        };
      }
    }

    const recordsMap = new Map<string, ParsedProductRecord>();
    const rowCount = mainSheet.rowCount;

    for (let r = 4; r <= rowCount; r++) {
      const row = mainSheet.getRow(r);
      const rowData: Record<string, any> = {};
      
      let isEmpty = true;
      columnsDef.forEach((col, index) => {
        const val = row.getCell(index + 1).value;
        if (val !== null && val !== undefined && val !== "") isEmpty = false;
        
        if (typeof val === "object" && val && "richText" in val) {
          rowData[col.key] = (val as any).richText.map((t: any) => t.text).join("");
        } else {
          rowData[col.key] = val;
        }
      });

      if (isEmpty) continue;

      const id = rowData["id"]?.toString();
      const sku = rowData["sku"]?.toString();
      if (!sku) {
        return { success: false, error: `Dòng ${r} thiếu mã SKU bắt buộc.` };
      }

      const name = rowData["name"]?.toString();
      const categoryStr = rowData["category"]?.toString();
      const categoryId = categoryStr ? categoryStr.split(" | ")[0] : undefined;

      let parentRecord = recordsMap.get(sku);
      if (!parentRecord) {
        // Create new Parent
        parentRecord = {
          id: id,
          sku: sku,
          name: name,
          categoryId: categoryId,
          productType: rowData["productType"],
          price: config.priceStrategy === "PRODUCT_LEVEL" ? Number(rowData["price"]) : undefined,
          salePrice: config.priceStrategy === "PRODUCT_LEVEL" ? Number(rowData["salePrice"]) : undefined,
          stock: config.inventoryStrategy === "PRODUCT_LEVEL" ? Number(rowData["stock"]) : undefined,
          digitalDeliveryType: rowData["digitalDeliveryType"],
          digitalData: rowData["digitalData"],
          imageUrl: rowData["imageUrl"],
          variants: []
        };
        recordsMap.set(sku, parentRecord);
      }

      // Handle Variant Data if Variants are enabled
      if (config.hasVariants && (rowData["variantOption1"] || rowData["variantOption2"])) {
        parentRecord.variants.push({
          variantOption1: rowData["variantOption1"]?.toString(),
          variantOption2: rowData["variantOption2"]?.toString(),
          price: config.priceStrategy === "VARIANT_LEVEL" ? Number(rowData["price"]) : undefined,
          salePrice: config.priceStrategy === "VARIANT_LEVEL" ? Number(rowData["salePrice"]) : undefined,
          stock: config.inventoryStrategy === "VARIANT_LEVEL" ? Number(rowData["stock"]) : undefined,
        });
      }
    }

    return { success: true, data: Array.from(recordsMap.values()) };

  } catch (error: any) {
    return { success: false, error: `Lỗi parse Excel: ${error.message}` };
  }
}
