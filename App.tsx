
import React, { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import AuthForm from './components/AuthForm';
import Dashboard from './components/Dashboard';
import MaintenancePage from './components/MaintenancePage';
import { AppState } from './types';
import { auth } from './firebase';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import { AppConfigProvider } from './context/AppConfigProvider';
import { PaymentConfigProvider } from './context/PaymentConfigProvider';
import { FeatureFlagProvider } from './context/FeatureFlagProvider';
import { TransactionConfigProvider } from './context/TransactionConfigProvider';
import { useAppConfig } from './hooks/useAppConfig';
import { getReferralCodeFromURL, saveReferralCodeToSession, getReferralCodeFromSession } from './services/referralService';
import { APP_VERSION, MIN_SUPPORTED_VERSION_DEFAULT } from './constants';
import { checkAndInvalidateCache } from './services/cacheManifestService';
import { CacheInvalidationContext } from './context/CacheInvalidationContext';

const AppContent: React.FC = () => {
  const [view, setView] = useState<AppState>('LANDING');
  const [user, setUser] = useState<any>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [initializing, setInitializing] = useState(true);
  const { config, loading: configLoading } = useAppConfig();

  // ─── Theme init — hanya sekali saat mount ────────────────────────────────
  useEffect(() => {
    const savedTheme = localStorage.getItem('jastip_theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
    setIsDarkMode(shouldDark);
    if (shouldDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []); // ← [] penting — tidak ikut re-run saat view/tab berubah

  // ─── Cache invalidation saat versi baru terdeteksi ───────────────────────
  // App user tidak punya izin write ke Firestore, jadi tidak bisa auto-sync.
  // Yang bisa dilakukan: invalidate cache localStorage agar versi terbaru
  // dibaca dari Firestore di session berikutnya.
  useEffect(() => {
    if (configLoading) return;
    const cachedVersion = config.appVersion;
    // Jika versi di cache berbeda dengan APP_VERSION di kode,
    // hapus cache agar Firestore dibaca ulang fresh
    if (cachedVersion && cachedVersion !== APP_VERSION) {
      try {
        localStorage.removeItem('jastip_cache_app_config');
      } catch {}
    }
  }, [configLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Referral URL + Firebase Auth Listener ───────────────────────────────
  useEffect(() => {
    // Deteksi kode referral dari URL (?ref=KODE) saat pertama load
    const refCode = getReferralCodeFromURL();
    if (refCode) {
      saveReferralCodeToSession(refCode);
      // Bersihkan URL tanpa reload
      const url = new URL(window.location.href);
      url.searchParams.delete('ref');
      window.history.replaceState({}, '', url.toString());
    }

    // Firebase Auth Listener
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || 'Pahlawan Devisa',
        });
        setView('DASHBOARD');
      } else {
        setUser(null);
        setView('LANDING');
      }
      setInitializing(false);
    });

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode(prev => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('jastip_theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('jastip_theme', 'light');
      }
      return next;
    });
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setView('LANDING');
    } catch (error) {
      console.error("Logout error", error);
    }
  };

  if (initializing || configLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle Maintenance Mode
  if (config.maintenanceMode) {
    return <MaintenancePage message={config.maintenanceMessage} />;
  }

  // Handle Minimum Version Check
  // APP_VERSION = versi kode yang sedang berjalan di browser user
  // config.minSupportedVersion = batas minimum yang diset admin
  const MIN_VERSION = config.minSupportedVersion || MIN_SUPPORTED_VERSION_DEFAULT;
  const parseVer = (v: string) => v.split('.').map(Number);
  const isOutdated = (() => {
    const cur = parseVer(APP_VERSION);
    const min = parseVer(MIN_VERSION);
    for (let i = 0; i < 3; i++) {
      if ((cur[i] || 0) < (min[i] || 0)) return true;
      if ((cur[i] || 0) > (min[i] || 0)) return false;
    }
    return false;
  })();

  const handleForceRefresh = () => {
    // Hapus semua cache service worker + localStorage lalu reload
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(reg => reg.unregister());
      });
    }
    // Hapus cache localStorage (kecuali theme)
    const theme = localStorage.getItem('jastip_theme');
    localStorage.clear();
    if (theme) localStorage.setItem('jastip_theme', theme);
    // Hard reload — bypass cache browser
    window.location.href = window.location.origin + '?nocache=' + Date.now();
  };

  if (isOutdated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-sm w-full">
          {/* Icon */}
          <div className="w-20 h-20 bg-amber-500/10 text-amber-400 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-6">
            <i className="fas fa-arrow-up-from-bracket"></i>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-black text-white mb-2 text-center">Update Diperlukan</h2>
          <p className="text-slate-400 text-sm text-center mb-6 leading-relaxed">
            Versi aplikasi Anda (<span className="text-amber-400 font-bold">{APP_VERSION}</span>) sudah tidak didukung.
            Versi minimum yang diperlukan adalah <span className="text-white font-bold">{MIN_VERSION}</span>.
          </p>

          {/* Tombol utama */}
          <button
            onClick={handleForceRefresh}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 mb-6"
          >
            <i className="fas fa-rotate-right" />
            Perbarui Sekarang
          </button>

          {/* Instruksi manual jika tombol tidak cukup */}
          <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800">
            <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-3 flex items-center gap-2">
              <i className="fas fa-circle-info text-blue-400" />
              Jika tombol di atas tidak berhasil:
            </p>
            <ol className="space-y-3">
              {[
                { icon: 'fa-mobile-screen', text: 'Di HP: Buka Pengaturan Browser → Privasi → Hapus Data Situs → cari "jstapp" → Hapus' },
                { icon: 'fa-laptop', text: 'Di PC/Laptop: Tekan Ctrl+Shift+R (Windows) atau Cmd+Shift+R (Mac) untuk hard refresh' },
                { icon: 'fa-wifi', text: 'Jika masih gagal: coba matikan WiFi sebentar, nyalakan lagi, lalu buka ulang aplikasi' },
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-5 h-5 bg-blue-600/20 text-blue-400 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">{i + 1}</span>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    <i className={`fas ${step.icon} text-slate-500 mr-1.5`} />
                    {step.text}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          <p className="text-slate-600 text-[10px] text-center mt-4 font-bold">
            v{APP_VERSION} → min {MIN_VERSION}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen theme-transition ${isDarkMode ? 'dark' : ''}`}>
      {view === 'LANDING' && (
        <LandingPage 
          onStart={() => setView('AUTH')} 
          isDarkMode={isDarkMode} 
          toggleDarkMode={toggleDarkMode} 
        />
      )}
      
      {view === 'AUTH' && (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 transition-colors duration-300">
          <AuthForm 
            onSuccess={() => setView('DASHBOARD')} 
            onBack={() => setView('LANDING')}
            pendingReferralCode={getReferralCodeFromSession()}
          />
        </div>
      )}

      {view === 'DASHBOARD' && user && (
        <Dashboard 
          user={user} 
          onLogout={handleLogout} 
          isDarkMode={isDarkMode}
          toggleDarkMode={toggleDarkMode}
        />
      )}
    </div>
  );
};

const App: React.FC = () => {
  // ─── Tunggu cache manifest selesai dicek sebelum render provider ──────────
  // ─── Tunggu cache manifest selesai, lalu pass "invalidation key" ke provider ──
  // Masalah sebelumnya: cache dihapus dari localStorage, tapi provider sudah
  // mount duluan dan tidak tahu harus fetch ulang.
  //
  // Solusi: setiap provider diberi prop `key` yang berisi timestamp invalidasi.
  // Kalau key berubah → React otomatis unmount + remount provider itu →
  // provider fetch ulang dari Firestore (karena cache sudah dihapus).
  const [cacheReady, setCacheReady] = useState(false);
  const [invalidatedKeys, setInvalidatedKeys] = useState<string[]>([]);

  useEffect(() => {
    // Timeout safety: jika checkAndInvalidateCache gagal/lambat > 5 detik,
    // lanjutkan saja dengan cache yang ada daripada blank selamanya
    const timeout = setTimeout(() => {
      setCacheReady(true);
    }, 5000);

    checkAndInvalidateCache()
      .then((invalidated) => setInvalidatedKeys(invalidated))
      .finally(() => {
        clearTimeout(timeout);
        setCacheReady(true);
      });

    return () => clearTimeout(timeout);
  }, []);

  // Loading spinner — bukan blank — saat cek manifest berlangsung
  if (!cacheReady) return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0f172a'
    }}>
      <div style={{
        width: 40, height: 40,
        border: '4px solid #1e3a5f',
        borderTop: '4px solid #10b981',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  // Key untuk setiap provider: kalau kategorinya masuk daftar invalidated,
  // provider di-remount → otomatis fetch ulang dari Firestore.
  const ts = Date.now().toString();
  const appConfigKey     = invalidatedKeys.includes('app_config')     ? ts : 'stable';
  const featureFlagKey   = invalidatedKeys.includes('feature_flags')  ? ts : 'stable';
  const paymentKey       = invalidatedKeys.includes('payment_config') ? ts : 'stable';
  const transactionKey   = invalidatedKeys.includes('transaction_config') ? ts : 'stable';

  return (
    <CacheInvalidationContext.Provider value={{ invalidatedKeys }}>
      <AppConfigProvider key={appConfigKey}>
        <FeatureFlagProvider key={featureFlagKey}>
          <TransactionConfigProvider key={transactionKey}>
            <PaymentConfigProvider key={paymentKey}>
              <AppContent />
            </PaymentConfigProvider>
          </TransactionConfigProvider>
        </FeatureFlagProvider>
      </AppConfigProvider>
    </CacheInvalidationContext.Provider>
  );
};

export default App;
