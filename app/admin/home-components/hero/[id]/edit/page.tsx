'use client';

import React, { use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Loader2 } from 'lucide-react';
import { HeroEditor } from '../../_components/HeroEditor';
import { resolveSecondaryByMode } from '../../../_shared/lib/typeColorOverride';
import { useTypeColorOverrideState } from '../../../_shared/hooks/useTypeColorOverride';
import { useTypeFontOverrideState } from '../../../_shared/hooks/useTypeFontOverride';

const COMPONENT_TYPE = 'Hero';

export default function HeroEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const decodedId = decodeURIComponent(id);
  const isSnapshotComponentKey = decodedId.startsWith('homeComponent:') || decodedId.startsWith('snapshot:');
  const { customState, showCustomBlock, setInitialCustom } = useTypeColorOverrideState(COMPONENT_TYPE);
  const { customState: customFontState, showCustomBlock: showFontCustomBlock, setInitialCustom: setInitialFontCustom } = useTypeFontOverrideState(COMPONENT_TYPE);
  const component = useQuery(api.homeComponents.getById, isSnapshotComponentKey ? 'skip' : { id: id as Id<"homeComponents"> });
  const updateMutation = useMutation(api.homeComponents.update);
  const setTypeColorOverride = useMutation(api.homeComponentSystemConfig.setTypeColorOverride);
  const setTypeFontOverride = useMutation(api.homeComponentSystemConfig.setTypeFontOverride);

  if (isSnapshotComponentKey) {
    return (
      <div className="text-center py-8 text-slate-500">
        Component này thuộc snapshot. Vui lòng mở từ trang quản lý component của snapshot để chỉnh sửa.
        <div className="mt-3">
          <Link href="/admin/home-components" className="text-sm text-blue-600 hover:underline">
            Quay lại trang chủ
          </Link>
        </div>
      </div>
    );
  }

  if (component === undefined) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (component === null) {
    return <div className="text-center py-8 text-slate-500">Không tìm thấy component</div>;
  }

  if (component.type !== 'Hero') {
    router.replace(`/admin/home-components/${id}/edit`);
    return null;
  }

  return (
    <HeroEditor
      backHref="/admin/home-components"
      draftOwnerKey={`home-component:hero:edit:${decodedId}`}
      initial={{
        active: component.active,
        config: component.config ?? {},
        title: component.title,
      }}
      onSave={async ({ active, config, title }) => {
        await updateMutation({
          active,
          config,
          id: id as Id<"homeComponents">,
          title,
        });
        if (showCustomBlock) {
          await setTypeColorOverride({
            enabled: customState.enabled,
            mode: customState.mode,
            primary: customState.primary,
            secondary: resolveSecondaryByMode(customState.mode, customState.primary, customState.secondary),
            type: COMPONENT_TYPE,
          });
          setInitialCustom({
            enabled: customState.enabled,
            mode: customState.mode,
            primary: customState.primary,
            secondary: resolveSecondaryByMode(customState.mode, customState.primary, customState.secondary),
          });
        }
        if (showFontCustomBlock) {
          await setTypeFontOverride({
            enabled: customFontState.enabled,
            fontKey: customFontState.fontKey,
            type: COMPONENT_TYPE,
          });
          setInitialFontCustom({
            enabled: customFontState.enabled,
            fontKey: customFontState.fontKey,
          });
        }
      }}
    />
  );
}
