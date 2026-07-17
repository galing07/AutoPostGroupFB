import { useEffect, useState } from 'react';
import { ArrowRight, BadgeCheck, CalendarClock, Copy, Crown, LockKeyhole, QrCode, RefreshCw, Sparkles, Star, Zap } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { createSePayOrder, getPaymentOrder, type PricingPlan, type SePayOrder, type SePayPaymentInfo } from '@/services/paymentService';

const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });

const PLANS: PricingPlan[] = [
  { id: '1month', name: '1 Bulan', months: 1, days: 30, priceUsd: 29, priceVnd: 725000 },
  { id: '2months', name: '2 Bulan', months: 2, days: 60, priceUsd: 49, priceVnd: 1225000, badge: 'Paling Populer' },
  { id: '3months', name: '3 Bulan', months: 3, days: 90, priceUsd: 69, priceVnd: 1725000, badge: 'Paling Hemat' },
];

const planIcons = [<Zap key="z" className="h-6 w-6" />, <Star key="s" className="h-6 w-6" />, <Crown key="c" className="h-6 w-6" />];

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('2months');
  const [order, setOrder] = useState<SePayOrder | null>(null);
  const [payment, setPayment] = useState<SePayPaymentInfo | null>(null);
  const [polling, setPolling] = useState(false);
  const { login, register, forgotPassword, user, hasActiveSubscription, logout, subscriptionEndsAt, refreshSubscription } = useAuthStore();

  const active = hasActiveSubscription();

  useEffect(() => {
    if (!order || order.status !== 'pending') return;

    const timer = window.setInterval(async () => {
      try {
        setPolling(true);
        const result = await getPaymentOrder(order.id);
        setOrder(result.order);
        if (result.order.status === 'paid') {
          await refreshSubscription();
          window.clearInterval(timer);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tidak bisa memeriksa pembayaran');
      } finally {
        setPolling(false);
      }
    }, 5000);

    return () => window.clearInterval(timer);
  }, [order, refreshSubscription]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else if (mode === 'forgot') {
        const result = await forgotPassword(email);
        setSuccess(result.message);
      } else {
        await register(name, email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tidak bisa masuk');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePayment = async (planId: string) => {
    setError('');
    setLoading(true);
    try {
      const result = await createSePayOrder(planId);
      setOrder(result.order);
      setPayment(result.payment);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tidak bisa membuat order pembayaran SePay');
    } finally {
      setLoading(false);
    }
  };

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
  };

  // ─── Payment screen (logged in, no active sub) ───
  if (user && !active) {
    return (
      <div className="min-h-screen overflow-hidden bg-[#05070f] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.35),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.28),transparent_34%)]" />
        <main className="relative mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 py-10">

          {/* Header */}
          <div className="mb-10 text-center">
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-sm text-amber-100">
              <CalendarClock className="h-4 w-4" /> Pilih Paket untuk Membuka Kunci AutoPost
            </div>
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
              Halo, {user.name}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-300">
              Pilih paket yang sesuai dan lakukan pembayaran. Sistem akan otomatis membuka kunci akun setelah uang masuk.
            </p>
          </div>

          {!payment ? (
            <>
              {/* Plan cards */}
              <div className="grid w-full max-w-4xl gap-6 md:grid-cols-3">
                {PLANS.map((plan, i) => {
                  const isSelected = selectedPlan === plan.id;
                  const perMonth = Math.round(plan.priceUsd / plan.months);
                  return (
                    <button
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`relative rounded-[1.5rem] border-2 p-6 text-left transition-all duration-300 ${
                        isSelected
                          ? 'border-blue-400 bg-blue-500/10 shadow-xl shadow-blue-500/20 scale-[1.03]'
                          : 'border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.07]'
                      }`}
                    >
                      {plan.badge && (
                        <span className="absolute -top-3 right-4 rounded-full bg-gradient-to-r from-blue-500 to-violet-500 px-3 py-1 text-xs font-bold text-white shadow-lg">
                          {plan.badge}
                        </span>
                      )}
                      <div className={`mb-4 inline-flex rounded-2xl p-3 ${isSelected ? 'bg-blue-500/20 text-blue-300' : 'bg-white/10 text-slate-300'}`}>
                        {planIcons[i]}
                      </div>
                      <h3 className="text-xl font-bold">{plan.name}</h3>
                      <div className="mt-3">
                        <span className="text-4xl font-black">${plan.priceUsd}</span>
                        <span className="ml-1 text-sm text-slate-400">/ {plan.months} bulan</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-400">{currency.format(plan.priceVnd)}</p>
                      <p className="mt-1 text-xs text-slate-500">~${perMonth}/bulan</p>
                      <div className="mt-4 space-y-2 text-sm text-slate-300">
                        <div>✓ {plan.days} hari digunakan</div>
                        <div>✓ Post otomatis</div>
                        <div>✓ Tulis ulang dengan AI</div>
                        <div>✓ Upload foto native</div>
                      </div>
                      {isSelected && (
                        <div className="mt-4 rounded-xl bg-blue-500/20 py-2 text-center text-sm font-semibold text-blue-200">
                          ✓ Sudah dipilih
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Pay button */}
              <button
                className="mt-8 flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-violet-500 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:scale-[1.02] hover:shadow-blue-500/40 disabled:opacity-60"
                onClick={() => handleCreatePayment(selectedPlan)}
                disabled={loading}
              >
                {loading ? 'Membuat order...' : 'Bayar Sekarang'} <ArrowRight className="h-5 w-5" />
              </button>

              {error && <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 px-6 py-3 text-sm text-red-200">{error}</div>}
            </>
          ) : (
            /* QR payment section */
            <div className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-slate-950/80 p-8 shadow-2xl">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-blue-300">Pembayaran SePay</p>
                  <h2 className="mt-2 text-3xl font-bold">{currency.format(payment.amount)}</h2>
                </div>
                <BadgeCheck className="h-10 w-10 text-blue-300" />
              </div>

              <div className="space-y-4">
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-white p-3">
                  <img src={payment.qrUrl} alt="QR pembayaran SePay" className="mx-auto max-h-72 w-full object-contain" />
                </div>
                <PaymentLine label="Bank" value={payment.bankName} onCopy={() => copy(payment.bankName)} />
                <PaymentLine label="Nomor Rekening" value={payment.accountNumber} onCopy={() => copy(payment.accountNumber)} />
                <PaymentLine label="Nama Pemilik" value={payment.accountHolder} onCopy={() => copy(payment.accountHolder)} />
                <PaymentLine label="Jumlah" value={currency.format(payment.amount)} onCopy={() => copy(String(payment.amount))} />
                <PaymentLine label="Keterangan" value={payment.transferCode} highlight onCopy={() => copy(payment.transferCode)} />

                <div className="rounded-2xl border border-blue-300/20 bg-blue-400/10 p-4 text-sm text-blue-100">
                  <div className="flex items-center gap-2 font-semibold">
                    {polling ? <RefreshCw className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                    Menunggu konfirmasi SePay...
                  </div>
                  <p className="mt-2 text-blue-100/80">Status: {order?.status}. App akan cek otomatis setiap 5 detik.</p>
                </div>
              </div>
            </div>
          )}

          {/* Logout */}
          <button className="mt-6 rounded-2xl border border-white/10 px-6 py-3 text-sm text-slate-300 hover:bg-white/5" onClick={logout}>
            Keluar
          </button>
          {subscriptionEndsAt && <p className="mt-3 text-xs text-emerald-300">Berlaku hingga: {new Date(subscriptionEndsAt).toLocaleString('id-ID')}</p>}
        </main>
      </div>
    );
  }

  // ─── Login / Register screen ───
  return (
    <div className="min-h-screen overflow-hidden bg-[#05070f] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(37,99,235,0.35),transparent_30%),radial-gradient(circle_at_80%_30%,rgba(236,72,153,0.22),transparent_28%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(2,6,23,1))]" />
      <main className="relative mx-auto grid min-h-screen max-w-7xl items-center gap-10 px-6 py-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-300/30 bg-blue-300/10 px-4 py-2 text-sm text-blue-100 backdrop-blur">
            <Sparkles className="h-4 w-4" /> AutoPost FB AI Pro
          </div>
          <div>
            <h1 className="max-w-3xl text-5xl font-black leading-tight tracking-tight md:text-7xl">
              Tiodev, Otomatisasi Posting ke Facebook
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Silakan login ke akun Anda untuk menggunakan sistem, jika ada masalah hubungi Zalo: 0977831621
            </p>
          </div>
          <div className="grid max-w-3xl gap-4 sm:grid-cols-3">
            {[
              ['Keamanan:', '100% aman dan terjamin'],
              ['Sistem', 'Update rutin dan fleksibel'],
              ['Harga', 'Mulai dari $29/bulan'],
            ].map(([title, desc]) => (
              <div key={title} className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-xl">
                <LockKeyhole className="mb-4 h-6 w-6 text-blue-300" />
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-slate-400">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-7 shadow-2xl shadow-blue-950/40 backdrop-blur-2xl">
          <div className="mb-8">
            <p className="text-sm uppercase tracking-[0.35em] text-blue-300">Akses Aman</p>
            <h2 className="mt-3 text-3xl font-bold">{mode === 'login' ? 'Masuk' : mode === 'forgot' ? 'Atur Ulang Kata Sandi' : 'Daftar Akun'}</h2>
            <p className="mt-2 text-sm text-slate-400">Silakan {mode === 'login' ? 'masuk' : mode === 'forgot' ? 'masukkan email Anda' : 'daftar'}</p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {mode === 'register' && (
              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">Nama Pengguna</span>
                <input className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 outline-none ring-blue-400/40 transition focus:ring-4" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" />
              </label>
            )}
            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Email</span>
              <input className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 outline-none ring-blue-400/40 transition focus:ring-4" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pengguna@email.com" type="email" />
            </label>
            
            {mode !== 'forgot' && (
              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">Kata Sandi</span>
                <input className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 outline-none ring-blue-400/40 transition focus:ring-4" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" type="password" />
              </label>
            )}

            {mode === 'login' && (
              <div className="flex justify-end">
                <button type="button" className="text-sm text-blue-400 hover:text-blue-300 transition" onClick={() => { setMode('forgot'); setError(''); setSuccess(''); }}>Lupa kata sandi?</button>
              </div>
            )}

            {error && <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
            {success && <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{success}</div>}

            <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 px-5 py-4 font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60">
              {loading ? 'Sedang memproses...' : mode === 'login' ? 'Masuk' : mode === 'forgot' ? 'Kirim link reset' : 'Daftar Akun'} <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <button className="mt-5 w-full text-sm text-slate-300 hover:text-white" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setSuccess(''); }}>
            {mode === 'login' ? 'Belum punya akun? Daftar' : mode === 'forgot' ? 'Kembali ke login' : 'Sudah punya akun? Masuk'}
          </button>
        </section>
      </main>
    </div>
  );
}

function PaymentLine({ label, value, highlight, onCopy }: { label: string; value: string; highlight?: boolean; onCopy: () => void }) {
  return (
    <div className={`rounded-2xl border p-3 ${highlight ? 'border-emerald-300/40 bg-emerald-400/10' : 'border-white/10 bg-white/5'}`}>
      <div className="mb-1 text-xs uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className="flex items-center justify-between gap-3">
        <span className={`break-all font-semibold ${highlight ? 'text-emerald-200' : 'text-white'}`}>{value}</span>
        <button className="rounded-xl border border-white/10 p-2 text-slate-300 hover:bg-white/10" onClick={onCopy} title="Copy">
          <Copy className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
