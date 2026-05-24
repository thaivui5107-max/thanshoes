import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { resolveUniqueSlug } from "./lib/iaSlugs";

const attributeTermDoc = v.object({
  _creationTime: v.number(),
  _id: v.id("attributeTerms"),
  groupId: v.id("attributeGroups"),
  name: v.string(),
  slug: v.string(),
  description: v.optional(v.string()),
  iconType: v.optional(v.string()),
  iconValue: v.optional(v.string()),
  metadata: v.optional(v.any()),
  active: v.boolean(),
  order: v.number(),
});

export const listByGroup = query({
  args: { groupId: v.id("attributeGroups") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("attributeTerms")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .collect()
      .then(res => res.sort((a, b) => a.order - b.order));
  },
  returns: v.array(attributeTermDoc),
});

export const getById = query({
  args: { id: v.id("attributeTerms") },
  handler: async (ctx, args) => ctx.db.get(args.id),
  returns: v.union(attributeTermDoc, v.null()),
});

export const create = mutation({
  args: {
    groupId: v.id("attributeGroups"),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    iconType: v.optional(v.string()),
    iconValue: v.optional(v.string()),
    metadata: v.optional(v.any()),
    active: v.optional(v.boolean()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const resolvedSlug = await resolveUniqueSlug(ctx, { scope: "category", slug: args.slug });
    
    let nextOrder = args.order;
    if (nextOrder === undefined) {
      const lastTerm = await ctx.db
        .query("attributeTerms")
        .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
        .collect()
        .then(res => res.sort((a, b) => b.order - a.order)[0]);
      nextOrder = lastTerm ? lastTerm.order + 1 : 0;
    }
    
    return ctx.db.insert("attributeTerms", {
      ...args,
      slug: resolvedSlug.slug,
      order: nextOrder,
      active: args.active ?? true,
    });
  },
  returns: v.id("attributeTerms"),
});

export const update = mutation({
  args: {
    id: v.id("attributeTerms"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    iconType: v.optional(v.string()),
    iconValue: v.optional(v.string()),
    metadata: v.optional(v.any()),
    active: v.optional(v.boolean()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const term = await ctx.db.get(id);
    if (!term) throw new Error("Attribute Term not found");

    if (args.slug && args.slug !== term.slug) {
      const resolvedSlug = await resolveUniqueSlug(ctx, {
        scope: "category",
        slug: args.slug,
        exclude: { id: args.id, table: "attributeTerms" },
      });
      if (resolvedSlug.slug !== args.slug) {
        updates.slug = resolvedSlug.slug;
      }
    }
    await ctx.db.patch(id, updates);
    return null;
  },
  returns: v.null(),
});

export const remove = mutation({
  args: { id: v.id("attributeTerms") },
  handler: async (ctx, args) => {
    const term = await ctx.db.get(args.id);
    if (!term) throw new Error("Attribute Term not found");

    const productTerms = await ctx.db
      .query("productAttributeTerms")
      .withIndex("by_term", (q) => q.eq("termId", args.id))
      .collect();
    for (const pt of productTerms) {
      await ctx.db.delete(pt._id);
    }

    await ctx.db.delete(args.id);
    return null;
  },
  returns: v.null(),
});

export const getAssignedTermIds = query({
  args: { productId: v.optional(v.id("products")) },
  handler: async (ctx, args) => {
    if (!args.productId) return [];
    const mappings = await ctx.db
      .query("productAttributeTerms")
      .withIndex("by_product", (q) => q.eq("productId", args.productId!))
      .collect();
    return mappings.map((m) => m.termId);
  },
  returns: v.array(v.id("attributeTerms")),
});
