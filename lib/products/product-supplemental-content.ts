import type { Id } from '@/convex/_generated/dataModel';
import { withFormatMarker } from '@/components/common/RichContent';

export type ProductSupplementalTemplate = {
  _id?: Id<'productSupplementalContents'>;
  postContent?: string;
  preContent?: string;
};

export const toRichTextContent = (html?: string) => {
  const raw = (html ?? '').trim();
  if (!raw) {
    return '';
  }
  return withFormatMarker('richtext', raw);
};
