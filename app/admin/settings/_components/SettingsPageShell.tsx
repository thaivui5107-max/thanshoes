'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { LayoutTemplate, Loader2, Palette, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'next/navigation';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { revalidateSeoPaths } from '@/app/actions/seo-revalidate';
import { Button, Card, CardContent, CardHeader, CardTitle, Checkbox, Input, Label, cn } from '../../components/ui';
import { ModuleGuard } from '../../components/ModuleGuard';
import { SettingsImageUploader } from '../../components/SettingsImageUploader';
import { TagInput } from '../../components/TagInput';
import MapLocationPicker from '../MapLocationPicker';
import { HomeComponentStickyFooter } from '@/app/admin/home-components/_shared/components/HomeComponentStickyFooter';
import { AiSeoImportDialog } from './AiSeoImportDialog';
import { SeoBuilderDialog } from './SeoBuilderDialog';

type SettingsSection = 'site' | 'contact' | 'seo' | 'advanced';
type SettingsFormValue = string | boolean;
type AdvancedTab = 'product-placeholder' | 'product-frame' | 'header';
type HeaderConfig = {
  showBrandName?: boolean;
  logoSizeLevel?: number;
  headerSpacingLevel?: number;
  logoBackgroundStyle?: string;
  headerSticky?: boolean;
  headerStickyDesktop?: boolean;
  headerStickyMobile?: boolean;
  cta?: {
    show?: boolean;
    text?: string;
    url?: string;
  };
  [key: string]: unknown;
};
type SettingsToSave = {
  group: string;
  key: string;
  storageId?: Id<'_storage'> | null;
  value: unknown;
};

const MODULE_KEY = 'settings';

const SECTION_LABELS: Record<SettingsSection, string> = {
  contact: 'Thông tin liên hệ',
  seo: 'Cài đặt SEO',
  site: 'Thông tin chung',
  advanced: 'Cài đặt nâng cao',
};

// Color utilities
const hexToHSL = (hex: string): { h: number; s: number; l: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {return { h: 0, l: 0, s: 0 };}
  const r = Number.parseInt(result[1], 16) / 255;
  const g = Number.parseInt(result[2], 16) / 255;
  const b = Number.parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: { h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      }
      case g: { h = ((b - r) / d + 2) / 6; break;
      }
      case b: { h = ((r - g) / d + 4) / 6; break;
      }
    }
  }
  return { h: Math.round(h * 360), l: Math.round(l * 100), s: Math.round(s * 100) };
};

const hslToHex = (h: number, s: number, l: number): string => {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

const generateTintsShades = (hex: string): string[] => {
  const { h, s } = hexToHSL(hex);
  const lightnesses = [95, 85, 75, 65, 55, 45, 35, 25, 15, 5];
  return lightnesses.map(newL => hslToHex(h, s, newL));
};

const generateComplementary = (hex: string): string => {
  const { h, s, l } = hexToHSL(hex);
  return hslToHex((h + 180) % 360, s, l);
};

const isValidHexColor = (color: string): boolean => /^#[0-9A-Fa-f]{6}$/.test(color);

const GROUP_LABELS: Record<string, string> = {
  contact: 'Thông tin liên hệ',
  seo: 'Cài đặt SEO',
  site: 'Thông tin chung',
  social: 'Mạng xã hội',
  advanced: 'Cài đặt nâng cao',
};

const SEO_META_LIMITS: Record<string, number> = {
  seo_description: 160,
  seo_title: 60,
};

const REMOVED_SEO_KEYS = new Set([
  'seo_robots',
  'seo_business_type',
  'seo_opening_hours',
  'seo_price_range',
  'seo_geo_lat',
  'seo_geo_lng',
  'seo_hreflang',
]);

const HIDDEN_ADMIN_SEO_KEYS = new Set([
  ...REMOVED_SEO_KEYS,
  'seo_google_verification',
  'seo_bing_verification',
]);

const REMOVED_CONTACT_KEYS = new Set([
  'contact_hotline',
  'social_zalo',
]);

const SETTING_STORAGE_ID_SUFFIX = '__storageId';
const HEADER_MENU_ADVANCED_FEATURE = 'enableHeaderMenuAdvanced';
const DEFAULT_HEADER_CONFIG: HeaderConfig = {
  showBrandName: true,
  logoSizeLevel: 2,
  headerSpacingLevel: 5,
  logoBackgroundStyle: 'none',
  headerSticky: true,
  headerStickyDesktop: true,
  headerStickyMobile: true,
  cta: { show: true, text: 'Liên hệ', url: '/contact' },
};
const LOGO_SIZE_OPTIONS = Array.from({ length: 30 }, (_, index) => ({
  value: index + 1,
  label: `Nấc ${index + 1}`,
}));
const HEADER_SPACING_OPTIONS = [
  { value: 1, label: 'Siêu gọn' },
  { value: 2, label: 'Rất gọn' },
  { value: 3, label: 'Gọn' },
  { value: 4, label: 'Hơi gọn' },
  { value: 5, label: 'Cân bằng' },
  { value: 6, label: 'Hơi thoáng' },
  { value: 7, label: 'Trung bình' },
];
const LOGO_BACKGROUND_OPTIONS = [
  { id: 'none', label: 'None' },
  { id: 'border', label: 'Border' },
  { id: 'outline', label: 'Outline sạch' },
  { id: 'hairline', label: 'Hairline nhẹ' },
  { id: 'inset', label: 'Inset panel' },
  { id: 'pill', label: 'Pill badge' },
  { id: 'shadow', label: 'Shadow' },
  { id: 'soft', label: 'Soft card' },
  { id: 'solid', label: 'Solid contrast' },
];

const normalizeHeaderConfig = (value: unknown): HeaderConfig => {
  const raw = value && typeof value === 'object' && !Array.isArray(value)
    ? value as HeaderConfig
    : {};
  return {
    ...raw,
    showBrandName: raw.showBrandName ?? DEFAULT_HEADER_CONFIG.showBrandName,
    logoSizeLevel: typeof raw.logoSizeLevel === 'number' ? Math.min(30, Math.max(1, Math.round(raw.logoSizeLevel))) : DEFAULT_HEADER_CONFIG.logoSizeLevel,
    headerSpacingLevel: typeof raw.headerSpacingLevel === 'number' ? Math.min(7, Math.max(1, Math.round(raw.headerSpacingLevel))) : DEFAULT_HEADER_CONFIG.headerSpacingLevel,
    logoBackgroundStyle: typeof raw.logoBackgroundStyle === 'string' ? raw.logoBackgroundStyle : DEFAULT_HEADER_CONFIG.logoBackgroundStyle,
    headerSticky: raw.headerSticky ?? DEFAULT_HEADER_CONFIG.headerSticky,
    headerStickyDesktop: raw.headerStickyDesktop ?? raw.headerSticky ?? DEFAULT_HEADER_CONFIG.headerStickyDesktop,
    headerStickyMobile: raw.headerStickyMobile ?? raw.headerSticky ?? DEFAULT_HEADER_CONFIG.headerStickyMobile,
    cta: {
      ...DEFAULT_HEADER_CONFIG.cta,
      ...(raw.cta && typeof raw.cta === 'object' ? raw.cta : {}),
    },
  };
};

const stableStringify = (value: unknown) => JSON.stringify(value ?? null);

export default function SettingsPageShell({ section }: { section: SettingsSection }) {
  return (
    <ModuleGuard moduleKey={MODULE_KEY}>
      <SettingsContent section={section} />
    </ModuleGuard>
  );
}

function SettingsContent({ section }: { section: SettingsSection }) {
  const router = useRouter();
  const [form, setForm] = useState<Record<string, SettingsFormValue>>({});
  const [initialForm, setInitialForm] = useState<Record<string, SettingsFormValue>>({});
  const [mediaStorageIds, setMediaStorageIds] = useState<Record<string, Id<'_storage'> | null>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isSecondaryAuto, setIsSecondaryAuto] = useState(true);
  const [hasCleanedSeoFields, setHasCleanedSeoFields] = useState(false);
  const [hasCleanedContactFields, setHasCleanedContactFields] = useState(false);
  const [advancedTab, setAdvancedTab] = useState<AdvancedTab>('product-placeholder');
  const [headerConfigDraft, setHeaderConfigDraft] = useState<HeaderConfig>(DEFAULT_HEADER_CONFIG);
  const [initialHeaderConfig, setInitialHeaderConfig] = useState<HeaderConfig>(DEFAULT_HEADER_CONFIG);

  // Queries
  const settingsData = useQuery(api.settings.listAll);
  const featuresData = useQuery(api.admin.modules.listModuleFeatures, { moduleKey: MODULE_KEY });
  const fieldsData = useQuery(api.admin.modules.listModuleFields, { moduleKey: MODULE_KEY });

  // Mutations
  const setMultiple = useMutation(api.settings.setMultiple);
  const removeMultiple = useMutation(api.settings.removeMultiple);

  const isLoading = settingsData === undefined
    || featuresData === undefined
    || fieldsData === undefined;

  // Parse enabled features
  const enabledFeatures = useMemo(() => {
    const features: Record<string, boolean> = {};
    featuresData?.forEach(f => { features[f.featureKey] = f.enabled; });
    return features;
  }, [featuresData]);
  const canEditHeaderMenu = featuresData?.some(feature => feature.featureKey === HEADER_MENU_ADVANCED_FEATURE)
    ? Boolean(enabledFeatures[HEADER_MENU_ADVANCED_FEATURE])
    : false;

  const isSectionEnabled = section === 'site'
    ? true
    : section === 'contact'
      ? Boolean(enabledFeatures.enableContact)
      : section === 'seo'
        ? Boolean(enabledFeatures.enableSEO)
        : true;

  const brandMode = form.site_brand_mode === 'single' ? 'single' : 'dual';
  const isSecondaryModeSingle = brandMode === 'single';

  const hasPrimaryField = useMemo(() => fieldsData?.some(field => field.fieldKey === 'site_brand_primary'), [fieldsData]);

  // Filter and group fields based on enabled status and feature
  const fieldsByGroup = useMemo(() => {
    const groups: Record<string, typeof fieldsData> = {};
    
    fieldsData?.forEach(field => {
      if (hasPrimaryField && field.fieldKey === 'site_brand_color') {return;}
      // Skip disabled fields
      if (!field.enabled) {return;}
      
      // Skip fields whose linked feature is disabled
      if (field.linkedFeature && !enabledFeatures[field.linkedFeature]) {return;}

      if (HIDDEN_ADMIN_SEO_KEYS.has(field.fieldKey)) {return;}
      if (REMOVED_CONTACT_KEYS.has(field.fieldKey)) {return;}

      // Skip lat/lng fields (managed by MapLocationPicker)
      if (field.fieldKey === 'contact_lat' || field.fieldKey === 'contact_lng') {return;}

      const group = field.group ?? 'site';
      groups[group] ??= [];
      groups[group].push(field);
    });

    // Sort fields by order within each group
    Object.keys(groups).forEach(key => {
      groups[key]!.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    });

    return groups;
  }, [fieldsData, enabledFeatures, hasPrimaryField]);

  // Sync form with settings data
  useEffect(() => {
    if (settingsData) {
      const values: Record<string, SettingsFormValue> = {};
      const storageIds: Record<string, Id<'_storage'> | null> = {};
      settingsData.forEach(s => {
        if (s.key.endsWith(SETTING_STORAGE_ID_SUFFIX)) {
          const ownerKey = s.key.slice(0, -SETTING_STORAGE_ID_SUFFIX.length);
          storageIds[ownerKey] = typeof s.value === 'string' ? s.value as Id<'_storage'> : null;
          return;
        }
        if (s.key === 'header_config') {
          const normalized = normalizeHeaderConfig(s.value);
          setHeaderConfigDraft(normalized);
          setInitialHeaderConfig(normalized);
          return;
        }
        values[s.key] = typeof s.value === 'boolean' ? s.value : (typeof s.value === 'string' ? s.value : String(s.value ?? ''));
      });
      if (!values.site_brand_primary && values.site_brand_color) {
        values.site_brand_primary = values.site_brand_color;
      }
      if (!values.contact_lat) {
        values.contact_lat = '10.762622';
      }
      if (!values.contact_lng) {
        values.contact_lng = '106.660172';
      }
      if (!values.contact_map_provider) {
        values.contact_map_provider = 'openstreetmap';
      }
      if (!values.contact_google_map_embed_iframe) {
        values.contact_google_map_embed_iframe = '';
      }
      if (values.product_image_placeholder === undefined) {
        values.product_image_placeholder = '';
      }
      if (values.product_frame_overlay_url === undefined) {
        values.product_frame_overlay_url = '';
      }
      if (values.enable_product_frames === undefined) {
        values.enable_product_frames = false;
      }
      setIsSecondaryAuto(values.site_brand_mode === 'single' ? true : !values.site_brand_secondary);
      setForm(values);
      setInitialForm(values);
      setMediaStorageIds(storageIds);
    }
  }, [settingsData]);

  useEffect(() => {
    if (!settingsData || hasCleanedSeoFields) {return;}
    const hasRemoved = settingsData.some(setting => REMOVED_SEO_KEYS.has(setting.key));
    if (!hasRemoved) {
      setHasCleanedSeoFields(true);
      return;
    }
    void removeMultiple({ keys: Array.from(REMOVED_SEO_KEYS) })
      .finally(() => setHasCleanedSeoFields(true));
  }, [settingsData, hasCleanedSeoFields, removeMultiple]);

  useEffect(() => {
    if (!settingsData || hasCleanedContactFields) {return;}
    const hasRemoved = settingsData.some(setting => REMOVED_CONTACT_KEYS.has(setting.key));
    if (!hasRemoved) {
      setHasCleanedContactFields(true);
      return;
    }
    void removeMultiple({ keys: Array.from(REMOVED_CONTACT_KEYS) })
      .finally(() => setHasCleanedContactFields(true));
  }, [settingsData, hasCleanedContactFields, removeMultiple]);

  useEffect(() => {
    if (isSecondaryModeSingle && !isSecondaryAuto) {
      setIsSecondaryAuto(true);
    }
  }, [isSecondaryModeSingle, isSecondaryAuto]);

  useEffect(() => {
    if (isLoading) {return;}
    if (!isSectionEnabled) {
      router.replace('/admin/settings/general');
    }
  }, [isLoading, isSectionEnabled, router]);

  useEffect(() => {
    if (!canEditHeaderMenu && advancedTab === 'header') {
      setAdvancedTab('product-placeholder');
    }
  }, [advancedTab, canEditHeaderMenu]);

  // Detect changes
  const headerConfigHasChanges = useMemo(
    () => stableStringify(headerConfigDraft) !== stableStringify(initialHeaderConfig),
    [headerConfigDraft, initialHeaderConfig]
  );
  const hasChanges = useMemo(
    () => Object.keys(form).some(key => form[key] !== initialForm[key]) || (canEditHeaderMenu && headerConfigHasChanges),
    [form, initialForm, canEditHeaderMenu, headerConfigHasChanges]
  );

  const updateField = (key: string, value: string | boolean) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const updateImageField = (key: string, url: string | undefined, storageId?: Id<'_storage'> | null) => {
    updateField(key, url ?? '');
    if (storageId !== undefined) {
      setMediaStorageIds(prev => ({ ...prev, [key]: storageId }));
    }
  };

  const updateHeaderConfig = <K extends keyof HeaderConfig>(key: K, value: HeaderConfig[K]) => {
    setHeaderConfigDraft(prev => ({
      ...prev,
      [key]: value,
      ...(key === 'headerStickyDesktop' || key === 'headerStickyMobile'
        ? {
            headerSticky: key === 'headerStickyDesktop'
              ? Boolean(value)
              : (prev.headerStickyDesktop ?? prev.headerSticky ?? true),
          }
        : {}),
    }));
  };

  const updateHeaderCta = <K extends keyof NonNullable<HeaderConfig['cta']>>(key: K, value: NonNullable<HeaderConfig['cta']>[K]) => {
    setHeaderConfigDraft(prev => ({
      ...prev,
      cta: {
        ...DEFAULT_HEADER_CONFIG.cta,
        ...prev.cta,
        [key]: value,
      },
    }));
  };

  // Validate before save
  const validateForm = (): boolean => {
    // Validate color fields
    const colorFields = fieldsData?.filter(f => f.type === 'color') ?? [];
    for (const field of colorFields) {
      const value = form[field.fieldKey];
      if (typeof value === 'string' && value && !isValidHexColor(value)) {
        toast.error(`${field.name}: Mã màu không hợp lệ (cần format #RRGGBB)`);
        return false;
      }
    }

    const mapProvider = form.contact_map_provider === 'google_embed' ? 'google_embed' : 'openstreetmap';
    const googleIframe = typeof form.contact_google_map_embed_iframe === 'string'
      ? form.contact_google_map_embed_iframe.trim()
      : '';
    if (mapProvider === 'google_embed' && googleIframe) {
      const hasIframe = googleIframe.includes('<iframe') && googleIframe.includes('</iframe>');
      if (!hasIframe) {
        toast.error('Google Maps: Vui lòng dán đúng mã iframe nhúng.');
        return false;
      }
    }

    // Validate required fields
    const requiredFields = fieldsData?.filter(f => f.required && f.enabled) ?? [];
    for (const field of requiredFields) {
      const value = form[field.fieldKey];
      if (typeof value === 'string' ? !value.trim() : value === undefined || value === null) {
        toast.error(`${field.name} là bắt buộc`);
        return false;
      }
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) {return;}

    setIsSaving(true);
    try {
      // Get all enabled fields and their groups
      const settingsToSave: SettingsToSave[] = fieldsData
        ?.filter(f => {
          if (!f.enabled) {return false;}
          if (hasPrimaryField && f.fieldKey === 'site_brand_color') {return false;}
          if (HIDDEN_ADMIN_SEO_KEYS.has(f.fieldKey)) {return false;}
          if (REMOVED_CONTACT_KEYS.has(f.fieldKey)) {return false;}
          return !f.linkedFeature || enabledFeatures[f.linkedFeature];
        })
        .map(field => {
          let value = form[field.fieldKey] ?? '';
          if (field.type === 'boolean') {
            value = value === true || value === 'true';
          }
          if (field.fieldKey === 'site_brand_primary' && !value && form.site_brand_color) {
            value = form.site_brand_color;
          }
          if (field.fieldKey === 'site_brand_secondary' && (isSecondaryAuto || isSecondaryModeSingle)) {
            value = '';
          }
          return {
            group: field.group ?? 'site',
            key: field.fieldKey,
            ...(field.type === 'image' ? { storageId: mediaStorageIds[field.fieldKey] ?? null } : {}),
            value,
          };
        }) ?? [];

      const primaryValue = form.site_brand_primary || form.site_brand_color;
      if (primaryValue && hasPrimaryField) {
        settingsToSave.push({ group: 'site', key: 'site_brand_color', value: primaryValue });
      }

      if (form.contact_lat && !settingsToSave.some((item) => item.key === 'contact_lat')) {
        settingsToSave.push({ group: 'contact', key: 'contact_lat', value: form.contact_lat });
      }
      if (form.contact_lng && !settingsToSave.some((item) => item.key === 'contact_lng')) {
        settingsToSave.push({ group: 'contact', key: 'contact_lng', value: form.contact_lng });
      }
      if (!settingsToSave.some((item) => item.key === 'contact_map_provider')) {
        settingsToSave.push({
          group: 'contact',
          key: 'contact_map_provider',
          value: form.contact_map_provider || 'openstreetmap',
        });
      }
      if (!settingsToSave.some((item) => item.key === 'contact_google_map_embed_iframe')) {
        settingsToSave.push({
          group: 'contact',
          key: 'contact_google_map_embed_iframe',
          value: form.contact_google_map_embed_iframe || '',
        });
      }
      if (!settingsToSave.some((item) => item.key === 'product_image_placeholder')) {
        settingsToSave.push({
          group: 'advanced',
          key: 'product_image_placeholder',
          storageId: mediaStorageIds.product_image_placeholder ?? null,
          value: form.product_image_placeholder || '',
        });
      }
      if (!settingsToSave.some((item) => item.key === 'product_frame_overlay_url')) {
        settingsToSave.push({
          group: 'advanced',
          key: 'product_frame_overlay_url',
          storageId: mediaStorageIds.product_frame_overlay_url ?? null,
          value: form.product_frame_overlay_url || '',
        });
      }
      if (!settingsToSave.some((item) => item.key === 'enable_product_frames')) {
        settingsToSave.push({
          group: 'advanced',
          key: 'enable_product_frames',
          value: form.enable_product_frames === true || form.enable_product_frames === 'true',
        });
      }
      if (canEditHeaderMenu && !settingsToSave.some((item) => item.key === 'header_config')) {
        settingsToSave.push({
          group: 'site',
          key: 'header_config',
          value: normalizeHeaderConfig(headerConfigDraft),
        });
      }

      const hasSiteUrlChanged = form.site_url !== initialForm.site_url;
      await setMultiple({ settings: settingsToSave });
      if (hasSiteUrlChanged) {
        void revalidateSeoPaths().catch(() => {
          toast.warning('Đã lưu, đồng bộ SEO đang chậm.');
        });
      }
      setInitialForm({ ...form });
      setInitialHeaderConfig(normalizeHeaderConfig(headerConfigDraft));
      toast.success('Đã lưu cài đặt thành công!');
    } catch (error) {
      console.error('Save settings error:', error);
      toast.error(`Lỗi khi lưu: ${error instanceof Error ? error.message : 'Không xác định'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Render field based on type
  const renderField = (field: NonNullable<typeof fieldsData>[number]) => {
    const value = form[field.fieldKey];
    const stringValue = typeof value === 'string' ? value : '';
    const key = field.fieldKey;
    const metaLimit = SEO_META_LIMITS[key];
    const showCounter = Boolean(metaLimit);
    const counterText = showCounter ? `${stringValue.length}/${metaLimit}` : null;

    switch (field.type) {
      case 'color': {
        if (key === 'site_brand_secondary') {
          const primaryColor = (form.site_brand_primary as string) || (form.site_brand_color as string) || '#3b82f6';
          const normalizedPrimary = isValidHexColor(primaryColor) ? primaryColor : '#3b82f6';
          const derivedSecondary = generateComplementary(normalizedPrimary);
          const displayColor = isSecondaryModeSingle ? derivedSecondary : (isSecondaryAuto ? derivedSecondary : stringValue);
          const isSecondaryDisabled = isSecondaryAuto || isSecondaryModeSingle;

          return (
            <div className="space-y-2" key={key}>
              <div className="flex items-center justify-between gap-3">
                <Label className={cn(isSecondaryModeSingle && 'opacity-50')}>{field.name}</Label>
                <label className="flex items-center gap-2 text-xs text-slate-500">
                  <input
                    type="checkbox"
                    checked={isSecondaryAuto}
                    onChange={(e) => {
                      if (isSecondaryModeSingle) {return;}
                      const auto = e.target.checked;
                      setIsSecondaryAuto(auto);
                      if (auto) {
                        updateField(key, '');
                      }
                    }}
                    className="rounded border-slate-300"
                    disabled={isSecondaryModeSingle}
                  />
                  Tự động sinh từ màu chính
                </label>
              </div>
              <div className="flex items-center gap-3">
                <input
                type="color"
                value={isValidHexColor(displayColor) ? displayColor : derivedSecondary}
                  onChange={(e) => {
                    if (!isSecondaryDisabled) {
                      updateField(key, e.target.value);
                    }
                  }}
                  className="w-10 h-10 rounded-lg cursor-pointer border border-slate-200 dark:border-slate-700"
                  disabled={isSecondaryDisabled}
                />
                <Input
                  value={(displayColor || '').toUpperCase()}
                  onChange={(e) => {
                    if (!isSecondaryDisabled) {
                      updateField(key, e.target.value);
                    }
                  }}
                  className="w-28 font-mono text-sm uppercase"
                  maxLength={7}
                  placeholder="#000000"
                  disabled={isSecondaryDisabled}
                />
                <Palette size={16} className="text-slate-400" />
              </div>
              {displayColor && isValidHexColor(displayColor) && (
                <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                  {generateTintsShades(displayColor).map((shade, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() =>{
                        if (!isSecondaryDisabled) {
                          updateField(key, shade);
                        }
                      }}
                      className="flex-1 h-8 transition-all hover:scale-y-125 hover:z-10 relative group"
                      style={{ backgroundColor: shade }}
                      title={shade.toUpperCase()}
                      disabled={isSecondaryDisabled}
                    >
                      <span
                        className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 text-[8px] font-mono font-bold"
                        style={{ color: idx < 5 ? '#000' : '#fff' }}
                      >
                        {shade.toUpperCase().slice(1)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        }

        return (
        <div className="space-y-2" key={key}>
            <Label>{field.name}</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
              value={isValidHexColor(stringValue) ? stringValue : '#3b82f6'}
                onChange={(e) =>{  updateField(key, e.target.value); }}
                className="w-10 h-10 rounded-lg cursor-pointer border border-slate-200 dark:border-slate-700"
              />
              <Input
              value={stringValue.toUpperCase()}
                onChange={(e) => {
                  const val = e.target.value;
                  updateField(key, val);
                }}
                className="w-28 font-mono text-sm uppercase"
                maxLength={7}
                placeholder="#000000"
              />
              <Palette size={16} className="text-slate-400" />
            </div>
            {stringValue && isValidHexColor(stringValue) && (
              <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                {generateTintsShades(stringValue).map((shade, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() =>{  updateField(key, shade); }}
                    className="flex-1 h-8 transition-all hover:scale-y-125 hover:z-10 relative group"
                    style={{ backgroundColor: shade }}
                    title={shade.toUpperCase()}
                  >
                    <span
                      className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 text-[8px] font-mono font-bold"
                      style={{ color: idx < 5 ? '#000' : '#fff' }}
                    >
                      {shade.toUpperCase().slice(1)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      }

      case 'boolean': {
        const checked = value === true || value === 'true';
        return (
          <div className="flex items-center justify-between gap-3" key={key}>
            <Label>{field.name}</Label>
            <label className="flex items-center gap-2 text-xs text-slate-500">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => { updateField(key, e.target.checked); }}
                className="rounded border-slate-300"
              />
              {checked ? 'Đang bật' : 'Đang tắt'}
            </label>
          </div>
        );
      }

      case 'textarea': {
        if (key === 'contact_address') {
          const lat = typeof form.contact_lat === 'string' ? form.contact_lat : '10.762622';
          const lng = typeof form.contact_lng === 'string' ? form.contact_lng : '106.660172';
          const mapProvider = form.contact_map_provider === 'google_embed'
            ? 'google_embed'
            : 'openstreetmap';
          const googleIframe = typeof form.contact_google_map_embed_iframe === 'string'
            ? form.contact_google_map_embed_iframe
            : '';

          return (
            <div className="space-y-2" key={key}>
              <Label>{field.name} {field.required && <span className="text-red-500">*</span>}</Label>
              <textarea
                value={stringValue}
                onChange={(e) => updateField(key, e.target.value)}
                className="w-full min-h-[80px] rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                placeholder="Nhập địa chỉ..."
              />
              <div className="space-y-2">
                <Label>Loại bản đồ</Label>
                <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="contact_map_provider"
                      value="openstreetmap"
                      checked={mapProvider === 'openstreetmap'}
                      onChange={() => updateField('contact_map_provider', 'openstreetmap')}
                      className="rounded-full border-slate-300"
                    />
                    OpenStreetMap
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="contact_map_provider"
                      value="google_embed"
                      checked={mapProvider === 'google_embed'}
                      onChange={() => updateField('contact_map_provider', 'google_embed')}
                      className="rounded-full border-slate-300"
                    />
                    Google Maps nhúng
                  </label>
                </div>
              </div>
              {mapProvider === 'openstreetmap' ? (
                <MapLocationPicker
                  address={stringValue}
                  lat={lat}
                  lng={lng}
                  onLocationChange={(data) => {
                    updateField('contact_address', data.address);
                    updateField('contact_lat', data.lat);
                    updateField('contact_lng', data.lng);
                  }}
                />
              ) : (
                <div className="space-y-2">
                  <Label>Mã Google Maps iframe</Label>
                  <textarea
                    value={googleIframe}
                    onChange={(e) => updateField('contact_google_map_embed_iframe', e.target.value)}
                    className="w-full min-h-[120px] rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-mono"
                    placeholder="Dán nguyên mã iframe Google Maps..."
                  />
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        window.open('https://www.google.com/maps', '_blank', 'noopener,noreferrer');
                      }}
                    >
                      Mở Google Maps
                    </Button>
                    <span className="text-xs text-slate-500">
                      Mở Google Maps để lấy mã nhúng iframe rồi dán vào ô phía trên.
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">Chỉ dán mã iframe do Google Maps cung cấp.</p>
                </div>
              )}
            </div>
          );
        }

        return (
          <div className="space-y-2" key={key}>
            <div className="flex items-center justify-between gap-3">
              <Label>{field.name} {field.required && <span className="text-red-500">*</span>}</Label>
              {counterText && (
                <span className={`text-xs ${stringValue.length > metaLimit ? 'text-red-500' : 'text-slate-400'}`}>
                  {counterText}
                </span>
              )}
            </div>
            <textarea
              value={stringValue}
              onChange={(e) =>{  updateField(key, e.target.value); }}
              className="w-full min-h-[80px] rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              placeholder={`Nhập ${field.name.toLowerCase()}...`}
            />
          </div>
        );
      }

      case 'select': {
        // Handle specific select fields
        if (key === 'site_timezone') {
          return (
            <div className="space-y-2" key={key}>
              <Label>{field.name}</Label>
              <select
                value={stringValue}
                onChange={(e) =>{  updateField(key, e.target.value); }}
                className="w-full h-10 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              >
                <option value="Asia/Ho_Chi_Minh">GMT+07:00 Bangkok, Hanoi, Jakarta</option>
                <option value="Asia/Singapore">GMT+08:00 Singapore, Hong Kong</option>
                <option value="Asia/Tokyo">GMT+09:00 Tokyo, Seoul</option>
                <option value="Europe/London">GMT+00:00 London, Dublin</option>
              </select>
            </div>
          );
        }
        if (key === 'site_language') {
          return (
            <div className="space-y-2" key={key}>
              <Label>{field.name}</Label>
              <select
                value={stringValue}
                onChange={(e) =>{  updateField(key, e.target.value); }}
                className="w-full h-10 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              >
                <option value="vi">Tiếng Việt</option>
                <option value="en">English</option>
              </select>
            </div>
          );
        }
        // Default select - render as text input
        return (
          <div className="space-y-2" key={key}>
            <Label>{field.name} {field.required && <span className="text-red-500">*</span>}</Label>
            <Input
              value={stringValue}
              onChange={(e) =>{  updateField(key, e.target.value); }}
              placeholder={`Nhập ${field.name.toLowerCase()}...`}
            />
          </div>
        );
      }

      case 'number': {
        return (
          <div className="space-y-2" key={key}>
            <Label>{field.name} {field.required && <span className="text-red-500">*</span>}</Label>
            <Input
              type="number"
              value={stringValue}
              onChange={(e) =>{  updateField(key, e.target.value); }}
              placeholder={`Nhập ${field.name.toLowerCase()}...`}
            />
          </div>
        );
      }

      case 'image': {
        const isFaviconField = key === 'site_favicon';
        const isProductPlaceholderField = key === 'product_image_placeholder';
        const isSeoImageField = key === 'seo_og_image';
        const logoValue = typeof form.site_logo === 'string' ? form.site_logo : '';
        const handleUseLogo = (targetKey: 'site_favicon' | 'product_image_placeholder' | 'seo_og_image') => {
          if (!logoValue) {
            toast.error('Chưa có logo để dùng.');
            return;
          }
          updateImageField(targetKey, logoValue, mediaStorageIds.site_logo ?? null);
          toast.success(targetKey === 'site_favicon' ? 'Đã dùng logo làm favicon.' : targetKey === 'product_image_placeholder' ? 'Đã dùng logo làm placeholder sản phẩm.' : 'Đã dùng logo làm OG Image.');
        };

        return (
          <div className="space-y-2" key={key}>
            <SettingsImageUploader
              label={field.name}
              value={stringValue}
              storageId={mediaStorageIds[key] ?? undefined}
              onChange={(url, storageId) =>{  updateImageField(key, url, storageId); }}
              folder="settings"
              previewSize={key.includes('favicon') ? 'sm' : 'md'}
              smartLogoCrop={key === 'site_logo'}
            />
            {isFaviconField && (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleUseLogo('site_favicon')}
                >
                  Dùng logo hiện tại
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>{  updateImageField('site_favicon', '', null); }}
                >
                  Xóa favicon
                </Button>
              </div>
            )}
            {isProductPlaceholderField && (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleUseLogo('product_image_placeholder')}
                  disabled={!logoValue}
                >
                  Dùng logo hiện tại
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>{  updateImageField('product_image_placeholder', '', null); }}
                >
                  Xóa placeholder
                </Button>
              </div>
            )}
            {isSeoImageField && (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleUseLogo('seo_og_image')}
                  disabled={!logoValue}
                >
                  Dùng logo hiện tại
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>{  updateImageField('seo_og_image', '', null); }}
                >
                  Xóa ảnh
                </Button>
              </div>
            )}
          </div>
        );
      }

      case 'email': {
        return (
          <div className="space-y-2" key={key}>
            <Label>{field.name} {field.required && <span className="text-red-500">*</span>}</Label>
            <Input
              type="email"
              value={stringValue}
              onChange={(e) =>{  updateField(key, e.target.value); }}
              placeholder="example@domain.com"
            />
          </div>
        );
      }

      case 'phone': {
        return (
          <div className="space-y-2" key={key}>
            <Label>{field.name} {field.required && <span className="text-red-500">*</span>}</Label>
            <Input
              type="tel"
              value={stringValue}
              onChange={(e) =>{  updateField(key, e.target.value); }}
              placeholder="0901234567"
            />
          </div>
        );
      }

      case 'tags': {
        return (
          <div className="space-y-2" key={key}>
            <Label>{field.name}</Label>
            <TagInput
              value={stringValue}
              onChange={(val) =>{  updateField(key, val); }}
              placeholder="Nhập từ khóa và nhấn Enter..."
            />
            <p className="text-xs text-slate-500">Nhấn Enter để thêm, Backspace để xóa</p>
          </div>
        );
      }

      default: { // Text
        return (
          <div className="space-y-2" key={key}>
            <div className="flex items-center justify-between gap-3">
              <Label>{field.name} {field.required && <span className="text-red-500">*</span>}</Label>
              {counterText && (
                <span className={`text-xs ${stringValue.length > metaLimit ? 'text-red-500' : 'text-slate-400'}`}>
                  {counterText}
                </span>
              )}
            </div>
            <Input
              value={stringValue}
              onChange={(e) =>{  updateField(key, e.target.value); }}
              placeholder={`Nhập ${field.name.toLowerCase()}...`}
            />
          </div>
        );
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!isSectionEnabled) {
    return null;
  }

  const currentFields = fieldsByGroup[section] ?? [];
  const socialFields = section === 'contact' ? (fieldsByGroup.social ?? []) : [];
  const hasAdvancedPlaceholderField = currentFields.some(field => field.fieldKey === 'product_image_placeholder');
  const headerCta = {
    ...DEFAULT_HEADER_CONFIG.cta,
    ...headerConfigDraft.cta,
  };
  const logoSizeLevel = typeof headerConfigDraft.logoSizeLevel === 'number' ? headerConfigDraft.logoSizeLevel : 2;
  const headerSpacingLevel = typeof headerConfigDraft.headerSpacingLevel === 'number' ? headerConfigDraft.headerSpacingLevel : 5;
  const logoSizeLabel = LOGO_SIZE_OPTIONS[logoSizeLevel - 1]?.label ?? 'Mặc định';
  const headerSpacingLabel = HEADER_SPACING_OPTIONS[headerSpacingLevel - 1]?.label ?? 'Cân bằng';

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-28">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Cài đặt hệ thống</h1>
        <p className="text-slate-500">Quản lý các cấu hình chung cho website của bạn.</p>
      </div>

      {currentFields.length > 0 || socialFields.length > 0 || section === 'advanced' ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{GROUP_LABELS[section] || SECTION_LABELS[section]}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {section === 'contact' && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>Dữ liệu này hiển thị ở trang /contact</span>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto px-0 text-xs"
                    onClick={() => window.open('/contact', '_blank', 'noopener,noreferrer')}
                  >
                    Mở trang
                  </Button>
                </div>
              )}
              {section === 'advanced' ? (
                <div className="space-y-5">
                  <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setAdvancedTab('product-placeholder')}
                      className={cn(
                        'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                        advancedTab === 'product-placeholder'
                          ? 'border-orange-500 text-slate-900 dark:text-slate-100'
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                      )}
                    >
                      Ảnh sản phẩm
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdvancedTab('product-frame')}
                      className={cn(
                        'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                        advancedTab === 'product-frame'
                          ? 'border-orange-500 text-slate-900 dark:text-slate-100'
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                      )}
                    >
                      Khung viền sản phẩm
                    </button>
                    {canEditHeaderMenu && (
                      <button
                        type="button"
                        onClick={() => setAdvancedTab('header')}
                        className={cn(
                          'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                          advancedTab === 'header'
                            ? 'border-orange-500 text-slate-900 dark:text-slate-100'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                        )}
                      >
                        Header
                      </button>
                    )}
                  </div>

                  {advancedTab === 'product-placeholder' && (
                    <div className="space-y-4">
                      {currentFields.map(field => renderField(field))}
                      {!hasAdvancedPlaceholderField && (
                        <div className="space-y-2">
                          <SettingsImageUploader
                            label="Ảnh placeholder sản phẩm"
                            value={typeof form.product_image_placeholder === 'string' ? form.product_image_placeholder : ''}
                            storageId={mediaStorageIds.product_image_placeholder ?? undefined}
                            onChange={(url, storageId) => { updateImageField('product_image_placeholder', url, storageId); }}
                            folder="settings"
                            previewSize="md"
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const logoValue = typeof form.site_logo === 'string' ? form.site_logo : '';
                                if (!logoValue) {
                                  toast.error('Chưa có logo để dùng.');
                                  return;
                                }
                                updateImageField('product_image_placeholder', logoValue, mediaStorageIds.site_logo ?? null);
                                toast.success('Đã dùng logo làm placeholder sản phẩm.');
                              }}
                              disabled={typeof form.site_logo !== 'string' || !form.site_logo}
                            >
                              Dùng logo hiện tại
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => { updateImageField('product_image_placeholder', '', null); }}
                            >
                              Xóa placeholder
                            </Button>
                          </div>
                          <p className="text-xs text-slate-500">
                            Dùng khi ảnh sản phẩm bị thiếu hoặc link ảnh lỗi.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {advancedTab === 'product-frame' && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <Checkbox
                          id="enable_product_frames"
                          checked={form.enable_product_frames === true}
                          onCheckedChange={(checked) => updateField('enable_product_frames', checked)}
                        />
                        <div className="space-y-0.5">
                          <Label htmlFor="enable_product_frames" className="cursor-pointer">Bật khung viền sản phẩm</Label>
                          <p className="text-xs text-slate-500">
                            Hiển thị khung viền đè lên ảnh sản phẩm ở storefront.
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <SettingsImageUploader
                          label="Ảnh khung viền sản phẩm"
                          value={typeof form.product_frame_overlay_url === 'string' ? form.product_frame_overlay_url : ''}
                          storageId={mediaStorageIds.product_frame_overlay_url ?? undefined}
                          onChange={(url, storageId) => { updateImageField('product_frame_overlay_url', url, storageId); }}
                          folder="settings"
                          previewSize="md"
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => { updateImageField('product_frame_overlay_url', '', null); }}
                          >
                            Xóa khung
                          </Button>
                        </div>
                        <p className="text-xs text-slate-500">
                          Upload ảnh PNG/WebP nền trong suốt. Nên dùng cùng tỷ lệ với ảnh sản phẩm, ví dụ 1:1.
                        </p>
                        {typeof form.product_frame_overlay_url === 'string' && form.product_frame_overlay_url && (
                          <div className="relative mx-auto w-32 h-32 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800">
                            <img
                              src={typeof form.product_image_placeholder === 'string' && form.product_image_placeholder ? form.product_image_placeholder : undefined}
                              alt=""
                              className="absolute inset-0 w-full h-full object-cover"
                            />
                            <img
                              src={form.product_frame_overlay_url}
                              alt="Preview khung viền"
                              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                            />
                            <span className="absolute bottom-1 left-0 right-0 text-center text-[10px] text-slate-500">Preview</span>
                          </div>
                        )}

                      </div>
                    </div>
                  )}

                  {advancedTab === 'header' && canEditHeaderMenu && (
                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                      <div className="space-y-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                        <div className="flex items-start gap-3">
                          <LayoutTemplate className="mt-0.5 h-5 w-5 text-orange-500" />
                          <div>
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Logo Header</h3>
                            <p className="text-xs text-slate-500">
                              Dùng chung với Header Menu ở System Experiences.
                            </p>
                          </div>
                        </div>
                        <SettingsImageUploader
                          label="Logo website"
                          value={typeof form.site_logo === 'string' ? form.site_logo : ''}
                          storageId={mediaStorageIds.site_logo ?? undefined}
                          onChange={(url, storageId) =>{  updateImageField('site_logo', url, storageId); }}
                          folder="settings"
                          previewSize="md"
                          smartLogoCrop
                        />
                        <div className="flex items-center justify-between gap-3">
                          <Label>Tên thương hiệu</Label>
                          <label className="flex items-center gap-2 text-xs text-slate-500">
                            <input
                              type="checkbox"
                              checked={headerConfigDraft.showBrandName !== false}
                              onChange={(event) => updateHeaderConfig('showBrandName', event.target.checked)}
                              className="rounded border-slate-300"
                            />
                            {headerConfigDraft.showBrandName !== false ? 'Đang bật' : 'Đang tắt'}
                          </label>
                        </div>
                        <div className="space-y-2">
                          <Label>Kích thước logo</Label>
                          <select
                            value={logoSizeLevel}
                            onChange={(event) => updateHeaderConfig('logoSizeLevel', Number(event.target.value))}
                            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                          >
                            {LOGO_SIZE_OPTIONS.map(option => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                          <div className="text-xs font-medium text-slate-600 dark:text-slate-400">Đang chọn: {logoSizeLabel}</div>
                        </div>
                        <div className="space-y-2">
                          <Label>Độ thoáng header</Label>
                          <select
                            value={headerSpacingLevel}
                            onChange={(event) => updateHeaderConfig('headerSpacingLevel', Number(event.target.value))}
                            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                          >
                            {HEADER_SPACING_OPTIONS.map(option => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                          <div className="text-xs font-medium text-slate-600 dark:text-slate-400">Đang chọn: {headerSpacingLabel}</div>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                            <Label>Sticky desktop</Label>
                            <input
                              type="checkbox"
                              checked={headerConfigDraft.headerStickyDesktop ?? headerConfigDraft.headerSticky ?? true}
                              onChange={(event) => updateHeaderConfig('headerStickyDesktop', event.target.checked)}
                              className="rounded border-slate-300"
                            />
                          </div>
                          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                            <Label>Sticky mobile</Label>
                            <input
                              type="checkbox"
                              checked={headerConfigDraft.headerStickyMobile ?? headerConfigDraft.headerSticky ?? true}
                              onChange={(event) => updateHeaderConfig('headerStickyMobile', event.target.checked)}
                              className="rounded border-slate-300"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Nền logo</Label>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {LOGO_BACKGROUND_OPTIONS.map(option => (
                              <button
                                key={option.id}
                                type="button"
                                onClick={() => updateHeaderConfig('logoBackgroundStyle', option.id)}
                                className={cn(
                                  'h-8 rounded-md border text-xs font-medium transition-colors',
                                  (headerConfigDraft.logoBackgroundStyle ?? 'none') === option.id
                                    ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                                )}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">CTA Header</h3>
                          <p className="text-xs text-slate-500">
                            Mặc định là “Liên hệ” trỏ về /contact, admin có thể đổi text và đường dẫn.
                          </p>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <Label>Hiển thị CTA</Label>
                          <label className="flex items-center gap-2 text-xs text-slate-500">
                            <input
                              type="checkbox"
                              checked={headerCta.show !== false}
                              onChange={(event) => updateHeaderCta('show', event.target.checked)}
                              className="rounded border-slate-300"
                            />
                            {headerCta.show !== false ? 'Đang bật' : 'Đang tắt'}
                          </label>
                        </div>
                        <div className="space-y-2">
                          <Label>Nhãn CTA</Label>
                          <Input
                            value={headerCta.text ?? 'Liên hệ'}
                            onChange={(event) => updateHeaderCta('text', event.target.value)}
                            placeholder="Liên hệ"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Đường dẫn CTA</Label>
                          <Input
                            value={headerCta.url ?? '/contact'}
                            onChange={(event) => updateHeaderCta('url', event.target.value)}
                            placeholder="/contact"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                currentFields.map(field => renderField(field))
              )}
            </CardContent>
          </Card>
          {section === 'contact' && socialFields.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{GROUP_LABELS.social}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {socialFields.map(field => renderField(field))}
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-slate-500">
            Không có trường nào được bật cho nhóm này.
          </CardContent>
        </Card>
      )}

      <HomeComponentStickyFooter
        isSubmitting={isSaving}
        submitLabel="Lưu thay đổi"
        hasChanges={hasChanges}
        submitType="button"
        onClickSave={handleSave}
        align="between"
      >
        <div className="flex items-center gap-2">
          {section === 'seo' && (
            <>
              <AiSeoImportDialog
                form={form}
                onApply={(payload) => {
                  if (payload.seo_title) updateField('seo_title', payload.seo_title);
                  if (payload.seo_description) updateField('seo_description', payload.seo_description);
                  if (payload.seo_keywords) updateField('seo_keywords', payload.seo_keywords);
                }}
              />
              <SeoBuilderDialog
                form={form}
                onApply={(payload) => {
                  if (payload.seo_title) updateField('seo_title', payload.seo_title);
                  if (payload.seo_description) updateField('seo_description', payload.seo_description);
                  if (payload.seo_keywords) updateField('seo_keywords', payload.seo_keywords);
                }}
              />
            </>
          )}
          <span className={cn("text-sm", hasChanges ? "text-amber-600 dark:text-amber-400" : "text-slate-500")}>
            {hasChanges ? 'Có thay đổi chưa lưu' : 'Đã lưu'}
          </span>
          <Button
            type="button"
            variant="accent"
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className={!hasChanges && !isSaving
              ? 'bg-slate-300 hover:bg-slate-300 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-800 dark:text-slate-400'
              : undefined}
          >
            {isSaving ? (
              <Loader2 size={16} className="mr-2 animate-spin" />
            ) : (
              <Save size={16} className="mr-2" />
            )}
            {isSaving ? 'Đang lưu...' : hasChanges ? 'Lưu thay đổi' : 'Đã lưu'}
          </Button>
        </div>
      </HomeComponentStickyFooter>
    </div>
  );
}
