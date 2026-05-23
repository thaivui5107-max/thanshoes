import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

/**
 * 1. Generate Smart SKU
 * Gợi ý một mã SKU dựa trên ký tự đầu của Tên Sản phẩm.
 * Ví dụ: "Áo Thun Nam" -> ATN-001
 */
export const generateSmartSku = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    if (!args.name.trim()) return "SP-001";
    
    // Lấy ký tự đầu của mỗi từ, viết hoa
    const words = args.name.trim().split(/\s+/);
    let prefix = words.map(w => w.charAt(0).toUpperCase()).join("").replace(/[^A-Z0-9]/g, '');
    if (prefix.length === 0) prefix = "SP";
    if (prefix.length > 4) prefix = prefix.substring(0, 4);

    // Lấy tổng số lượng SP để nối số
    const stats = await ctx.db.query("productStats").withIndex("by_key", q => q.eq("key", "total")).unique();
    const count = (stats?.count ?? 0) + 1;
    const suffix = count.toString().padStart(3, "0");

    return `${prefix}-${suffix}`;
  }
});

/**
 * 2. Cảnh báo trùng lặp SKU
 */
export const checkSkuExists = query({
  args: { sku: v.string(), ignoreProductId: v.optional(v.id("products")) },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("products").withIndex("by_sku", q => q.eq("sku", args.sku)).unique();
    if (!existing) return false;
    if (args.ignoreProductId && existing._id === args.ignoreProductId) return false;
    return true;
  }
});

const inlineVariantDoc = v.object({
  id: v.optional(v.id("productVariants")),
  sku: v.string(),
  price: v.number(),
  salePrice: v.optional(v.number()),
  stock: v.number(),
  optionValues: v.array(v.string()), // Ví dụ: ["Đỏ", "39"]
});

const inlineOptionDoc = v.object({
  name: v.string(),
  values: v.array(v.string()), // Ví dụ: ["Đỏ", "Xanh"]
});

/**
 * Helper: Đồng bộ Options và OptionValues
 * Trả về map OptionName -> OptionId và map OptionValue -> OptionValueId
 */
async function syncOptions(ctx: any, options: { name: string; values: string[] }[]) {
  const optionIds: Id<"productOptions">[] = [];
  const valMap = new Map<string, Id<"productOptionValues">>(); // Key: "OptionName:Value" -> Value: Id

  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    if (!opt.name.trim()) continue;
    
    // Tìm hoặc tạo Option
    let optionRecord = await ctx.db.query("productOptions").filter((q: any) => q.eq(q.field("name"), opt.name)).first();
    if (!optionRecord) {
      const oid = await ctx.db.insert("productOptions", {
        name: opt.name,
        slug: opt.name.toLowerCase().replace(/\s+/g, '-'),
        active: true,
        displayType: "dropdown",
        isPreset: false,
        order: i,
      });
      optionRecord = await ctx.db.get(oid);
    }
    optionIds.push(optionRecord!._id);

    // Tìm hoặc tạo OptionValues
    for (let j = 0; j < opt.values.length; j++) {
      const val = opt.values[j];
      if (!val.trim()) continue;
      
      let valRecord = await ctx.db.query("productOptionValues")
        .withIndex("by_option", (q: any) => q.eq("optionId", optionRecord!._id))
        .filter((q: any) => q.eq(q.field("value"), val))
        .first();
        
      if (!valRecord) {
        const vid = await ctx.db.insert("productOptionValues", {
          optionId: optionRecord!._id,
          value: val,
          active: true,
          order: j,
        });
        valRecord = await ctx.db.get(vid);
      }
      valMap.set(`${opt.name}:${val}`, valRecord!._id);
    }
  }

  return { optionIds, valMap };
}

/**
 * 3. Create Product with Inline Variants (Transaction-like)
 */
export const createProductWithVariants = mutation({
  args: {
    sku: v.string(),
    name: v.string(),
    categoryId: v.id("productCategories"),
    price: v.number(),
    salePrice: v.optional(v.number()),
    stock: v.number(),
    status: v.string(),
    description: v.optional(v.string()),
    image: v.optional(v.string()),
    productType: v.optional(v.string()),
    digitalDeliveryType: v.optional(v.string()),
    options: v.array(inlineOptionDoc),
    variants: v.array(inlineVariantDoc),
  },
  handler: async (ctx, args) => {
    // Sync Options
    const hasVariants = args.variants.length > 0;
    const { optionIds, valMap } = hasVariants ? await syncOptions(ctx, args.options) : { optionIds: [], valMap: new Map() };

    // Get order
    const totalStats = await ctx.db.query("productStats").withIndex("by_key", (q: any) => q.eq("key", "total")).unique();
    const nextOrder = (totalStats?.lastOrder ?? 0) + 1;

    // 1. Tạo Product
    const productId = await ctx.db.insert("products", {
      sku: args.sku,
      name: args.name,
      slug: args.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(),
      categoryId: args.categoryId,
      price: args.price,
      salePrice: args.salePrice,
      stock: args.stock,
      status: args.status,
      sales: 0,
      order: nextOrder,
      image: args.image,
      description: args.description,
      productType: args.productType as any,
      digitalDeliveryType: args.digitalDeliveryType as any,
      hasVariants: hasVariants,
      optionIds: hasVariants ? optionIds : undefined,
    });

    // 2. Tạo Variants
    if (hasVariants) {
      for (let i = 0; i < args.variants.length; i++) {
        const variant = args.variants[i];
        
        // Map string values to ObjectIDs
        const optionValuesData = [];
        for (let j = 0; j < variant.optionValues.length; j++) {
          const optName = args.options[j]?.name;
          const valName = variant.optionValues[j];
          if (optName && valName) {
            const valId = valMap.get(`${optName}:${valName}`);
            if (valId) {
              optionValuesData.push({ optionId: optionIds[j], valueId: valId });
            }
          }
        }

        await ctx.db.insert("productVariants", {
          productId: productId,
          sku: variant.sku || `${args.sku}-${i + 1}`,
          price: variant.price,
          salePrice: variant.salePrice,
          stock: variant.stock,
          status: "Active",
          order: i,
          optionValues: optionValuesData,
        });
      }
    }

    // 3. Update stats
    if (totalStats) {
      await ctx.db.patch(totalStats._id, { count: totalStats.count + 1, lastOrder: nextOrder });
    }
    const statusStats = await ctx.db.query("productStats").withIndex("by_key", (q: any) => q.eq("key", args.status)).unique();
    if (statusStats) {
      await ctx.db.patch(statusStats._id, { count: statusStats.count + 1 });
    }

    return productId;
  }
});

/**
 * 4. Update Product with Inline Variants
 */
export const updateProductWithVariants = mutation({
  args: {
    id: v.id("products"),
    sku: v.string(),
    name: v.string(),
    categoryId: v.id("productCategories"),
    price: v.number(),
    salePrice: v.optional(v.number()),
    stock: v.number(),
    status: v.string(),
    description: v.optional(v.string()),
    image: v.optional(v.string()),
    productType: v.optional(v.string()),
    digitalDeliveryType: v.optional(v.string()),
    options: v.array(inlineOptionDoc),
    variants: v.array(inlineVariantDoc),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Product not found");

    const hasVariants = args.variants.length > 0;
    const { optionIds, valMap } = hasVariants ? await syncOptions(ctx, args.options) : { optionIds: [], valMap: new Map() };

    // Update Product
    await ctx.db.patch(args.id, {
      sku: args.sku,
      name: args.name,
      categoryId: args.categoryId,
      price: args.price,
      salePrice: args.salePrice,
      stock: args.stock,
      status: args.status,
      image: args.image,
      description: args.description,
      productType: args.productType as any,
      digitalDeliveryType: args.digitalDeliveryType as any,
      hasVariants: hasVariants,
      optionIds: hasVariants ? optionIds : undefined,
    });

    // Cập nhật Variants (Xử lý thông minh để giữ ID nếu edit, tạo mới nếu thêm)
    if (hasVariants) {
      const activeVariantIds = new Set<string>();

      for (let i = 0; i < args.variants.length; i++) {
        const variant = args.variants[i];
        
        const optionValuesData = [];
        for (let j = 0; j < variant.optionValues.length; j++) {
          const optName = args.options[j]?.name;
          const valName = variant.optionValues[j];
          if (optName && valName) {
            const valId = valMap.get(`${optName}:${valName}`);
            if (valId) {
              optionValuesData.push({ optionId: optionIds[j], valueId: valId });
            }
          }
        }

        if (variant.id) {
          // Update
          await ctx.db.patch(variant.id, {
            sku: variant.sku,
            price: variant.price,
            salePrice: variant.salePrice,
            stock: variant.stock,
            order: i,
            optionValues: optionValuesData,
          });
          activeVariantIds.add(variant.id);
        } else {
          // Insert
          const newVid = await ctx.db.insert("productVariants", {
            productId: args.id,
            sku: variant.sku,
            price: variant.price,
            salePrice: variant.salePrice,
            stock: variant.stock,
            status: "Active",
            order: i,
            optionValues: optionValuesData,
          });
          activeVariantIds.add(newVid);
        }
      }

      // Xóa các variants cũ bị loại bỏ (nhưng không áp dụng HARD DELETE CASCADE ở đây,
      // vì UI edit thường gọi api removeVariantWithCascade riêng khi admin bấm nút Thùng rác)
      // Nếu không, chỉ cần dọn dẹp các variants mồ côi:
      const existingVariants = await ctx.db.query("productVariants").withIndex("by_product", (q: any) => q.eq("productId", args.id)).collect();
      for (const ev of existingVariants) {
        if (!activeVariantIds.has(ev._id)) {
           // Admin đã xóa khỏi bảng Matrix, trigger xóa cứng & cascade
           await cascadeDeleteVariant(ctx, ev._id);
        }
      }
    }

    return args.id;
  }
});

/**
 * Helper: Logic Hard Delete & Cascade
 */
async function cascadeDeleteVariant(ctx: any, variantId: Id<"productVariants">) {
  // 1. Quét và Xóa Cart Items
  const cartItems = await ctx.db.query("cartItems")
    .filter((q: any) => q.eq(q.field("variantId"), variantId))
    .collect();
  
  const affectedCartIds = new Set<Id<"carts">>();
  for (const item of cartItems) {
    affectedCartIds.add(item.cartId);
    await ctx.db.delete(item._id);
  }

  // Cập nhật lại tổng tiền cho Carts bị ảnh hưởng
  for (const cartId of affectedCartIds) {
    const remainingItems = await ctx.db.query("cartItems").withIndex("by_cart", (q: any) => q.eq("cartId", cartId)).collect();
    const newTotal = remainingItems.reduce((acc: number, cur: any) => acc + cur.subtotal, 0);
    await ctx.db.patch(cartId, { totalAmount: newTotal, itemsCount: remainingItems.length });
  }

  // 2. Quét và Xóa Wishlist
  const wishlists = await ctx.db.query("wishlist")
    .filter((q: any) => q.eq(q.field("variantId"), variantId))
    .collect();
  for (const w of wishlists) {
    await ctx.db.delete(w._id);
  }

  // 3. Xóa chính Variant
  await ctx.db.delete(variantId);

  // Lưu ý: Đơn hàng (Orders) lưu dạng snapshot trong order.items nên không bị hỏng cấu trúc.
}

/**
 * 5. Remove Variant (Dùng khi admin bấm xóa chủ động 1 dòng)
 */
export const removeVariantWithCascade = mutation({
  args: { variantId: v.id("productVariants") },
  handler: async (ctx, args) => {
    await cascadeDeleteVariant(ctx, args.variantId);
    return true;
  }
});

/**
 * Kiểm tra xem variant có nằm trong đơn hàng nào không (Để bật cảnh báo 2 bước)
 */
export const checkVariantInOrders = query({
  args: { variantId: v.id("productVariants") },
  handler: async (ctx, args) => {
    // Vì bảng orders ko index variantId trực tiếp ở cấp top-level (nằm trong mảng items),
    // Ta phải fetch tất cả orders hoặc dùng filter array. Trong data thực tế,
    // order items thường chứa variantId snapshot. Để tối ưu, nếu DB lớn, filter này sẽ chậm.
    // Tạm thời ta dùng filter.
    const ordersWithVariant = await ctx.db.query("orders")
      .filter((q: any) => q.eq(q.field("status"), "Pending")) // Chỉ check đơn Pending/Processing cho nhanh
      .collect();
      
    for (const order of ordersWithVariant) {
      if (order.items.some((i: any) => i.variantId === args.variantId)) {
        return true;
      }
    }
    return false;
  }
});
