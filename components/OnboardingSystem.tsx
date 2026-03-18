import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ─── localStorage Keys (hanya untuk cache & CalcTooltip) ─────────────────────
const LS_ONBOARDING_CACHE = 'jastip_onboarding_cache';
const LS_CALC_TIP         = 'jastip_calc_tip_shown';
const LS_HISTORY_TIP      = 'jastip_history_tip_shown';
const CHECKLIST_DAYS      = 7;

// ─── Types ───────────────────────────────────────────────────────────────────
export interface OnboardingChecklist {
  profileDone: boolean;
  addressDone: boolean;
  orderDone: boolean;
}

export interface OnboardingData {
  completed: boolean;
  completedAt?: any;
  checklist: OnboardingChecklist;
  checklistStartedAt?: any;
}

const DEFAULT_CHECKLIST: OnboardingChecklist = { profileDone: false, addressDone: false, orderDone: false };
const DEFAULT_DATA: OnboardingData = { completed: false, checklist: DEFAULT_CHECKLIST };

// ─── Firestore Helpers ────────────────────────────────────────────────────────
const getOnboardingRef = (uid: string) => doc(db, 'users', uid, 'meta', 'onboarding');

// Baca dari cache localStorage dulu, fallback ke Firestore
export const fetchOnboardingData = async (uid: string): Promise<OnboardingData> => {
  try {
    const cached = localStorage.getItem(LS_ONBOARDING_CACHE);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.uid === uid) return parsed.data as OnboardingData;
    }
  } catch { /* ignore */ }
  try {
    const snap = await getDoc(getOnboardingRef(uid));
    if (snap.exists()) {
      const data = snap.data() as OnboardingData;
      localStorage.setItem(LS_ONBOARDING_CACHE, JSON.stringify({ uid, data }));
      return data;
    }
  } catch { /* ignore */ }
  return DEFAULT_DATA;
};

// Tandai selesai di Firestore + update cache
const completeOnboardingFirestore = async (uid: string) => {
  try {
    const ref = getOnboardingRef(uid);
    const snap = await getDoc(ref);
    const existing = snap.exists() ? snap.data() : {};
    const data = { ...DEFAULT_DATA, ...existing, completed: true, completedAt: serverTimestamp() };
    await setDoc(ref, data, { merge: true });
    localStorage.setItem(LS_ONBOARDING_CACHE, JSON.stringify({ uid, data }));
  } catch (err) { console.error('completeOnboarding error:', err); }
};

// Update satu item checklist di Firestore + cache
export const setChecklistItem = async (uid: string, key: keyof OnboardingChecklist) => {
  try {
    const ref = getOnboardingRef(uid);
    const snap = await getDoc(ref);
    const existing = snap.exists() ? (snap.data() as OnboardingData) : DEFAULT_DATA;
    if (existing.checklist?.[key]) return; // sudah done

    const updatedData: OnboardingData = {
      ...existing,
      checklist: { ...existing.checklist, [key]: true },
      checklistStartedAt: existing.checklistStartedAt || serverTimestamp(),
    };
    if (snap.exists()) {
      await updateDoc(ref, {
        [`checklist.${key}`]: true,
        checklistStartedAt: existing.checklistStartedAt || serverTimestamp(),
      });
    } else {
      await setDoc(ref, updatedData);
    }
    localStorage.setItem(LS_ONBOARDING_CACHE, JSON.stringify({ uid, data: updatedData }));
  } catch (err) { console.error('setChecklistItem error:', err); }
};

// Baca checklist dari cache (sync, untuk update UI instan)
export const getChecklist = (uid?: string): OnboardingChecklist => {
  try {
    const cached = localStorage.getItem(LS_ONBOARDING_CACHE);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (!uid || parsed.uid === uid) return parsed.data?.checklist || DEFAULT_CHECKLIST;
    }
  } catch { /* ignore */ }
  return DEFAULT_CHECKLIST;
};

// Cek completed dari cache (sync)
export const isOnboardingCompleted = (uid?: string): boolean => {
  try {
    const cached = localStorage.getItem(LS_ONBOARDING_CACHE);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (!uid || parsed.uid === uid) return parsed.data?.completed === true;
    }
  } catch { /* ignore */ }
  return false;
};

// Reset onboarding — tombol "Ulangi Tur" di Profil
export const resetOnboarding = async (uid: string) => {
  try {
    await setDoc(getOnboardingRef(uid), DEFAULT_DATA);
    localStorage.removeItem(LS_ONBOARDING_CACHE);
    localStorage.removeItem(LS_CALC_TIP);
  } catch (err) { console.error('resetOnboarding error:', err); }
};

// Auto-complete untuk user lama yang sudah punya transaksi
export const autoCompleteForOldUser = async (uid: string, hasTransactions: boolean): Promise<boolean> => {
  try {
    const snap = await getDoc(getOnboardingRef(uid));
    if (!snap.exists() && hasTransactions) {
      const data: OnboardingData = {
        completed: true,
        completedAt: serverTimestamp(),
        checklist: { profileDone: true, addressDone: true, orderDone: true },
      };
      await setDoc(getOnboardingRef(uid), data);
      localStorage.setItem(LS_ONBOARDING_CACHE, JSON.stringify({ uid, data }));
      return true;
    }
    return false;
  } catch { return false; }
};

// ─── SVG Ilustrasi ────────────────────────────────────────────────────────────
const IllustrationWelcome = () => (
  <svg viewBox="0 0 200 160" className="w-48 h-36 mx-auto" fill="none">
    {/* Awan */}
    <ellipse cx="40" cy="55" rx="22" ry="14" fill="#dbeafe" opacity="0.8"/>
    <ellipse cx="55" cy="48" rx="18" ry="13" fill="#dbeafe" opacity="0.8"/>
    <ellipse cx="160" cy="45" rx="20" ry="12" fill="#dbeafe" opacity="0.6"/>
    <ellipse cx="175" cy="38" rx="16" ry="11" fill="#dbeafe" opacity="0.6"/>
    {/* Pesawat */}
    <g transform="translate(65, 55) rotate(-15)">
      <path d="M0 20 L70 8 L65 20 L70 32 Z" fill="#2563eb" rx="4"/>
      <path d="M20 8 L40 -8 L45 8 Z" fill="#3b82f6"/>
      <path d="M15 32 L30 48 L35 32 Z" fill="#3b82f6"/>
      <circle cx="55" cy="20" r="5" fill="#93c5fd"/>
      <circle cx="43" cy="20" r="3" fill="#93c5fd"/>
      <circle cx="33" cy="20" r="3" fill="#93c5fd"/>
    </g>
    {/* Paket */}
    <g transform="translate(85, 95)">
      <rect x="0" y="0" width="40" height="36" rx="5" fill="#10b981"/>
      <rect x="0" y="0" width="40" height="36" rx="5" fill="none" stroke="#059669" strokeWidth="1.5"/>
      <line x1="20" y1="0" x2="20" y2="36" stroke="#059669" strokeWidth="1.5"/>
      <line x1="0" y1="14" x2="40" y2="14" stroke="#059669" strokeWidth="1.5"/>
      {/* Pita */}
      <path d="M20 -8 C16 -12 12 -6 20 0 C28 -6 24 -12 20 -8Z" fill="#f59e0b"/>
    </g>
    {/* Bintang kecil dekoratif */}
    <circle cx="30" cy="90" r="3" fill="#fbbf24" opacity="0.7"/>
    <circle cx="170" cy="80" r="2" fill="#fbbf24" opacity="0.5"/>
    <circle cx="155" cy="110" r="2.5" fill="#a78bfa" opacity="0.6"/>
  </svg>
);

// ─── STEP TOUR DEFINITIONS ────────────────────────────────────────────────────
interface TourStep {
  targetId: string;
  title: string;
  desc: string;
  icon: string;
  position: 'top' | 'bottom';
}

const TOUR_STEPS: TourStep[] = [
  {
    targetId: 'onboarding-kirim-btn',
    title: 'Kirim Jastip ✈️',
    desc: 'Titipkan barang dari Indonesia ke luar negeri. Admin kami yang urus semuanya sampai ke pintu Anda.',
    icon: 'fa-paper-plane',
    position: 'bottom',
  },
  {
    targetId: 'onboarding-beli-btn',
    title: 'Beli Titipan 🛒',
    desc: 'Minta admin belikan produk dari marketplace Indonesia, lalu dikirimkan langsung ke alamat Anda.',
    icon: 'fa-cart-plus',
    position: 'bottom',
  },
  {
    targetId: 'onboarding-riwayat-btn',
    title: 'Riwayat Pesanan 📦',
    desc: 'Pantau semua pesanan Anda di sini — dari status pengiriman sampai konfirmasi penerimaan.',
    icon: 'fa-receipt',
    position: 'top',
  },
];

// ─── WELCOME MODAL ────────────────────────────────────────────────────────────
const WelcomeModal: React.FC<{ onStart: () => void; onSkip: () => void }> = ({ onStart, onSkip }) => (
  <div className="fixed inset-0 z-[200] flex items-center justify-center p-5">
    <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onSkip}/>
    <div className="relative bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden animate-fade-in-up z-10">
      {/* Header dekoratif */}
      <div className="bg-gradient-to-br from-blue-500 to-blue-700 pt-10 pb-6 flex flex-col items-center">
        <IllustrationWelcome />
      </div>

      <div className="p-8 text-center">
        {/* Dot indicator — step 1 dari 4 */}
        <div className="flex justify-center gap-2 mb-6">
          {[0,1,2,3].map(i => (
            <div key={i} className={`rounded-full transition-all ${i===0?'w-5 h-2 bg-blue-600':'w-2 h-2 bg-slate-200 dark:bg-slate-700'}`}/>
          ))}
        </div>

        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
          Selamat Datang di JastipTKI! 👋
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-8">
          Kiriman dari Indonesia ke luar negeri jadi mudah. Ikuti tur singkat untuk mulai!
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={onStart}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-blue-100 dark:shadow-none active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <i className="fas fa-play text-xs"/> Mulai Tur
          </button>
          <button
            onClick={onSkip}
            className="w-full py-3 text-slate-400 font-bold text-sm hover:text-slate-600 transition-colors"
          >
            Lewati
          </button>
        </div>
      </div>
    </div>
  </div>
);

// ─── TOOLTIP TOUR ─────────────────────────────────────────────────────────────
const TooltipTour: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);

  const measureTarget = useCallback(() => {
    const el = document.getElementById(TOUR_STEPS[step].targetId);
    if (el) {
      setRect(el.getBoundingClientRect());
      setMounted(true);
    } else {
      // Elemen belum render — coba ulang setelah scroll/delay
      setRect(null);
    }
  }, [step]);

  useEffect(() => {
    setMounted(false);
    const timer = setTimeout(measureTarget, 120);
    window.addEventListener('resize', measureTarget);
    return () => { clearTimeout(timer); window.removeEventListener('resize', measureTarget); };
  }, [step, measureTarget]);

  const current = TOUR_STEPS[step];
  const totalSteps = TOUR_STEPS.length;

  const goNext = () => {
    if (step < totalSteps - 1) setStep(s => s + 1);
    else onDone();
  };
  const goPrev = () => { if (step > 0) setStep(s => s - 1); };

  const PAD = 10; // padding spotlight
  const spotX = rect ? rect.left - PAD : 0;
  const spotY = rect ? rect.top - PAD : 0;
  const spotW = rect ? rect.width + PAD*2 : 0;
  const spotH = rect ? rect.height + PAD*2 : 0;

  // Posisi tooltip
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const tooltipW = Math.min(300, vw - 32);
  let tooltipLeft = rect ? Math.max(16, Math.min(rect.left + rect.width/2 - tooltipW/2, vw - tooltipW - 16)) : 16;
  let tooltipTop: number;
  if (current.position === 'bottom') {
    tooltipTop = rect ? spotY + spotH + 16 : vh/2;
  } else {
    tooltipTop = rect ? spotY - 200 : vh/2;
  }
  tooltipTop = Math.max(80, Math.min(tooltipTop, vh - 260));

  return (
    <div className="fixed inset-0 z-[200]" style={{ pointerEvents: 'all' }}>
      {/* Overlay SVG dengan cutout spotlight */}
      {mounted && rect && (
        <svg
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: 'none' }}
        >
          <defs>
            <mask id="spotlight-mask">
              <rect width="100%" height="100%" fill="white"/>
              <rect x={spotX} y={spotY} width={spotW} height={spotH} rx="16" fill="black"/>
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(15,23,42,0.80)" mask="url(#spotlight-mask)"/>
          {/* Border spotlight */}
          <rect x={spotX} y={spotY} width={spotW} height={spotH} rx="16" fill="none" stroke="#3b82f6" strokeWidth="2.5" opacity="0.9"/>
        </svg>
      )}

      {/* Fallback overlay jika elemen belum ditemukan */}
      {!mounted && (
        <div className="absolute inset-0 bg-slate-900/80"/>
      )}

      {/* Tooltip Card */}
      <div
        className="absolute bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-6 animate-fade-in-up"
        style={{ width: tooltipW, left: tooltipLeft, top: tooltipTop, pointerEvents: 'all' }}
      >
        {/* Dot pagination */}
        <div className="flex justify-center gap-2 mb-4">
          {[0,1,2,3].map(i => (
            <div key={i} className={`rounded-full transition-all ${i===step+1?'w-5 h-2 bg-blue-600':i<step+1?'w-2 h-2 bg-blue-300':'w-2 h-2 bg-slate-200 dark:bg-slate-700'}`}/>
          ))}
        </div>

        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
            <i className={`fas ${current.icon} text-sm`}/>
          </div>
          <div>
            <h3 className="font-black text-slate-900 dark:text-white text-base leading-tight">{current.title}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed mt-1">{current.desc}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {step > 0 && (
            <button onClick={goPrev} className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl font-black text-xs uppercase tracking-widest">
              ← Kembali
            </button>
          )}
          <button onClick={onDone} className="py-2.5 px-4 text-slate-400 font-bold text-xs">
            Lewati
          </button>
          <button
            onClick={goNext}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-100 dark:shadow-none active:scale-95 transition-all"
          >
            {step < totalSteps - 1 ? 'Selanjutnya →' : '🎉 Selesai!'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── CHECKLIST CARD ───────────────────────────────────────────────────────────
export const GettingStartedCard: React.FC<{
  checklist: OnboardingChecklist;
  checklistStartedAt?: number;
  onNavigate: (tab: string) => void;
}> = ({ checklist, checklistStartedAt, onNavigate }) => {
  const [dismissed, setDismissed] = useState(false);

  const daysPassed = checklistStartedAt
    ? (Date.now() - checklistStartedAt) / (1000 * 60 * 60 * 24)
    : 0;
  const allDone = checklist.profileDone && checklist.addressDone && checklist.orderDone;

  if (dismissed || daysPassed > CHECKLIST_DAYS || allDone) return null;

  const items = [
    { key: 'profileDone', done: checklist.profileDone, label: 'Lengkapi profil (nama + nomor WA)', tab: 'profile' },
    { key: 'addressDone', done: checklist.addressDone, label: 'Tambahkan alamat pengirim', tab: 'profile' },
    { key: 'orderDone', done: checklist.orderDone, label: 'Buat pesanan pertama', tab: null },
  ] as const;

  const doneCount = items.filter(i => i.done).length;
  const progress = Math.round((doneCount / items.length) * 100);

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-100 dark:border-blue-900/50 rounded-[2rem] p-6 mb-6 relative">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-full hover:bg-white/50 transition-all"
      >
        <i className="fas fa-times text-xs"/>
      </button>

      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-base">
          <i className="fas fa-rocket"/>
        </div>
        <div>
          <h3 className="font-black text-slate-900 dark:text-white text-sm">Mulai dari Sini 🚀</h3>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{doneCount}/{items.length} selesai</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-white/60 dark:bg-slate-800/60 rounded-full mb-5 overflow-hidden">
        <div
          className="h-full bg-blue-600 rounded-full transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Checklist items */}
      <div className="space-y-3">
        {items.map(item => (
          <button
            key={item.key}
            onClick={() => item.tab && onNavigate(item.tab)}
            disabled={item.done}
            className={`w-full flex items-center gap-3 text-left transition-all ${item.done ? 'opacity-60 cursor-default' : 'hover:bg-white/40 dark:hover:bg-white/5 rounded-xl px-2 -mx-2 py-1'}`}
          >
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${item.done ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'}`}>
              {item.done && <i className="fas fa-check text-white text-[8px]"/>}
            </div>
            <span className={`text-xs font-bold ${item.done ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>
              {item.label}
            </span>
            {!item.done && item.tab && <i className="fas fa-chevron-right text-slate-300 text-[9px] ml-auto"/>}
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── TOOLTIP KALKULATOR ───────────────────────────────────────────────────────
export const CalcTooltip: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(LS_CALC_TIP)) {
      setVisible(true);
      localStorage.setItem(LS_CALC_TIP, 'true');
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="bg-blue-600 text-white rounded-2xl px-4 py-3 mb-4 flex items-center gap-3 animate-fade-in-up">
      <i className="fas fa-lightbulb text-yellow-300 text-sm shrink-0"/>
      <p className="text-xs font-bold flex-1">Hitung estimasi ongkir sebelum pesan agar tidak ada kejutan biaya!</p>
      <button onClick={() => setVisible(false)} className="text-blue-200 hover:text-white shrink-0">
        <i className="fas fa-times text-xs"/>
      </button>
    </div>
  );
};

// ─── EMPTY STATE RIWAYAT ──────────────────────────────────────────────────────
export const HistoryEmptyState: React.FC<{ onCreateOrder: () => void }> = ({ onCreateOrder }) => {
  useEffect(() => {
    localStorage.setItem(LS_HISTORY_TIP, 'true');
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center animate-fade-in-up">
      <svg viewBox="0 0 160 140" className="w-40 h-32 mb-6" fill="none">
        {/* Kotak paket kosong */}
        <rect x="40" y="55" width="80" height="65" rx="8" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="2"/>
        <path d="M40 75 L80 85 L120 75" stroke="#cbd5e1" strokeWidth="2"/>
        <line x1="80" y1="55" x2="80" y2="85" stroke="#cbd5e1" strokeWidth="2"/>
        {/* Tanda tanya di dalam kotak */}
        <text x="80" y="108" textAnchor="middle" fontSize="22" fill="#94a3b8" fontWeight="bold">?</text>
        {/* Bintang/sparkle */}
        <circle cx="30" cy="40" r="4" fill="#dbeafe"/>
        <circle cx="135" cy="50" r="3" fill="#dbeafe"/>
        <circle cx="25" cy="100" r="2.5" fill="#e0e7ff"/>
        {/* Panah ke atas */}
        <path d="M80 45 L80 20 M72 28 L80 20 L88 28" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" opacity="0.5"/>
      </svg>

      <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">Belum Ada Pesanan</h3>
      <p className="text-sm text-slate-400 font-medium mb-8 leading-relaxed max-w-xs">
        Mulai perjalanan pertama Anda — kirim barang atau titip beli produk Indonesia ke mana saja di dunia.
      </p>
      <button
        onClick={onCreateOrder}
        className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-blue-100 dark:shadow-none active:scale-95 transition-all flex items-center gap-2"
      >
        <i className="fas fa-plus text-xs"/> Buat Pesanan Pertama
      </button>
    </div>
  );
};

// ─── MAIN ONBOARDING ORCHESTRATOR ─────────────────────────────────────────────
type OnboardingPhase = 'welcome' | 'tour' | 'done';

const OnboardingSystem: React.FC<{ uid: string; onComplete: () => void }> = ({ uid, onComplete }) => {
  const [phase, setPhase] = useState<OnboardingPhase>('welcome');

  const handleSkip = async () => {
    await completeOnboardingFirestore(uid);
    onComplete();
  };

  const handleStartTour = () => setPhase('tour');

  const handleTourDone = async () => {
    await completeOnboardingFirestore(uid);
    setPhase('done');
    onComplete();
  };

  if (phase === 'done') return null;
  if (phase === 'welcome') return <WelcomeModal onStart={handleStartTour} onSkip={handleSkip}/>;
  if (phase === 'tour') return <TooltipTour onDone={handleTourDone}/>;
  return null;
};

export default OnboardingSystem;
