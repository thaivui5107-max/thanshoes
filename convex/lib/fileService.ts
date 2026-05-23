import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { api } from "../_generated/api";

export type FileOwnerRef = {
  ownerField: string;
  ownerId: string;
  ownerTable: string;
  purpose?: string;
};

export type FileUsage = {
  field: string;
  label?: string;
  recordId: string;
  table: string;
};

export function normalizeStorageIds(values: Array<Id<"_storage"> | null | undefined> | null | undefined) {
  return values?.filter((value): value is Id<"_storage"> => Boolean(value)) ?? [];
}

export function dedupeStorageIds(values: Array<Id<"_storage"> | null | undefined> | null | undefined) {
  return Array.from(new Set(normalizeStorageIds(values)));
}

export function isConvexManagedMediaUrl(url?: string | null) {
  return Boolean(url && (url.includes("convex.cloud") || url.includes("convex.site")));
}

export async function listFileUsagesByStorageId(
  ctx: QueryCtx | MutationCtx,
  storageId: Id<"_storage">
): Promise<FileUsage[]> {
  const references = await ctx.db
    .query("fileReferences")
    .withIndex("by_storageId", q => q.eq("storageId", storageId))
    .collect();

  const validUsages: FileUsage[] = [];
  for (const reference of references) {
    let isConvexId = false;
    let record = null;
    try {
      const normalizedId = ctx.db.normalizeId(reference.ownerTable as any, reference.ownerId);
      if (normalizedId) {
        isConvexId = true;
        record = await ctx.db.get(normalizedId);
      }
    } catch {}

    if (isConvexId && !record) {
      continue; // Orphaned reference
    }

    validUsages.push({
      field: reference.ownerField,
      recordId: reference.ownerId,
      table: reference.ownerTable,
    });
  }
  return validUsages;
}

export async function hasFileReferences(ctx: QueryCtx | MutationCtx, storageId: Id<"_storage">) {
  const usages = await listFileUsagesByStorageId(ctx, storageId);
  return usages.length > 0;
}

export async function removeFileReferencesForStorage(ctx: MutationCtx, storageId: Id<"_storage">) {
  const references = await ctx.db
    .query("fileReferences")
    .withIndex("by_storageId", q => q.eq("storageId", storageId))
    .collect();

  await Promise.all(references.map(reference => ctx.db.delete(reference._id)));
}

export async function removeOwnerFileReferences(
  ctx: MutationCtx,
  owner: Pick<FileOwnerRef, "ownerId" | "ownerTable">,
  options?: { previousStorageIds?: Array<Id<"_storage"> | null | undefined> }
) {
  const references = await ctx.db
    .query("fileReferences")
    .withIndex("by_owner", q => q.eq("ownerTable", owner.ownerTable).eq("ownerId", owner.ownerId))
    .collect();
  const removedStorageIds = new Set<Id<"_storage">>(references.map(reference => reference.storageId));

  for (const storageId of dedupeStorageIds(options?.previousStorageIds)) {
    removedStorageIds.add(storageId);
  }

  await Promise.all(references.map(reference => ctx.db.delete(reference._id)));

  return { removedStorageIds: Array.from(removedStorageIds) };
}

export async function syncOwnerFileReferences(
  ctx: MutationCtx,
  owner: FileOwnerRef,
  storageIds: Array<Id<"_storage"> | null | undefined>,
  options?: { previousStorageIds?: Array<Id<"_storage"> | null | undefined> }
) {
  const now = Date.now();
  const nextStorageIds = new Set(dedupeStorageIds(storageIds));
  const existing = await ctx.db
    .query("fileReferences")
    .withIndex("by_owner_field", q =>
      q.eq("ownerTable", owner.ownerTable).eq("ownerId", owner.ownerId).eq("ownerField", owner.ownerField)
    )
    .collect();
  const existingStorageIds = new Set(existing.map(reference => reference.storageId));
  const removedStorageIds = new Set<Id<"_storage">>();

  for (const reference of existing) {
    if (!nextStorageIds.has(reference.storageId)) {
      removedStorageIds.add(reference.storageId);
      await ctx.db.delete(reference._id);
    }
  }

  for (const storageId of dedupeStorageIds(options?.previousStorageIds)) {
    if (!nextStorageIds.has(storageId)) {
      removedStorageIds.add(storageId);
    }
  }

  await Promise.all(
    Array.from(nextStorageIds)
      .filter(storageId => !existingStorageIds.has(storageId))
      .map(async (storageId) => {
        const media = await ctx.db
          .query("images")
          .withIndex("by_storageId", q => q.eq("storageId", storageId))
          .first();
        await ctx.db.insert("fileReferences", {
          createdAt: now,
          mediaId: media?._id,
          ownerField: owner.ownerField,
          ownerId: owner.ownerId,
          ownerTable: owner.ownerTable,
          purpose: owner.purpose,
          storageId,
          updatedAt: now,
        });
      })
  );

  return { removedStorageIds: Array.from(removedStorageIds) };
}

export async function commitFileDraftUploads(
  ctx: MutationCtx,
  storageIds: Array<Id<"_storage"> | null | undefined>
) {
  const committedStorageIds = dedupeStorageIds(storageIds);
  if (committedStorageIds.length === 0) {
    return { committed: 0 };
  }
  return await ctx.runMutation(api.fileLifecycle.commitDraftUploads, { storageIds: committedStorageIds });
}

export async function cleanupStorageIdsIfUnreferenced(
  ctx: MutationCtx,
  storageIds: Array<Id<"_storage"> | null | undefined>
) {
  const cleanupStorageIds = dedupeStorageIds(storageIds);
  await Promise.all(cleanupStorageIds.map((storageId) =>
    ctx.runMutation(api.storage.cleanupStorageIfUnreferenced, { storageId })
  ));
  return { cleaned: cleanupStorageIds.length };
}

export async function syncOwnerFilesAndCleanup(
  ctx: MutationCtx,
  owner: FileOwnerRef,
  storageIds: Array<Id<"_storage"> | null | undefined>,
  options?: { previousStorageIds?: Array<Id<"_storage"> | null | undefined> }
) {
  const result = await syncOwnerFileReferences(ctx, owner, storageIds, options);
  await commitFileDraftUploads(ctx, storageIds);
  await cleanupStorageIdsIfUnreferenced(ctx, result.removedStorageIds);
  return result;
}

export async function removeOwnerFilesAndCleanup(
  ctx: MutationCtx,
  owner: Pick<FileOwnerRef, "ownerId" | "ownerTable">,
  options?: { previousStorageIds?: Array<Id<"_storage"> | null | undefined> }
) {
  const result = await removeOwnerFileReferences(ctx, owner, options);
  await cleanupStorageIdsIfUnreferenced(ctx, result.removedStorageIds);
  return result;
}

export async function isBrokenStorageBackedUrl(
  ctx: MutationCtx,
  url?: string,
  storageId?: Id<"_storage"> | null
) {
  if (!url) {return false;}
  if (!storageId) {return isConvexManagedMediaUrl(url);}
  const resolvedUrl = await ctx.storage.getUrl(storageId);
  return !resolvedUrl;
}

export async function resolveStorageIdsFromLegacyUrls(
  ctx: QueryCtx | MutationCtx,
  urls: Array<string | null | undefined>,
  options?: { folder?: string; limit?: number }
) {
  const targetUrls = new Set(urls.filter((url): url is string => Boolean(url)));
  if (targetUrls.size === 0) {
    return [];
  }

  const limit = options?.limit ?? 100;
  const folder = options?.folder;
  const images = folder
    ? await ctx.db.query("images").withIndex("by_folder", q => q.eq("folder", folder)).take(limit)
    : await ctx.db.query("images").take(limit);

  const resolvedStorageIds: Id<"_storage">[] = [];
  for (const image of images) {
    const url = await ctx.storage.getUrl(image.storageId);
    if (url && targetUrls.has(url)) {
      resolvedStorageIds.push(image.storageId);
    }
  }
  return dedupeStorageIds(resolvedStorageIds);
}

export function fileReferenceUsage(reference: Doc<"fileReferences">): FileUsage {
  return {
    field: reference.ownerField,
    recordId: reference.ownerId,
    table: reference.ownerTable,
  };
}
