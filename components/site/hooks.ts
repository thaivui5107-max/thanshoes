'use client';

import { useQuery } from 'convex/react';
import { formatHex, oklch } from 'culori';
import { api } from '@/convex/_generated/api';
import { useInitialBrandColors } from '@/components/providers/InitialBrandColorsProvider';
import { useSnapshotDemoContext } from '@/components/modules/homepage/SnapshotDemoProvider';

const DEFAULT_BRAND_COLOR = '#3b82f6';

const getCssVariableFromDoc = (name: string): string | null => {
  if (typeof document === 'undefined') {return null;}
  const inlineValue = document.documentElement.style.getPropertyValue(name).trim();
  return inlineValue || null;
};

const safeOklch = (value: string) => oklch(value) ?? oklch(DEFAULT_BRAND_COLOR);

const resolveColorSetting = (value: unknown): string | null => {
  if (typeof value !== 'string') {return null;}
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const generateComplementary = (hex: string): string => {
  const parsed = safeOklch(hex);
  if (!parsed) {return DEFAULT_BRAND_COLOR;}

  return formatHex(oklch({
    ...parsed,
    h: ((parsed.h ?? 0) + 180) % 360,
  }));
};

export function useBrandColors() {
  const snapshotDemo = useSnapshotDemoContext();
  const initialBrandColors = useInitialBrandColors();
  const snapshotSite = snapshotDemo?.getSiteSettings();
  // Skip DB queries entirely when snapshot provides site settings
  const skipDb = Boolean(snapshotSite);
  const primarySetting = useQuery(api.settings.getByKey, skipDb ? 'skip' : { key: 'site_brand_primary' });
  const legacySetting = useQuery(api.settings.getByKey, skipDb ? 'skip' : { key: 'site_brand_color' });
  const secondarySetting = useQuery(api.settings.getByKey, skipDb ? 'skip' : { key: 'site_brand_secondary' });
  const modeSetting = useQuery(api.settings.getByKey, skipDb ? 'skip' : { key: 'site_brand_mode' });
  const primary = resolveColorSetting(snapshotSite?.site_brand_primary)
    ?? resolveColorSetting(snapshotSite?.site_brand_color)
    ?? resolveColorSetting(primarySetting?.value)
    ?? resolveColorSetting(legacySetting?.value)
    ?? initialBrandColors?.primary
    ?? resolveColorSetting(getCssVariableFromDoc('--site-brand-primary'))
    ?? DEFAULT_BRAND_COLOR;
  const mode = snapshotSite?.site_brand_mode
    ?? (modeSetting?.value === 'single'
      ? 'single'
      : (initialBrandColors?.mode ?? (getCssVariableFromDoc('--site-brand-mode') === 'single' ? 'single' : 'dual')));
  const secondary = mode === 'single'
    ? ''
    : resolveColorSetting(snapshotSite?.site_brand_secondary)
      ?? resolveColorSetting(secondarySetting?.value)
      ?? initialBrandColors?.secondary
      ?? resolveColorSetting(getCssVariableFromDoc('--site-brand-secondary'))
      ?? generateComplementary(primary);

  return { primary, secondary, mode };
}

// Hook lấy brandColor từ settings
export function useBrandColor() {
  return useBrandColors().primary;
}

// Hook lấy site settings
export function useSiteSettings() {
  const snapshotDemo = useSnapshotDemoContext();
  const snapshotSite = snapshotDemo?.getSiteSettings();
  const settings = useQuery(api.settings.listByGroup, snapshotSite ? 'skip' : { group: 'site' });
  
  if (!snapshotSite && settings === undefined) {
    return { isLoading: true, settings: {} as Record<string, string | boolean> };
  }
  
  const settingsMap: Record<string, string | boolean> = {};
  if (snapshotSite) {
    Object.entries(snapshotSite).forEach(([key, value]) => {
      settingsMap[key] = value;
    });
  } else {
    settings?.forEach(s => {
      settingsMap[s.key] = typeof s.value === 'boolean' ? s.value : (s.value as string);
    });
  }
  
  const brandPrimary = (settingsMap.site_brand_primary as string) || (settingsMap.site_brand_color as string) || DEFAULT_BRAND_COLOR;
  const brandMode = settingsMap.site_brand_mode === 'single' ? 'single' : 'dual';
  const brandSecondary = brandMode === 'single'
    ? ''
    : (settingsMap.site_brand_secondary as string) || generateComplementary(brandPrimary);

  return {
    brandColor: brandPrimary,
    brandPrimary,
    brandSecondary,
    favicon: (settingsMap.site_favicon as string) || '',
    isLoading: false,
    logo: (settingsMap.site_logo as string) || '',
    settings: settingsMap,
    siteDescription: (settingsMap.site_description as string) || '',
    siteName: (settingsMap.site_name as string) || 'Website',
  };
}

// Hook lấy contact settings
export function useContactSettings() {
  const snapshotDemo = useSnapshotDemoContext();
  const snapshotContact = snapshotDemo?.getContactSettings();
  const settings = useQuery(api.settings.listByGroup, snapshotContact ? 'skip' : { group: 'contact' });
  
  if (!snapshotContact && settings === undefined) {
    return { isLoading: true };
  }
  
  const settingsMap: Record<string, string> = {};
  if (snapshotContact) {
    Object.entries(snapshotContact).forEach(([key, value]) => {
      settingsMap[key] = value;
    });
  } else {
    settings?.forEach(s => {
      settingsMap[s.key] = s.value as string;
    });
  }
  
  return {
    address: settingsMap.contact_address || '',
    email: settingsMap.contact_email || '',
    isLoading: false,
    phone: settingsMap.contact_phone || '',
  };
}

// Hook lấy social links settings
export function useSocialLinks() {
  const snapshotDemo = useSnapshotDemoContext();
  const snapshotSocial = snapshotDemo?.getSocialSettings();
  const snapshotContact = snapshotDemo?.getContactSettings();
  const skipSocial = Boolean(snapshotSocial);
  const skipContact = Boolean(snapshotContact);
  const settings = useQuery(api.settings.listByGroup, skipSocial ? 'skip' : { group: 'social' });
  const contactSettings = useQuery(api.settings.listByGroup, skipContact ? 'skip' : { group: 'contact' });
  
  if (!snapshotSocial && (settings === undefined || contactSettings === undefined)) {
    return { isLoading: true };
  }
  
  const settingsMap: Record<string, string> = {};
  if (snapshotSocial) {
    Object.entries(snapshotSocial).forEach(([key, value]) => {
      settingsMap[key] = value;
    });
  } else {
    settings?.forEach(s => {
      settingsMap[s.key] = s.value as string;
    });
  }

  const contactMap: Record<string, string> = {};
  if (snapshotContact) {
    Object.entries(snapshotContact).forEach(([key, value]) => {
      contactMap[key] = value;
    });
  } else {
    contactSettings?.forEach(s => {
      contactMap[s.key] = s.value as string;
    });
  }
  
  return {
    facebook: settingsMap.social_facebook || '',
    instagram: settingsMap.social_instagram || '',
    isLoading: false,
    linkedin: settingsMap.social_linkedin || '',
    tiktok: settingsMap.social_tiktok || '',
    twitter: settingsMap.social_twitter || '',
    youtube: settingsMap.social_youtube || '',
    zalo: contactMap.contact_zalo || '',
  };
}
