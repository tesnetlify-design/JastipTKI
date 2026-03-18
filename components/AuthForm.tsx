import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  doc, 
  setDoc, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  getOrCreateReferral,
  processReferralReward,
  getReferralCodeFromSession,
  clearReferralSession,
  getReferralConfig,
  DEFAULT_REFERRAL_CONFIG,
} from '../services/referralService';
import { clearCache } from '../services/cacheService';

interface AuthFormProps {
  onSuccess: () => void;
  onBack: () => void;
  pendingReferralCode?: string | null;
}

const AuthForm: React.FC<AuthFormProps> = ({ onSuccess, onBack, pendingReferralCode }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [referralReward, setReferralReward] = useState(DEFAULT_REFERRAL_CONFIG.rewardAmount);
  const [showReferralInput, setShowReferralInput] = useState(false);

  // Auto-isi kode dari URL/localStorage dan load reward amount dari config
  useEffect(() => {
    const code = pendingReferralCode || getReferralCodeFromSession();
    if (code) {
      setReferralCode(code.toUpperCase());
      setIsLogin(false); // langsung ke tab daftar kalau ada kode referral
    }
    // Load reward amount dari Firestore config
    getReferralConfig().then(cfg => setReferralReward(cfg.rewardAmount));
  }, [pendingReferralCode]);

  // ─── Helper: proses referral setelah register ────────────────────────────
  const handlePostRegister = async (uid: string, displayName: string) => {
    const codeToUse = referralCode.trim().toUpperCase() || getReferralCodeFromSession();

    // Buat doc referral user baru dulu
    await getOrCreateReferral(uid, displayName);

    if (!codeToUse) return;

    // Fetch config terbaru dari Firestore
    const config = await getReferralConfig();

    // Proses reward — User B dapat voucher langsung, User A dapat pendingReward
    const rewarded = await processReferralReward(uid, codeToUse, config);
    if (rewarded) clearCache('vouchers');
    clearReferralSession();
  };

  const handleGoogleLogin = async () => {
    setError('');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      setLoading(true);
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const isNewUser = (result as any)?._tokenResponse?.isNewUser === true;

      if (isNewUser) {
        // User baru via Google — buat doc user dulu, lalu proses referral
        await setDoc(doc(db, 'users', user.uid), {
          displayName: user.displayName || 'Pahlawan Devisa',
          email: user.email,
          createdAt: serverTimestamp(),
          addresses: [],
          claimedVouchers: [],
          activeClaimedVoucher: null,
          claimStatus: 'expired',
          voucherCollection: [],
          usedVouchers: [],
        }, { merge: true });
        try {
          await handlePostRegister(user.uid, user.displayName || 'User');
        } catch { /* non-critical */ }
      }
      onSuccess();
    } catch (err: any) {
      if (err.code === 'auth/popup-blocked') {
        setError('Jendela login diblokir oleh browser. Silakan izinkan Pop-up di pengaturan browser Anda.');
      } else if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        setError('Gagal masuk dengan Google. Pastikan koneksi internet Anda stabil.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        await updateProfile(user, { displayName: name });
        await setDoc(doc(db, 'users', user.uid), {
          displayName: name,
          email,
          createdAt: serverTimestamp(),
          addresses: [],
          claimedVouchers: [],
          activeClaimedVoucher: null,
          claimStatus: 'expired',
          voucherCollection: [],
          usedVouchers: [],
        });
        // Proses referral — non-critical, tidak boleh block login user
        try {
          await handlePostRegister(user.uid, name);
        } catch (refErr) {
          console.error('[Referral] Gagal proses referral:', refErr);
        }
      }
      onSuccess();
    } catch (err: any) {
      switch (err.code) {
        case 'auth/invalid-credential':
          setError('Email atau password salah.'); break;
        case 'auth/email-already-in-use':
          setError('Email sudah terdaftar. Silakan masuk.'); break;
        case 'auth/weak-password':
          setError('Password terlalu lemah (minimal 6 karakter).'); break;
        default:
          setError('Terjadi kesalahan: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatRp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

  return (
    <div className="w-full max-w-md animate-fade-in-up">
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors font-medium"
      >
        <i className="fas fa-arrow-left" /> Kembali ke Beranda
      </button>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl shadow-slate-200 dark:shadow-none border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors">

        {/* ─── Banner Referral — tampil kalau ada kode pending ─── */}
        {!isLogin && referralCode && (
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-5 flex items-center gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center text-white text-xl shrink-0">
              <i className="fas fa-gift" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-black text-sm leading-tight">
                Kamu diundang oleh teman! 🎉
              </p>
              <p className="text-white/80 text-[10px] font-bold mt-0.5 leading-relaxed">
                Daftar sekarang, keduanya dapat voucher <span className="font-black text-white">{formatRp(referralReward)}</span> otomatis
              </p>
            </div>
            <span className="shrink-0 bg-white/20 text-white font-black text-[10px] px-3 py-1.5 rounded-xl tracking-widest font-mono">
              {referralCode}
            </span>
          </div>
        )}

        <div className="p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
              {isLogin ? 'Selamat Datang!' : 'Gabung JastipTKI'}
            </h2>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">
              {isLogin ? 'Masuk ke dashboard Anda' : 'Layanan khusus pahlawan devisa'}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl text-xs font-bold border border-red-100 dark:border-red-900/30 flex items-start gap-3">
              <i className="fas fa-circle-exclamation mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Nama Lengkap</label>
                <input
                  type="text" required
                  className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold dark:text-white"
                  placeholder="Contoh: Budi Santoso"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Email</label>
              <input
                type="email" required
                className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold dark:text-white"
                placeholder="email@anda.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Password</label>
              <input
                type="password" required
                className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold dark:text-white"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            {/* ─── Kode Referral — tampil saat tab Daftar ─── */}
            {!isLogin && (
              <div className="space-y-1.5">
                {referralCode ? (
                  // Sudah terisi dari URL — tampil sebagai read-only dengan tombol hapus
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1.5">
                      Kode Referral
                    </label>
                    <div className="flex items-center gap-3 px-5 py-3.5 bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-300 dark:border-emerald-700 rounded-2xl">
                      <i className="fas fa-ticket-alt text-emerald-600 text-sm shrink-0" />
                      <span className="flex-1 font-black text-emerald-700 dark:text-emerald-400 tracking-widest font-mono text-sm">
                        {referralCode}
                      </span>
                      <button
                        type="button"
                        onClick={() => { setReferralCode(''); clearReferralSession(); }}
                        className="text-slate-400 hover:text-red-500 transition-colors text-xs"
                        title="Hapus kode referral"
                      >
                        <i className="fas fa-times" />
                      </button>
                    </div>
                    <p className="text-[9px] text-emerald-600 font-bold ml-2 mt-1">
                      ✓ Voucher {formatRp(referralReward)} akan otomatis diterima setelah daftar
                    </p>
                  </div>
                ) : (
                  // Tidak ada kode — tampil toggle input manual
                  <div>
                    {!showReferralInput ? (
                      <button
                        type="button"
                        onClick={() => setShowReferralInput(true)}
                        className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:border-emerald-400 hover:text-emerald-600 transition-all flex items-center justify-center gap-2"
                      >
                        <i className="fas fa-plus-circle" />
                        Punya kode referral?
                      </button>
                    ) : (
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                          Kode Referral <span className="text-slate-300">(Opsional)</span>
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            className="flex-1 px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-black text-slate-900 dark:text-white uppercase tracking-widest font-mono text-sm"
                            placeholder="NAMA-XXXX"
                            value={referralCode}
                            onChange={e => setReferralCode(e.target.value.toUpperCase())}
                            maxLength={12}
                          />
                          <button
                            type="button"
                            onClick={() => { setShowReferralInput(false); setReferralCode(''); }}
                            className="w-12 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all"
                          >
                            <i className="fas fa-times" />
                          </button>
                        </div>
                        {referralCode.length >= 6 && (
                          <p className="text-[9px] text-emerald-600 font-bold ml-2">
                            ✓ Keduanya dapat voucher {formatRp(referralReward)} jika kode valid
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-100 dark:shadow-none mt-4 disabled:opacity-50 transition-all active:scale-95"
            >
              {loading
                ? <i className="fas fa-circle-notch animate-spin" />
                : (isLogin ? 'Masuk Sekarang' : 'Daftar Sekarang')}
            </button>
          </form>

          <div className="my-8 flex items-center gap-4">
            <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Atau</span>
            <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[2rem] font-black text-sm text-slate-700 dark:text-slate-200 flex items-center justify-center gap-3 transition-all hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 shadow-sm disabled:opacity-50"
          >
            {loading ? (
              <i className="fas fa-circle-notch animate-spin" />
            ) : (
              <>
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                Lanjutkan dengan Google
              </>
            )}
          </button>

          <div className="mt-8 text-center text-[10px] font-bold uppercase tracking-widest">
            <p className="text-slate-400">
              {isLogin ? 'Belum punya akun?' : 'Sudah punya akun?'}
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="ml-2 text-blue-600 hover:underline"
              >
                {isLogin ? 'Daftar di sini' : 'Masuk di sini'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthForm;
