'use client';

import React, { useMemo, useState } from 'react';
import { Eye, EyeOff, Loader2, Save, Send, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SETTINGS_KEYS = [
  'mail_driver',
  'mail_host',
  'mail_port',
  'mail_username',
  'mail_password',
  'mail_encryption',
  'mail_from_email',
  'mail_from_name',
  'resend_accounts',
  'order_notification_emails',
] as const;

type SettingsKey = (typeof SETTINGS_KEYS)[number];

const sanitizeHtml = (html: string) => html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
const toSafeString = (value: unknown) => (typeof value === 'string' ? value : '');

interface ResendAccount {
  id: string;
  label: string;
  apiKey: string;
  fromEmail?: string;
  fromName?: string;
  enabled: boolean;
  dailyLimit: number;
  monthlyLimit: number;
  testMode: boolean;
}

export default function IntegrationsPage() {
  const settings = useQuery(api.settings.getMultiple, { keys: [...SETTINGS_KEYS] });
  const setMultiple = useMutation(api.settings.setMultiple);

  const [form, setForm] = useState<Record<SettingsKey, string>>({
    mail_driver: 'smtp',
    mail_host: '',
    mail_port: '587',
    mail_username: '',
    mail_password: '',
    mail_encryption: 'tls',
    mail_from_email: '',
    mail_from_name: '',
    resend_accounts: '[]',
    order_notification_emails: '',
  });

  const [initialForm, setInitialForm] = useState<Record<SettingsKey, string>>(form);
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [previewSubject, setPreviewSubject] = useState('Xin chào từ Thanshoes');
  const [previewHtml, setPreviewHtml] = useState('<p>Đây là email test từ hệ thống điều phối email.</p>');
  const [testEmail, setTestEmail] = useState('');
  const [isSending, setIsSending] = useState(false);

  // States for Resend accounts UI
  const [accounts, setAccounts] = useState<ResendAccount[]>([]);
  const [newAccLabel, setNewAccLabel] = useState('');
  const [newAccApiKey, setNewAccApiKey] = useState('');
  const [newAccFromEmail, setNewAccFromEmail] = useState('');
  const [newAccFromName, setNewAccFromName] = useState('');
  const [newAccDailyLimit, setNewAccDailyLimit] = useState(100);
  const [newAccMonthlyLimit, setNewAccMonthlyLimit] = useState(3000);
  const [newAccTestMode, setNewAccTestMode] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  React.useEffect(() => {
    if (!settings) return;
    const nextForm = { ...form };
    SETTINGS_KEYS.forEach((key) => {
      const value = settings[key];
      nextForm[key] = toSafeString(value);
    });
    if (!nextForm.mail_driver) nextForm.mail_driver = 'smtp';
    if (!nextForm.mail_encryption) nextForm.mail_encryption = 'tls';
    if (!nextForm.resend_accounts) nextForm.resend_accounts = '[]';
    
    setForm(nextForm);
    setInitialForm(nextForm);

    try {
      const parsed = JSON.parse(nextForm.resend_accounts);
      if (Array.isArray(parsed)) {
        setAccounts(parsed);
      }
    } catch {
      setAccounts([]);
    }
  }, [settings]);

  // Sync accounts state to form value
  const updateAccountsInForm = (updatedAccounts: ResendAccount[]) => {
    setAccounts(updatedAccounts);
    setForm((prev) => ({
      ...prev,
      resend_accounts: JSON.stringify(updatedAccounts),
    }));
  };

  const hasChanges = useMemo(() => {
    return SETTINGS_KEYS.some((key) => form[key] !== initialForm[key]);
  }, [form, initialForm]);

  const updateField = (key: SettingsKey, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validatePort = () => {
    if (form.mail_driver === 'resend') return true;
    if (!form.mail_port) return true;
    const port = Number(form.mail_port);
    return Number.isFinite(port) && port > 0;
  };

  const handleSave = async () => {
    if (!validatePort()) {
      toast.error('Cổng kết nối SMTP không hợp lệ.');
      return;
    }

    setIsSaving(true);
    try {
      const settingsToSave = SETTINGS_KEYS.map((key) => ({
        group: 'mail',
        key,
        value: form[key].trim(),
      }));
      await setMultiple({ settings: settingsToSave });
      setInitialForm({ ...form });
      toast.success('Đã lưu cấu hình email thành công!');
    } catch {
      toast.error('Lỗi khi lưu cấu hình.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccLabel.trim()) {
      toast.error('Vui lòng nhập nhãn tài khoản.');
      return;
    }
    if (!newAccApiKey.trim() || !newAccApiKey.startsWith('re_')) {
      toast.error('API Key Resend không hợp lệ (phải bắt đầu bằng re_).');
      return;
    }

    const newAcc: ResendAccount = {
      id: `acc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      label: newAccLabel.trim(),
      apiKey: newAccApiKey.trim(),
      fromEmail: newAccFromEmail.trim() || undefined,
      fromName: newAccFromName.trim() || undefined,
      enabled: true,
      dailyLimit: newAccDailyLimit,
      monthlyLimit: newAccMonthlyLimit,
      testMode: newAccTestMode,
    };

    const updated = [...accounts, newAcc];
    updateAccountsInForm(updated);

    // Reset inputs
    setNewAccLabel('');
    setNewAccApiKey('');
    setNewAccFromEmail('');
    setNewAccFromName('');
    setNewAccDailyLimit(100);
    setNewAccMonthlyLimit(3000);
    setNewAccTestMode(true);
    setShowAddForm(false);
    toast.success('Đã thêm tài khoản Resend mới. Nhớ nhấn "Lưu thay đổi"!');
  };

  const handleRemoveAccount = (id: string) => {
    const updated = accounts.filter((acc) => acc.id !== id);
    updateAccountsInForm(updated);
    toast.success('Đã gỡ tài khoản Resend. Nhớ nhấn "Lưu thay đổi"!');
  };

  const handleToggleAccount = (id: string) => {
    const updated = accounts.map((acc) =>
      acc.id === id ? { ...acc, enabled: !acc.enabled } : acc
    );
    updateAccountsInForm(updated);
  };

  const handleSendTest = async () => {
    if (!EMAIL_REGEX.test(testEmail.trim())) {
      toast.error('Email nhận không hợp lệ.');
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch('/api/system/integrations/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: testEmail.trim(),
          subject: previewSubject.trim() || 'Test email',
          html: previewHtml || '<p>Test email</p>',
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.message || 'Gửi test email thất bại.');
      }
      toast.success('Đã gửi email test thành công! Vui lòng kiểm tra hộp thư.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gửi test email thất bại.';
      toast.error(message);
    } finally {
      setIsSending(false);
    }
  };

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-16">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">Cấu hình Tích hợp Email</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
          Quản lý kênh gửi email giao dịch (SMTP truyền thống hoặc API Resend điều phối tải).
        </p>
      </div>

      {/* Driver Selector */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-4">Phương thức gửi chính (Driver)</h3>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => updateField('mail_driver', 'smtp')}
            className={`flex-1 py-4 px-6 rounded-2xl border text-sm font-semibold transition-all text-center flex flex-col items-center justify-center gap-1 cursor-pointer ${
              form.mail_driver === 'smtp'
                ? 'border-indigo-600 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-950'
            }`}
          >
            <span className="text-base font-bold">SMTP Server</span>
            <span className="text-xs font-normal">Gửi qua mail server của bên thứ ba (Gmail, Outlook, v.v.)</span>
          </button>
          <button
            type="button"
            onClick={() => updateField('mail_driver', 'resend')}
            className={`flex-1 py-4 px-6 rounded-2xl border text-sm font-semibold transition-all text-center flex flex-col items-center justify-center gap-1 cursor-pointer ${
              form.mail_driver === 'resend'
                ? 'border-indigo-600 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-950'
            }`}
          >
            <span className="text-base font-bold">Resend API Router</span>
            <span className="text-xs font-normal">Điều phối thông minh qua một hoặc nhiều tài khoản Resend</span>
          </button>
        </div>
      </div>

      {/* Main Settings Form */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
            {form.mail_driver === 'smtp' ? 'Cấu hình SMTP Server' : 'Quản lý tài khoản Resend'}
          </h3>
          <span className={`text-[10px] px-2.5 py-1 rounded-full border font-bold uppercase tracking-wider ${
            form.mail_driver === 'smtp'
              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
              : 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20'
          }`}>
            {form.mail_driver}
          </span>
        </div>

        {/* ─── SMTP CONFIG FIELDS ────────────────────────────────────────────── */}
        {form.mail_driver === 'smtp' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">Tên người gửi (From Name)</label>
              <input
                value={form.mail_from_name}
                onChange={(e) => updateField('mail_from_name', e.target.value)}
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="Thanshoes Store"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">Email gửi đi (From Email)</label>
              <input
                value={form.mail_from_email}
                onChange={(e) => updateField('mail_from_email', e.target.value)}
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="noreply@example.com"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">SMTP Host</label>
              <input
                value={form.mail_host}
                onChange={(e) => updateField('mail_host', e.target.value)}
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="smtp.gmail.com"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">SMTP Port</label>
              <input
                value={form.mail_port}
                onChange={(e) => updateField('mail_port', e.target.value)}
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">Tài khoản (Username)</label>
              <input
                value={form.mail_username}
                onChange={(e) => updateField('mail_username', e.target.value)}
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">Mật khẩu (Password)</label>
              <div className="relative">
                <input
                  value={form.mail_password}
                  onChange={(e) => updateField('mail_password', e.target.value)}
                  type={showPassword ? 'text' : 'password'}
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm pr-12 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  title={showPassword ? 'Hide' : 'Show'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">Mã hóa (Encryption)</label>
              <select
                value={form.mail_encryption}
                onChange={(e) => updateField('mail_encryption', e.target.value)}
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
              >
                <option value="tls">TLS</option>
                <option value="ssl">SSL</option>
                <option value="">None</option>
              </select>
            </div>
          </div>
        )}

        {/* ─── RESEND CONFIG FIELDS ──────────────────────────────────────────── */}
        {form.mail_driver === 'resend' && (
          <div className="space-y-6">
            {/* Global fallback sender details */}
            <div className="grid gap-4 sm:grid-cols-2 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-900">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Tên người gửi mặc định (Fallback From Name)</label>
                <input
                  value={form.mail_from_name}
                  onChange={(e) => updateField('mail_from_name', e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm focus:outline-none"
                  placeholder="Thanshoes Store"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Email gửi đi mặc định (Fallback From Email)</label>
                <input
                  value={form.mail_from_email}
                  onChange={(e) => updateField('mail_from_email', e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm focus:outline-none"
                  placeholder="onboarding@resend.dev"
                />
              </div>
            </div>

            {/* Warning Note */}
            <div className="flex gap-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-4 rounded-2xl text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
              <AlertTriangle size={18} className="shrink-0 text-amber-500" />
              <div>
                <span className="font-bold">Lưu ý về Quota:</span> Việc thêm nhiều API key cùng thuộc một Resend Team/Organization sẽ <span className="font-bold">không giúp tăng quota</span> của team đó. Quota Resend được tính theo Organization của Resend. Bạn nên sử dụng các API key của các tài khoản (hộp thư/tổ chức) khác nhau để tăng tổng quota.
              </div>
            </div>

            {/* List of Accounts */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Danh sách tài khoản</h4>
                <button
                  type="button"
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  <Plus size={14} /> Thêm tài khoản
                </button>
              </div>

              {accounts.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                  Chưa cấu hình tài khoản Resend nào. Vui lòng bấm thêm mới.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {accounts.map((acc) => (
                    <div
                      key={acc.id}
                      className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-3 bg-slate-50/50 dark:bg-slate-950/30"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-sm text-slate-800 dark:text-slate-200">{acc.label}</div>
                          <div className="text-[10px] font-mono text-slate-400 mt-1">re_***{acc.apiKey.substring(acc.apiKey.length - 6)}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                            Từ: {acc.fromName || 'Mặc định'} &lt;{acc.fromEmail || 'Mặc định'}&gt;
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveAccount(acc.id)}
                          className="text-slate-400 hover:text-rose-500 transition-colors p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex items-center justify-between text-[11px] text-slate-500">
                        <div className="flex flex-col gap-0.5">
                          <div>Daily limit: <span className="font-semibold text-slate-700 dark:text-slate-300">{acc.dailyLimit}</span></div>
                          <div>Monthly limit: <span className="font-semibold text-slate-700 dark:text-slate-300">{acc.monthlyLimit}</span></div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={acc.enabled}
                              onChange={() => handleToggleAccount(acc.id)}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                            <span>Bật</span>
                          </label>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            acc.testMode 
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' 
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                          }`}>
                            {acc.testMode ? 'TEST MODE' : 'PROD MODE'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add New Account Form Modal-like Card */}
            {showAddForm && (
              <form onSubmit={handleAddAccount} className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200">Thêm tài khoản Resend</h5>
                
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Tên nhãn (Label)</label>
                    <input
                      type="text"
                      required
                      value={newAccLabel}
                      onChange={(e) => setNewAccLabel(e.target.value)}
                      placeholder="Ví dụ: Resend Free Acc 1"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Resend API Key</label>
                    <input
                      type="password"
                      required
                      value={newAccApiKey}
                      onChange={(e) => setNewAccApiKey(e.target.value)}
                      placeholder="re_..."
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Người gửi tùy chọn (From Name)</label>
                    <input
                      type="text"
                      value={newAccFromName}
                      onChange={(e) => setNewAccFromName(e.target.value)}
                      placeholder="Để trống nếu dùng mặc định"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Email gửi tùy chọn (From Email)</label>
                    <input
                      type="email"
                      value={newAccFromEmail}
                      onChange={(e) => setNewAccFromEmail(e.target.value)}
                      placeholder="Để trống nếu dùng mặc định"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Daily Limit (Ngày)</label>
                    <input
                      type="number"
                      required
                      value={newAccDailyLimit}
                      onChange={(e) => setNewAccDailyLimit(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Monthly Limit (Tháng)</label>
                    <input
                      type="number"
                      required
                      value={newAccMonthlyLimit}
                      onChange={(e) => setNewAccMonthlyLimit(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2 flex items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
                    <div>
                      <span className="font-bold block text-slate-700 dark:text-slate-300">Chế độ Thử nghiệm (Test Mode)</span>
                      <span className="text-slate-400">Nếu bật, email sẽ được gửi qua Resend Test Mode (chỉ gửi tới các email đã verify trên console Resend).</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={newAccTestMode}
                      onChange={(e) => setNewAccTestMode(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-5 h-5 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-xs font-semibold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    Đồng ý thêm
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ─── COMMON FIELDS ────────────────────────────────────────────────── */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-5 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500">Email thông báo cho chủ cửa hàng (Order Notification Emails)</label>
            <input
              value={form.order_notification_emails}
              onChange={(e) => updateField('order_notification_emails', e.target.value)}
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              placeholder="admin@example.com, manager@example.com (Phân tách bởi dấu phẩy)"
            />
            <p className="text-[10px] text-slate-400 mt-1">Khi có đơn hàng mới hoặc đơn hàng bị hủy, các email này sẽ nhận được thông báo chi tiết đơn.</p>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {hasChanges && (
            <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">Có thay đổi chưa lưu</span>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 text-white text-sm font-semibold rounded-2xl border border-indigo-600 hover:border-indigo-700 disabled:border-transparent transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed shadow-md"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>

      {/* Test Mail Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Cấu hình Email gửi thử</h3>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500">Tiêu đề email test</label>
            <input
              value={previewSubject}
              onChange={(e) => setPreviewSubject(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm focus:outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500">Nội dung HTML email test</label>
            <textarea
              value={previewHtml}
              onChange={(e) => setPreviewHtml(e.target.value)}
              className="w-full min-h-[160px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm font-mono focus:outline-none"
            />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Xem trước nội dung (Preview)</h3>
          <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-4 bg-slate-50 dark:bg-slate-950 overflow-hidden max-h-[300px] overflow-y-auto">
            <div className="text-xs text-slate-400 mb-2 border-b border-slate-100 dark:border-slate-900 pb-2">Subject: {previewSubject || 'Email Subject'}</div>
            <div
              className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 text-xs"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewHtml || '') }}
            />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Gửi thử Email Test thực tế</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className="flex-1 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm focus:outline-none"
            placeholder="dien-email-nhan@example.com"
          />
          <button
            onClick={handleSendTest}
            disabled={isSending}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-2xl transition-colors disabled:opacity-50 cursor-pointer shadow-md"
          >
            {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {isSending ? 'Đang gửi...' : 'Gửi mail test'}
          </button>
        </div>
      </div>
    </div>
  );
}
