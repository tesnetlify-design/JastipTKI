
import React, { useState, useEffect, useRef, useMemo, Component, type ReactNode, type ErrorInfo } from 'react';
import { Transaction, Testimonial, Voucher, UserProfile } from '../types';
import Calculator from './Calculator';
import TransactionList from './TransactionList';

// ─── Error Boundary untuk mencegah blank hitam saat crash ─────────────────────
class HistoryErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[HistoryTab] Render error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
          <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 text-red-400 rounded-full flex items-center justify-center text-3xl mx-auto mb-6">
            <i className="fas fa-triangle-exclamation"></i>
          </div>
          <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">Terjadi Kesalahan</h3>
          <p className="text-sm text-slate-400 font-medium mb-8 max-w-xs leading-relaxed">
            Riwayat tidak dapat ditampilkan. Silakan refresh halaman atau coba lagi.
          </p>
          <button
            onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
            className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center gap-2"
          >
            <i className="fas fa-rotate-right text-xs"/> Refresh Halaman
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
import TransactionDetailModal from './TransactionDetailModal';
import KirimJastipFlow from './KirimJastipFlow';
import BeliTitipanFlow from './BeliTitipanFlow';
import ReferralModal from './ReferralModal';
import OnboardingSystem, {
  GettingStartedCard,
  CalcTooltip,
  HistoryEmptyState,
  getChecklist,
  setChecklistItem,
  isOnboardingCompleted,
  resetOnboarding,
  fetchOnboardingData,
  autoCompleteForOldUser,
  type OnboardingChecklist,
} from './OnboardingSystem';
import { TESTIMONIALS } from '../constants';
import { db } from '../firebase';
import * as VoucherEngine from '../voucherEngine';
import { getTestimonialsCached, TESTIMONIAL_DISPLAY_LIMIT } from '../services/testimonialService';
import { clearCache } from '../services/cacheService';
import { getVouchersCached } from '../services/voucherService';
import { getReferralConfig, DEFAULT_REFERRAL_CONFIG, ReferralConfig } from '../services/referralService';

/** Batas tampil riwayat transaksi */
const TRANSACTION_DISPLAY_LIMIT = 10;
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  addDoc, 
  updateDoc,
  getDoc,
  runTransaction,
  serverTimestamp,
  arrayUnion,
  increment
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { useAppConfig } from '../hooks/useAppConfig';
import { generateOrderNumber } from '../services/orderNumberService';
import { useShippingRates } from '../hooks/useShippingRates';
import { useFeatureFlags } from '../hooks/useFeatureFlags';

interface DashboardProps {
  user: any;
  onLogout: () => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user: firebaseUser, onLogout, isDarkMode, toggleDarkMode }) => {
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'calc' | 'reviews' | 'profile'>('home');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checklist, setChecklist] = useState<OnboardingChecklist>(getChecklist(firebaseUser.uid));
  const [checklistStartedAt, setChecklistStartedAt] = useState<number | undefined>(undefined);
  const [user, setUser] = useState<UserProfile>({
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(true);
  const [reviews, setReviews] = useState<Testimonial[]>([]);
  const [isKirimJastipOpen, setIsKirimJastipOpen] = useState(false);
  const [isBeliTitipanOpen, setIsBeliTitipanOpen] = useState(false);
  const [isServicePickerOpen, setIsServicePickerOpen] = useState(false);
  const [isVoucherPromoOpen, setIsVoucherPromoOpen] = useState(false);
  const [isVoucherClaimed, setIsVoucherClaimed] = useState(false);
  const [lastClaimedCode, setLastClaimedCode] = useState<string>('');
  const [isMyVouchersOpen, setIsMyVouchersOpen] = useState(false);
  const [isReferralOpen, setIsReferralOpen] = useState(false);
  const [showReferralWelcome, setShowReferralWelcome] = useState(false);
  const [referralConfig, setReferralConfig] = useState<ReferralConfig>(DEFAULT_REFERRAL_CONFIG);
  
  const [allVouchers, setAllVouchers] = useState<Voucher[]>([]);
  
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [permissionError, setPermissionError] = useState(false);
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const { config: appConfig } = useAppConfig();
  const { rates: shippingRates } = useShippingRates();
  const { flags } = useFeatureFlags();

  const [isCountryPickerOpen, setIsCountryPickerOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const countryPickerRef = useRef<HTMLDivElement>(null);

  // Refs for stable state in intervals
  const userRef = useRef<UserProfile>(user);
  const vouchersRef = useRef<Voucher[]>(allVouchers);

  useEffect(() => {
    userRef.current = user;
    vouchersRef.current = allVouchers;
  }, [user, allVouchers]);

  // ─── Deteksi user baru → cek Firestore, auto-complete user lama ──────────
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const checkOnboarding = async () => {
      const uid = firebaseUser.uid;
      // Cek cache dulu (sync) — kalau sudah completed, skip semua
      if (isOnboardingCompleted(uid)) return;
      // Fetch dari Firestore
      const data = await fetchOnboardingData(uid);
      setChecklist(data.checklist || { profileDone: false, addressDone: false, orderDone: false });
      if (data.checklistStartedAt?.toMillis) {
        setChecklistStartedAt(data.checklistStartedAt.toMillis());
      }
      if (!data.completed) {
        timer = setTimeout(() => setShowOnboarding(true), 800);
      }
    };
    checkOnboarding();
    return () => clearTimeout(timer);
  }, []); // hanya sekali saat mount

  // ─── Refresh checklist dari cache setiap tab berubah ─────────────────────
  useEffect(() => {
    setChecklist(getChecklist(firebaseUser.uid));
  }, [activeTab]);

  const LOGO_URL = "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjmCTzDlM1UQDugbZX9g67GUOQk0OHE2_ZbdK_QPzUEzpd1rZ69mbau1aiMoymI41D5nm-OtRspMQlNRd4oBCIkq0GDxa2T8V8-s8B0H9ZGkKRFejZLSBSlRIklYOSxtZZYtKJ9xJd-VxJeqXfPTJjVbwGKFKeKXT2PLE4qUF6apRWV0Ijhu9FxGdaT2AXv/s1600/IMG_0119.jpeg";

  const [profileView, setProfileView] = useState<'MAIN' | 'EDIT' | 'ADDRESS' | 'ADDRESS_FORM' | 'HELP'>('MAIN');
  const [tempProfile, setTempProfile] = useState({ 
    name: firebaseUser.displayName, 
    phone: '',
    email: firebaseUser.email 
  });
  
  const [addresses, setAddresses] = useState<any[]>([]);
  const [editingAddress, setEditingAddress] = useState<any | null>(null);
  const [addressFormData, setAddressFormData] = useState({
    label: '',
    type: 'SENDER',
    city: '',
    province: '', 
    detail: '',
    zip: ''
  });

  // Available vouchers calculated via the separate Engine
  const availableVouchers = useMemo(() => {
    return VoucherEngine.getAvailableVouchers(user, allVouchers, transactions);
  }, [user, allVouchers, transactions]);

  // The single best voucher to show in the promo section
  const promoVoucher = useMemo(() => {
    return VoucherEngine.getBestVoucher(user, allVouchers, transactions);
  }, [user, allVouchers, transactions]);

  useEffect(() => {
    if (!firebaseUser?.uid) return;

    // 1. Listen to Transactions
    const qTrans = query(
      collection(db, "transactions"), 
      where("userId", "==", firebaseUser.uid)
    );
    
    const unsubTrans = onSnapshot(qTrans, 
      (snapshot) => {
        const transData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Transaction[];
        
        transData.sort((a: any, b: any) => {
          const dateA = a.createdAt?.seconds || 0;
          const dateB = b.createdAt?.seconds || 0;
          return dateB - dateA;
        });

        setTransactions(transData);
        setIsTransactionsLoading(false);
        setPermissionError(false);
        // Auto-complete onboarding untuk user lama (sudah punya transaksi tapi belum ada doc onboarding)
        if (transData.length > 0 && !isOnboardingCompleted(firebaseUser.uid)) {
          autoCompleteForOldUser(firebaseUser.uid, true);
        }
      },
      (error) => {
        if (error.code === 'permission-denied') setPermissionError(true);
        setIsTransactionsLoading(false);
      }
    );

    // 2. Load Vouchers (Cached 24 jam)
    getVouchersCached((v) => {
      setAllVouchers(v);
    });

    // 2b. Load Referral Config (untuk tampilan kartu referral yang dinamis)
    if (flags.enableReferral) {
      getReferralConfig().then(cfg => setReferralConfig(cfg)).catch(() => {});
    }

    // 3. Listen to User Profile & Vouchers
    const userDocRef = doc(db, "users", firebaseUser.uid);
    const unsubProfile = onSnapshot(userDocRef, 
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const newUser = { 
            uid: firebaseUser.uid, 
            email: firebaseUser.email, 
            displayName: data.displayName || firebaseUser.displayName,
            phone: data.phone || '',
            addresses: data.addresses || [],
            claimedVouchers: data.claimedVouchers || [],
            activeClaimedVoucher: data.activeClaimedVoucher || null,
            claimStatus: data.claimStatus || 'expired',
            voucherCollection: data.voucherCollection || [],
            usedVouchers: data.usedVouchers || [],
          };
          setUser(newUser);

          // Tampilkan welcome banner jika user punya voucher di koleksi baru (referral)
          // Flag di Firestore (referralWelcomeSeen) adalah source of truth, localStorage hanya cache
          const welcomeKey = `jastip_ref_welcome_${firebaseUser.uid}`;
          const hasNewVoucher = (data.voucherCollection || []).length > 0;
          const hasLegacyVoucher = data.activeClaimedVoucher && data.claimStatus === 'claimed';
          const seenInFirestore = data.referralWelcomeSeen === true;
          const seenInCache = !!localStorage.getItem(welcomeKey);
          if ((hasNewVoucher || hasLegacyVoucher) && !seenInFirestore && !seenInCache) {
            setShowReferralWelcome(true);
            localStorage.setItem(welcomeKey, '1');
            // Tandai di Firestore agar tidak muncul lagi walau clear browser
            updateDoc(doc(db, 'users', firebaseUser.uid), { referralWelcomeSeen: true }).catch(() => {});
          } else if (seenInFirestore && !seenInCache) {
            // Sync ke localStorage supaya tidak perlu baca Firestore terus
            localStorage.setItem(welcomeKey, '1');
          }
          setTempProfile({ 
            name: data.displayName || firebaseUser.displayName, 
            phone: data.phone || '', 
            email: firebaseUser.email 
          });
          setAddresses(data.addresses || []);
        } else {
          // Document initialization fallback (if not created by AuthForm)
          setDoc(userDocRef, {
            displayName: firebaseUser.displayName || 'Pahlawan Devisa',
            email: firebaseUser.email,
            createdAt: serverTimestamp(),
            addresses: [],
            claimedVouchers: [],
            activeClaimedVoucher: null,
            claimStatus: 'expired',
            voucherCollection: [],
            usedVouchers: [],
          }).catch(e => console.warn("Failed to init user doc", e));
        }
      },
      (err) => {
        console.warn("Profile doc access denied", err);
      }
    );

    // 4. Check for Expired Claimed Voucher
    const expiryTimer = setInterval(() => {
        const latestUser = userRef.current;
        const latestVouchers = vouchersRef.current;
        // Cek voucher lama (backward compat)
        if (latestUser.activeClaimedVoucher && latestUser.claimStatus === 'claimed') {
            if (VoucherEngine.checkVoucherExpired(latestUser, latestVouchers)) {
                updateDoc(doc(db, "users", firebaseUser.uid), {
                    activeClaimedVoucher: null,
                    claimStatus: 'expired'
                });
            }
        }
        // Cek dan hapus voucher expired dari voucherCollection
        const expiredCodes = VoucherEngine.checkExpiredVouchers(latestUser, latestVouchers);
        if (expiredCodes.length > 0) {
            const newCollection = (latestUser.voucherCollection || []).filter(c => !expiredCodes.includes(c));
            updateDoc(doc(db, "users", firebaseUser.uid), {
                voucherCollection: newCollection,
                usedVouchers: arrayUnion(...expiredCodes),
            }).catch(() => {});
        }
    }, 60000); 

    // 5. Load Testimonials (Cached 24 jam)
    getTestimonialsCached((fetched) => {
      setReviews(fetched.length > 0 ? fetched : TESTIMONIALS);
    });

    const handleClickOutside = (event: MouseEvent) => {
      if (countryPickerRef.current && !countryPickerRef.current.contains(event.target as Node)) {
        setIsCountryPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      unsubTrans();
      unsubProfile();
      clearInterval(expiryTimer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [firebaseUser.uid]);

  const handleClaimVoucher = async (code: string) => {
    if (!code) return;

    // Cegah double-claim: sudah ada di koleksi atau sudah pernah dipakai
    const alreadyOwned = (user.voucherCollection || []).includes(code);
    const alreadyUsed = (user.claimedVouchers || []).includes(code) || (user.usedVouchers || []).includes(code);
    if (alreadyOwned) {
      alert('Voucher ini sudah ada di koleksi kamu!');
      return;
    }
    if (alreadyUsed) {
      alert('Voucher ini sudah pernah kamu gunakan sebelumnya.');
      return;
    }

    try {
      const userDocRef = doc(db, "users", firebaseUser.uid);
      await updateDoc(userDocRef, {
        voucherCollection: arrayUnion(code),
        claimedVouchers: arrayUnion(code),
      });
      setIsVoucherClaimed(true);
      setLastClaimedCode(code);
    } catch (err: any) {
      console.error("Failed to claim voucher", err);
      alert("Gagal mengklaim voucher. Silakan coba lagi.");
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
      return new Date(dateStr).toLocaleDateString('id-ID', options);
    } catch {
      return dateStr;
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, "users", firebaseUser.uid), {
        displayName: tempProfile.name,
        phone: tempProfile.phone
      });
      setProfileView('MAIN');
      // ✅ Checklist: profil selesai
      setChecklistItem(firebaseUser.uid, 'profileDone');
      setChecklist(getChecklist(firebaseUser.uid));
      alert('Profil berhasil diperbarui!');
    } catch (err) {
      alert('Gagal memperbarui profil.');
    }
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let updatedAddresses = [...addresses];
      if (editingAddress) {
        updatedAddresses = addresses.map(a => a.id === editingAddress.id ? { ...addressFormData, id: a.id } : a);
      } else {
        updatedAddresses.push({ ...addressFormData, id: Date.now() });
      }
      await updateDoc(doc(db, "users", firebaseUser.uid), {
        addresses: updatedAddresses
      });
      setProfileView('ADDRESS');
      setEditingAddress(null);
      // ✅ Checklist: alamat selesai
      setChecklistItem(firebaseUser.uid, 'addressDone');
      setChecklist(getChecklist(firebaseUser.uid));
      alert('Alamat berhasil disimpan!');
    } catch (err) {
      alert('Gagal menyimpan alamat.');
    }
  };

  const handleDeleteAddress = async (id: number) => {
    if (!confirm('Hapus alamat ini secara permanen?')) return;
    try {
      const updatedAddresses = addresses.filter(a => a.id !== id);
      await updateDoc(doc(db, "users", firebaseUser.uid), {
        addresses: updatedAddresses
      });
    } catch (err) {
      alert('Gagal menghapus alamat.');
    }
  };

  const openAddressForm = (addr?: any) => {
    if (addr) {
      setEditingAddress(addr);
      setAddressFormData({ 
        label: addr.label || '',
        type: addr.type || 'SENDER',
        city: addr.city || '',
        province: addr.province || '',
        detail: addr.detail || '',
        zip: addr.zip || ''
      });
    } else {
      setEditingAddress(null);
      setAddressFormData({ label: '', type: 'SENDER', city: '', province: '', detail: '', zip: '' });
    }
    setProfileView('ADDRESS_FORM');
    setIsCountryPickerOpen(false);
    setCountrySearch('');
  };

  const handleOrderComplete = async (orderData: any) => {
    // Safety net: hapus semua field undefined secara rekursif sebelum kirim ke Firestore
    const sanitize = (obj: any): any => {
      if (obj === null || obj === undefined) return null;
      if (typeof obj === 'number') return isFinite(obj) ? obj : 0;
      if (typeof obj !== 'object') return obj;
      // Jangan sanitize Firestore FieldValue (serverTimestamp, increment, dll)
      if (obj?.constructor?.name === 'FieldValue' || obj?._methodName !== undefined) return obj;
      if (Array.isArray(obj)) return obj.map(sanitize);
      return Object.fromEntries(
        Object.entries(obj)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, sanitize(v)])
      );
    };

    // 1. Generate order number otomatis (atomic, no duplicate)
    const serviceType: 'JASTIP' | 'BELANJA' = orderData.type === 'BELANJA' ? 'BELANJA' : 'JASTIP';
    const orderNumber = await generateOrderNumber(serviceType);

    // 2. Simpan transaksi utama dengan orderNumber sebagai field readable ID
    const cleanData = sanitize({
      ...orderData,
      orderNumber,
      userId: firebaseUser.uid,
      status: 'PENDING',
      date: new Date().toISOString(),
      updates: [
        { 
          date: new Date().toLocaleDateString('id-ID'), 
          message: 'Pesanan telah dibuat dan menunggu verifikasi admin.', 
          location: 'Sistem' 
        }
      ]
    });
    // createdAt dipisah agar serverTimestamp() tidak disentuh sanitize
    cleanData.createdAt = serverTimestamp();
    
    await addDoc(collection(db, "transactions"), cleanData);

    // ─── Voucher: hanguskan klaim jika dipakai, skip, atau diganti ──────────
    // Kondisi: user punya voucher klaim aktif saat order dibuat
    const voucherUsed = orderData.details?.voucherUsed ?? null;

    // ── Proses voucher yang dipakai (hapus dari koleksi, increment usedCount) ──
    if (voucherUsed) {
      try {
        const voucherInfo = allVouchers.find(v => v.code === voucherUsed);
        const userRef = doc(db, "users", firebaseUser.uid);

        if (voucherInfo) {
          const voucherRef = doc(db, "vouchers", voucherInfo.id);
          await runTransaction(db, async (tx) => {
            const vSnap = await tx.get(voucherRef);
            if (!vSnap.exists()) throw new Error("Voucher tidak ditemukan.");
            const currentUsed = vSnap.data().usedCount ?? 0;
            const quota = vSnap.data().quota ?? 0;
            if (currentUsed >= quota) throw new Error("Kuota voucher sudah habis.");
            tx.update(voucherRef, { usedCount: currentUsed + 1 });
            // Hapus dari voucherCollection, pindah ke usedVouchers
            const newCollection = (user.voucherCollection || []).filter(c => c !== voucherUsed);
            tx.update(userRef, {
              voucherCollection: newCollection,
              usedVouchers: arrayUnion(voucherUsed),
              // Backward compat: clear jika ini adalah activeClaimedVoucher
              ...(user.activeClaimedVoucher === voucherUsed ? { claimStatus: 'used' } : {}),
            });
          });
        }
      } catch (voucherErr: any) {
        console.warn("Gagal update status voucher (non-critical):", voucherErr?.message ?? voucherErr);
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    // ✅ Checklist: pesanan pertama selesai
    setChecklistItem(firebaseUser.uid, 'orderDone');
    setChecklist(getChecklist(firebaseUser.uid));
    setActiveTab('history');
  };

  const navItems = [
    { id: 'home', label: 'Beranda', icon: 'fa-house' },
    { id: 'history', label: 'Riwayat', icon: 'fa-receipt' },
    { id: 'calc', label: 'Cek Ongkir', icon: 'fa-calculator' },
    { id: 'reviews', label: 'Ulasan', icon: 'fa-star' },
    { id: 'profile', label: 'Profil', icon: 'fa-circle-user' },
  ];

  const handleConfirmDelivery = async (transactionId: string) => {
    const transRef = doc(db, "transactions", transactionId);
    const now = new Date();
    await updateDoc(transRef, {
      status: 'DELIVERED',
      confirmedByUser: true,
      confirmedAt: now.toISOString(),
      updates: arrayUnion({
        date: now.toLocaleDateString('id-ID'),
        message: 'Barang dikonfirmasi diterima oleh penerima.',
        location: 'Konfirmasi User'
      })
    });
  };

  const handleReviewSubmit = async (transactionId: string, rating: number, comment: string) => {
    const date = new Date().toISOString().split('T')[0];
    try {
      // 1. Simpan review di dokumen transaksi (selalu, semua rating)
      await setDoc(doc(db, "transactions", transactionId), {
        review: { rating, comment, date }
      }, { merge: true });

      // 2. Simpan ke collection testimonials — semua rating masuk
      //    isPublic: true  → rating ≥ 4, tampil di menu Ulasan publik
      //    isPublic: false → rating < 4, hanya terlihat di panel admin
      await addDoc(collection(db, "testimonials"), {
        name: user.displayName,
        location: transactions.find(t => t.id === transactionId)?.destination || 'Luar Negeri',
        message: comment,
        rating,
        date,
        userId: firebaseUser.uid,
        isPublic: rating >= 4
      });

      // 3. Invalidate cache testimoni agar menu Ulasan langsung refresh
      clearCache('testimonials');

      setSelectedTransaction(null);
    } catch (err) {
      alert('Gagal mengirim ulasan.');
    }
  };

  const filteredCountries = shippingRates.filter(c => 
    c.countryName.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const defaultSender = addresses.find(a => a.type === 'SENDER');
  const defaultReceiver = addresses.find(a => a.type === 'RECEIVER');

  return (
    <div className="bg-slate-50 dark:bg-slate-950 min-h-screen flex flex-col lg:flex-row transition-colors duration-300">
      
      {/* Modal Voucher Saya */}
      {isMyVouchersOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsMyVouchersOpen(false)}></div>
           <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-8 relative z-10 shadow-soft-xl animate-fade-in-up">
              <div className="flex justify-between items-center mb-8">
                 <h3 className="text-xl font-black text-slate-900 dark:text-white">Status Voucher</h3>
                 <button onClick={() => setIsMyVouchersOpen(false)} className="text-slate-400"><i className="fas fa-times"></i></button>
              </div>
              
              <div className="space-y-4 max-h-[60vh] overflow-y-auto scrollbar-hide pr-1">
                 {(() => {
                   // Gabung koleksi baru + voucher lama (backward compat)
                   const collectionCodes = [...(user.voucherCollection || [])];
                   if (user.activeClaimedVoucher && user.claimStatus === 'claimed' && !collectionCodes.includes(user.activeClaimedVoucher)) {
                     collectionCodes.push(user.activeClaimedVoucher);
                   }
                   if (collectionCodes.length === 0) {
                     return (
                       <div className="text-center py-12 opacity-40">
                         <i className="fas fa-ticket-alt text-5xl mb-4"></i>
                         <p className="text-xs font-bold uppercase tracking-widest">Belum ada voucher di koleksi</p>
                         <p className="text-[9px] text-slate-400 mt-2">Klaim promo di bawah atau ajak teman pakai referral</p>
                       </div>
                     );
                   }
                   return (
                     <>
                       <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-2 ml-1">Koleksi Voucher ({collectionCodes.length})</p>
                       {collectionCodes.map((code, idx) => {
                         const vInfo = allVouchers.find(v => v.code === code);
                         const gradients = [
                           'from-blue-600 to-indigo-700',
                           'from-emerald-600 to-teal-700',
                           'from-purple-600 to-violet-700',
                           'from-amber-600 to-orange-700',
                         ];
                         const grad = gradients[idx % gradients.length];
                         return (
                           <div key={code} className={`relative bg-gradient-to-br ${grad} rounded-3xl p-6 text-white overflow-hidden shadow-lg`}>
                             <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white dark:bg-slate-900 rounded-full"></div>
                             <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white dark:bg-slate-900 rounded-full"></div>
                             <div className="relative z-10">
                               <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{vInfo?.title || 'Voucher Diskon'}</p>
                               <h4 className="text-2xl font-black mb-1 tracking-tighter">{code}</h4>
                               {vInfo && (
                                 <p className="text-xs font-bold opacity-80 mb-3">
                                   {vInfo.discountType === 'PERCENTAGE' ? `Diskon ${vInfo.discountValue}%` : `Hemat Rp ${vInfo.discountValue?.toLocaleString('id-ID')}`}
                                   {vInfo.maxDiscount ? ` (maks Rp ${vInfo.maxDiscount.toLocaleString('id-ID')})` : ''}
                                 </p>
                               )}
                               <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest border-t border-white/20 pt-3">
                                 <p>Gunakan saat checkout</p>
                                 {vInfo && <p>Berlaku s/d {new Date(vInfo.endDate).toLocaleDateString('id-ID', {day:'numeric',month:'short'})}</p>}
                               </div>
                             </div>
                           </div>
                         );
                       })}
                     </>
                   );
                 })()}
              </div>
              <button onClick={() => setIsMyVouchersOpen(false)} className="w-full mt-8 py-5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest">Tutup</button>
           </div>
        </div>
      )}

      {/* Voucher Promo Modal */}
      {isVoucherPromoOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => { setIsVoucherPromoOpen(false); setIsVoucherClaimed(false); }}></div>
           <div className="bg-white dark:bg-slate-900 w-full max-sm:rounded-t-[2.5rem] sm:rounded-[2.5rem] p-1 relative z-10 shadow-soft-xl animate-fade-in-up overflow-hidden">
              <div className="p-8 pb-10">
                 {!isVoucherClaimed ? (
                    promoVoucher ? (
                      <>
                        <div className="text-center mb-6">
                          <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-3xl shadow-xl shadow-blue-200 dark:shadow-none mx-auto mb-4 animate-bounce">
                             <i className="fas fa-gift"></i>
                          </div>
                          <span className="inline-block px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full text-[9px] font-black uppercase tracking-widest mb-2">Paling Hemat</span>
                          <h3 className="text-xl font-black text-slate-900 dark:text-white">{promoVoucher.title}</h3>
                        </div>

                        <div className="relative bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 text-white overflow-hidden shadow-lg mb-6">
                          <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white dark:bg-slate-900 rounded-full"></div>
                          <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white dark:bg-slate-900 rounded-full"></div>
                          
                          <div className="relative z-10 text-center">
                             <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Kode Voucher</p>
                             <h4 className="text-3xl font-black mb-4 tracking-tighter">{promoVoucher.code}</h4>
                             <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest border-t border-white/20 pt-4">
                                <div className="text-left">
                                   <p className="opacity-60">Berlaku S/D</p>
                                   <p>{formatDate(promoVoucher.endDate)}</p>
                                </div>
                                <div className="text-right">
                                   <p className="opacity-60">Sisa Kuota</p>
                                   <p>{promoVoucher.quota - promoVoucher.usedCount}</p>
                                </div>
                             </div>
                          </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 mb-8">
                          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 text-center leading-relaxed">
                             <i className="fas fa-circle-info mr-1 text-blue-600"></i> {promoVoucher.description}
                          </p>
                        </div>

                        <button 
                          onClick={() => handleClaimVoucher(promoVoucher.code)}
                          className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-100 dark:shadow-none active:scale-95 transition-all"
                        >
                          KLAIM VOUCHER
                        </button>
                        <button onClick={() => setIsVoucherPromoOpen(false)} className="w-full mt-4 text-slate-400 dark:text-slate-500 font-black text-[10px] uppercase tracking-widest">Nanti Saja</button>
                      </>
                    ) : (
                      <div className="text-center py-6">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
                           <i className="fas fa-ticket-alt"></i>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">Promo Berakhir</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-8 font-medium">Semua promo yang tersedia sudah Anda klaim atau habis masa berlakunya.</p>
                        <button 
                          onClick={() => setIsVoucherPromoOpen(false)}
                          className="w-full py-4 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest"
                        >
                          Mengerti
                        </button>
                      </div>
                    )
                 ) : (
                    <div className="text-center py-6 animate-fade-in">
                       <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-6 shadow-soft">
                          <i className="fas fa-check-circle"></i>
                       </div>
                       <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Voucher Terkunci!</h3>
                       <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-10">
                          Voucher <span className="font-black text-blue-600">{lastClaimedCode || user.activeClaimedVoucher}</span> berhasil ditambahkan ke koleksi voucher kamu!
                       </p>
                       <button 
                         onClick={() => { setIsVoucherPromoOpen(false); setIsVoucherClaimed(false); }}
                         className="w-full py-5 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                       >
                         Tutup
                       </button>
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}

      <aside className="hidden lg:flex flex-col w-72 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 sticky top-0 h-screen p-6 transition-colors duration-300">
        <div className="flex items-center gap-4 mb-10 px-2">
          <div className="w-12 h-12 rounded-xl overflow-hidden shadow-lg border border-slate-100 dark:border-slate-800">
            <img src={LOGO_URL} alt="Logo" className="w-full h-full object-cover" />
          </div>
          <span className="font-bold text-2xl text-slate-900 dark:text-white tracking-tight">JastipTKI</span>
        </div>

        <nav className="flex-1 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id as any); setProfileView('MAIN'); }}
              className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl font-bold transition-all ${
                activeTab === item.id 
                ? 'bg-blue-600 text-white shadow-xl shadow-blue-100 scale-105' 
                : 'text-slate-400 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <i className={`fas ${item.icon} text-lg w-6`}></i>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-50 dark:border-slate-800 space-y-4">
          <div className="flex gap-2 px-2">
            <button 
              onClick={() => setIsMyVouchersOpen(true)}
              className="flex-1 h-12 rounded-2xl flex items-center justify-center gap-3 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 transition-all hover:bg-emerald-100 dark:hover:bg-emerald-900/40 relative"
              title="Voucher Saya"
            >
              <i className="fas fa-ticket-alt"></i>
              {(((user.voucherCollection || []).length > 0) || (user.activeClaimedVoucher && user.claimStatus === 'claimed')) && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[8px] flex items-center justify-center rounded-full font-black animate-pulse">{((user.voucherCollection || []).length + (user.activeClaimedVoucher && user.claimStatus === 'claimed' && !(user.voucherCollection || []).includes(user.activeClaimedVoucher) ? 1 : 0))}</span>}
            </button>
            <button 
              onClick={toggleDarkMode}
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-all hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <i className={`fas ${isDarkMode ? 'fa-sun text-yellow-500' : 'fa-moon'}`}></i>
            </button>
          </div>
          <button onClick={onLogout} className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
            <i className="fas fa-power-off text-lg w-6"></i>
            Keluar Akun
          </button>
        </div>
      </aside>

      <header className="lg:hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-40 border-b border-slate-100 dark:border-slate-800 px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg overflow-hidden border border-slate-100 dark:border-slate-800">
            <img src={LOGO_URL} alt="Logo" className="w-full h-full object-cover" />
          </div>
          <span className="font-bold text-lg text-slate-900 dark:text-white">JastipTKI</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsMyVouchersOpen(true)} className="w-9 h-9 rounded-full flex items-center justify-center text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 relative">
             <i className="fas fa-ticket-alt"></i>
             {(((user.voucherCollection || []).length > 0) || (user.activeClaimedVoucher && user.claimStatus === 'claimed')) && <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 text-white text-[7px] flex items-center justify-center rounded-full font-black">{((user.voucherCollection || []).length + (user.activeClaimedVoucher && user.claimStatus === 'claimed' && !(user.voucherCollection || []).includes(user.activeClaimedVoucher) ? 1 : 0))}</span>}
          </button>
          <button onClick={toggleDarkMode} className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400"><i className={`fas ${isDarkMode ? 'fa-sun' : 'fa-moon'}`}></i></button>
          <button onClick={() => {setActiveTab('profile'); setProfileView('MAIN');}} className="w-9 h-9 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-blue-600 font-bold border-2 border-white dark:border-slate-800">{user.displayName?.charAt(0)}</button>
        </div>
      </header>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="hidden lg:flex items-center justify-between px-10 h-24 bg-transparent shrink-0">
          <h2 className="text-3xl font-black text-slate-900 dark:text-white capitalize">
            {navItems.find(n => n.id === activeTab)?.label}
          </h2>
          <div className="flex items-center gap-6">
             <div className="text-right">
                <p className="text-sm font-black text-slate-900 dark:text-white">{user.displayName}</p>
                <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">Pahlawan Devisa • ID: {user.uid?.slice(0,5).toUpperCase()}</p>
             </div>
             <button onClick={() => {setActiveTab('profile'); setProfileView('MAIN');}} className="w-12 h-12 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-2xl flex items-center justify-center font-black shadow-lg hover:scale-110 transition-transform">{user.displayName?.charAt(0)}</button>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-10 max-w-7xl w-full mx-auto pb-32 lg:pb-10 overflow-x-hidden">
          {activeTab === 'home' && (
            <div className="animate-fade-in-up space-y-10">
              {/* ─── Checklist Getting Started ─── */}
              <GettingStartedCard
                checklist={checklist}
                checklistStartedAt={checklistStartedAt}
                onNavigate={(tab) => { setActiveTab(tab as any); setProfileView('MAIN'); }}
              />
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                <div className="xl:col-span-8 space-y-8">
                  <div className="bg-gradient-to-br from-blue-600 to-indigo-800 rounded-[2.5rem] p-8 sm:p-10 text-white relative overflow-hidden shadow-soft-xl group">
                     <div className="relative z-10 max-w-sm">
                        <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[9px] font-black uppercase tracking-[0.2em] mb-4">Eksklusif</span>
                        <h3 className="text-2xl sm:text-4xl font-black mb-4 leading-tight tracking-tighter">
                            Klaim Promo Spesial!
                        </h3>
                        <p className="text-blue-50 font-medium mb-6 text-sm leading-relaxed">
                            {appConfig.promoBanner || 'Ambil voucher potongan ongkir untuk pengiriman ke luar negeri hari ini.'}
                        </p>
                        {appConfig.enableVoucher !== false && (() => {
                          const voucherCount = (user.voucherCollection || []).length + (user.activeClaimedVoucher && user.claimStatus === 'claimed' && !(user.voucherCollection || []).includes(user.activeClaimedVoucher) ? 1 : 0);
                          const hasVoucher = voucherCount > 0;
                          return (
                            <button onClick={() => setIsVoucherPromoOpen(true)} className="bg-white text-blue-700 px-8 py-3.5 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95 transition-all">
                                {hasVoucher ? `KOLEKSI VOUCHER (${voucherCount})` : 'LIHAT PROMO'}
                            </button>
                          );
                        })()}
                     </div>
                     <i className="fas fa-gift absolute -bottom-10 -right-10 text-white/10 text-[16rem] -rotate-12 pointer-events-none group-hover:scale-110 transition-transform duration-700"></i>
                  </div>

                  {/* Beta Feature Banner (Conditional) */}
                  {flags.enableBetaFeature && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-3xl border border-amber-100 dark:border-amber-800 flex items-center justify-between shadow-sm animate-pulse">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-amber-100 dark:bg-amber-800 rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-sm">
                          <i className="fas fa-flask"></i>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">Beta Access</p>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">Anda terpilih mencoba fitur Beta terbaru!</p>
                        </div>
                      </div>
                      <button className="px-4 py-2 bg-amber-600 text-white text-[10px] font-black rounded-lg uppercase tracking-widest shadow-lg">Coba</button>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-6">
                    <button 
                      id="onboarding-kirim-btn"
                      onClick={() => appConfig.enableCheckout !== false ? setIsKirimJastipOpen(true) : alert('Pemesanan sementara dinonaktifkan oleh admin.')} 
                      className={`bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-soft dark:shadow-none flex flex-col items-center text-center gap-4 hover:border-blue-500 hover:shadow-soft-xl transition-all group ${appConfig.enableCheckout === false ? 'opacity-50' : ''}`}
                    >
                      <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-3xl flex items-center justify-center text-2xl group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                        <i className="fas fa-paper-plane"></i>
                      </div>
                      <div>
                        <span className="font-black text-xs uppercase dark:text-white block mb-1">Kirim Jastip</span>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">Titip barang dari Indonesia</p>
                      </div>
                    </button>
                    <button 
                      id="onboarding-beli-btn"
                      onClick={() => appConfig.enableCheckout !== false ? setIsBeliTitipanOpen(true) : alert('Pemesanan sementara dinonaktifkan oleh admin.')} 
                      className={`bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-soft dark:shadow-none flex flex-col items-center text-center gap-4 hover:border-emerald-500 hover:shadow-soft-xl transition-all group ${appConfig.enableCheckout === false ? 'opacity-50' : ''}`}
                    >
                      <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 rounded-3xl flex items-center justify-center text-2xl group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-sm">
                        <i className="fas fa-cart-plus"></i>
                      </div>
                      <div>
                        <span className="font-black text-xs uppercase dark:text-white block mb-1">Beli Titipan</span>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">Belanja marketplace</p>
                      </div>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    {[
                      { label: 'Pesanan Aktif', val: transactions.filter(t => t.status !== 'DELIVERED').length, icon: 'fa-truck-fast', color: 'text-blue-600' },
                      { label: 'Total Selesai', val: transactions.filter(t => t.status === 'DELIVERED').length, icon: 'fa-check-double', color: 'text-emerald-600' }
                    ].map((stat, i) => (
                      <div key={i} className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-soft dark:shadow-none flex flex-col gap-1 hover:shadow-soft-xl transition-all">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg mb-3 bg-slate-50 dark:bg-slate-800 ${stat.color}`}>
                          <i className={`fas ${stat.icon}`}></i>
                        </div>
                        <p className="text-[11px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">{stat.label}</p>
                        <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{stat.val}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="xl:col-span-4 space-y-8">
                  <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-soft dark:shadow-none">
                    <div className="flex justify-between items-center mb-6">
                      <h4 className="font-black text-sm uppercase tracking-widest dark:text-white">Tracking Aktif</h4>
                      <button onClick={() => setActiveTab('history')} className="text-[10px] font-black text-blue-600 dark:text-blue-400 hover:underline">Lihat Semua</button>
                    </div>
                    <div className="space-y-6">
                      {transactions.filter(t => t.status !== 'DELIVERED').length > 0 ? (
                        transactions.filter(t => t.status !== 'DELIVERED').slice(0, 2).map((t, idx) => (
                          <div key={idx} onClick={() => setSelectedTransaction(t)} className="p-5 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-50 hover:border-blue-400 cursor-pointer transition-all shadow-sm">
                             <div className="flex justify-between items-center mb-3">
                               <span className="text-[8px] font-black bg-blue-100 dark:bg-blue-900 text-blue-600 px-2 py-0.5 rounded uppercase">{(t as any).orderNumber || t.id.slice(-6)}</span>
                               <span className="text-[8px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest">{t.status}</span>
                             </div>
                             <p className="font-black text-xs dark:text-white mb-2 truncate">Ke {t.destination}</p>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-6">
                           <i className="fas fa-box-open text-slate-200 dark:text-slate-700 text-3xl mb-3"></i>
                           <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Tidak ada pengiriman aktif</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Referral Card (Conditional) */}
                  {flags.enableReferral && (
                    <div className="bg-emerald-600 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-lg group">
                      <div className="relative z-10">
                        <h4 className="text-lg font-black mb-1">Ajak Teman!</h4>
                        <p className="text-[10px] font-medium opacity-80 mb-4 leading-relaxed">Dapatkan voucher Rp {referralConfig.rewardAmount.toLocaleString('id-ID')} untuk setiap teman yang mendaftar.</p>
                        <button onClick={() => setIsReferralOpen(true)} className="w-full py-3 bg-white text-emerald-600 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-sm hover:scale-105 active:scale-95 transition-all">Bagikan Link</button>
                      </div>
                      <i className="fas fa-users absolute -bottom-4 -right-4 text-white/10 text-7xl rotate-12 group-hover:scale-110 transition-transform"></i>
                    </div>
                  )}

                  <div className="bg-slate-900 dark:bg-blue-900 rounded-[2.5rem] p-8 text-white shadow-soft-xl relative overflow-hidden group">
                     <div className="relative z-10">
                        <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-xl mb-4">
                           <i className="fas fa-headset"></i>
                        </div>
                        <h4 className="text-xl font-black mb-1">Butuh Bantuan?</h4>
                        <p className="text-[11px] font-medium text-slate-400 dark:text-slate-300 mb-6 leading-relaxed">Tim Admin JastipTKI siap melayani pertanyaan Anda 24/7 melalui WhatsApp.</p>
                        <button 
                          onClick={() => window.open(`https://wa.me/${appConfig.adminWhatsApp}`, '_blank')}
                          className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                          <i className="fab fa-whatsapp text-sm"></i> Chat Admin Sekarang
                        </button>
                     </div>
                     <i className="fas fa-comments absolute -bottom-10 -right-10 text-white/5 text-[12rem] -rotate-12 pointer-events-none group-hover:scale-110 transition-transform"></i>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <HistoryErrorBoundary>
            <div className="space-y-4">
              {isTransactionsLoading ? (
                // ─── Loading Skeleton ───────────────────────────────────────
                <div className="space-y-4 animate-pulse">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-800">
                      <div className="flex justify-between items-center mb-4">
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-full w-24"></div>
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-full w-16"></div>
                      </div>
                      <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full w-3/4 mb-2"></div>
                      <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full w-1/2"></div>
                    </div>
                  ))}
                  <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest pt-2">
                    <i className="fas fa-circle-notch fa-spin mr-2"></i>Memuat riwayat...
                  </p>
                </div>
              ) : permissionError ? (
                // ─── Permission Error State (user baru / koneksi terbatas) ──
                <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
                  <div className="w-20 h-20 bg-amber-50 dark:bg-amber-900/20 text-amber-500 rounded-full flex items-center justify-center text-3xl mx-auto mb-6">
                    <i className="fas fa-wifi-slash"></i>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">Koneksi Terbatas</h3>
                  <p className="text-sm text-slate-400 font-medium mb-8 leading-relaxed max-w-xs">
                    Riwayat pesanan tidak dapat dimuat saat ini. Pastikan koneksi internet kamu stabil lalu coba lagi.
                  </p>
                  <button
                    onClick={() => { setPermissionError(false); setIsTransactionsLoading(true); }}
                    className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center gap-2"
                  >
                    <i className="fas fa-rotate-right text-xs"/> Coba Lagi
                  </button>
                </div>
              ) : transactions.length === 0 ? (
                <HistoryEmptyState onCreateOrder={() => setIsServicePickerOpen(true)} />
              ) : (
                <>
                  <TransactionList 
                    transactions={showAllTransactions ? transactions : transactions.slice(0, TRANSACTION_DISPLAY_LIMIT)} 
                    onAddClick={() => setIsServicePickerOpen(true)}
                    onTransactionClick={setSelectedTransaction}
                  />
                  {transactions.length > TRANSACTION_DISPLAY_LIMIT && (
                    <div className="text-center pb-4">
                      <button
                        onClick={() => setShowAllTransactions(!showAllTransactions)}
                        className="inline-flex items-center gap-2 px-8 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full font-bold text-sm hover:bg-blue-600 hover:text-white transition-all"
                      >
                        <i className={`fas ${showAllTransactions ? 'fa-chevron-up' : 'fa-list'}`}></i>
                        {showAllTransactions ? 'Tampilkan Lebih Sedikit' : `Lihat Semua Riwayat (${transactions.length})`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
            </HistoryErrorBoundary>
          )}

          {activeTab === 'calc' && (
            <div className="max-w-2xl mx-auto">
              <CalcTooltip />
              <Calculator />
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-6 animate-fade-in-up">
              <div className="grid md:grid-cols-2 gap-6">
                {(showAllReviews ? reviews : reviews.slice(0, TESTIMONIAL_DISPLAY_LIMIT)).map(t => (
                  <div key={t.id} className="p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-soft dark:shadow-none hover:shadow-soft-xl transition-shadow">
                    <div className="flex gap-1 text-yellow-400 mb-4">
                      {[...Array(5)].map((_, i) => (
                        <i key={i} className={`fas fa-star ${i < t.rating ? 'opacity-100' : 'opacity-20'}`}></i>
                      ))}
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 font-medium mb-6 italic leading-relaxed">"{t.message}"</p>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center font-bold">{t.name.charAt(0)}</div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-900 dark:text-white truncate">{t.name}</h4>
                        <div className="flex flex-col mt-0.5">
                          {t.date && <span className="text-[10px] font-bold text-slate-400 dark:text-slate-300 uppercase tracking-tight">{formatDate(t.date)}</span>}
                          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest">{t.location}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {reviews.length === 0 && (
                  <div className="col-span-full text-center py-20 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800">
                    <i className="fas fa-comment-slash text-4xl text-slate-200 mb-4"></i>
                    <p className="font-bold text-slate-400 uppercase tracking-widest text-xs">Belum ada ulasan publik</p>
                  </div>
                )}
              </div>
              {reviews.length > TESTIMONIAL_DISPLAY_LIMIT && (
                <div className="text-center pt-2">
                  <button
                    onClick={() => setShowAllReviews(!showAllReviews)}
                    className="inline-flex items-center gap-2 px-8 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full font-bold text-sm hover:bg-blue-600 hover:text-white transition-all"
                  >
                    <i className={`fas ${showAllReviews ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                    {showAllReviews ? 'Tampilkan Lebih Sedikit' : `Lihat Semua (${reviews.length} Ulasan)`}
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="max-w-2xl mx-auto min-h-[500px] relative animate-fade-in-up">
              {profileView === 'MAIN' && (
                <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 lg:p-12 border border-slate-100 dark:border-slate-800 shadow-soft dark:shadow-none text-center">
                  <div className="relative inline-block mb-8">
                    <div className="w-24 h-24 bg-blue-600 text-white rounded-full flex items-center justify-center text-4xl font-black shadow-xl ring-8 ring-blue-50 dark:ring-slate-800 mx-auto">{user.displayName?.charAt(0)}</div>
                    {(() => {
                      const uType = VoucherEngine.getUserType(transactions);
                      const badgeStyle: Record<string, string> = {
                        new_user:     'bg-slate-500 text-white',
                        old_user:     'bg-blue-500 text-white',
                        active_user:  'bg-emerald-500 text-white',
                        loyalty_user: 'bg-amber-500 text-white',
                      };
                      const badgeLabel: Record<string, string> = {
                        new_user:     'New User',
                        old_user:     'Member',
                        active_user:  'Active User',
                        loyalty_user: 'Loyalty User',
                      };
                      return (
                        <div className={`absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border-2 border-white dark:border-slate-900 ${badgeStyle[uType] || badgeStyle.old_user}`}>
                          {badgeLabel[uType] || uType.replace('_', ' ')}
                        </div>
                      );
                    })()}
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white">{user.displayName}</h3>
                  <p className="text-slate-400 dark:text-slate-400 font-bold mb-10 text-sm">{user.email}</p>
                  
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { view: 'EDIT', label: 'Edit Profil', icon: 'fa-user-edit' },
                      { view: 'ADDRESS', label: 'Alamat Saya', icon: 'fa-map-marked-alt' },
                      { view: 'HELP', label: 'Bantuan & FAQ', icon: 'fa-question-circle' }
                    ].map(btn => (
                      <button key={btn.view} onClick={() => setProfileView(btn.view as any)} className="w-full p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] font-black text-sm text-slate-700 dark:text-slate-300 flex justify-between items-center px-10 transition-all hover:bg-blue-600 hover:text-white group border border-transparent hover:border-blue-400 shadow-soft dark:shadow-none">
                        <span className="flex items-center gap-5"><i className={`fas ${btn.icon} opacity-40 group-hover:opacity-100 transition-all`}></i> {btn.label}</span> 
                        <i className="fas fa-chevron-right text-xs opacity-30"></i>
                      </button>
                    ))}
                    {flags.enableReferral && (
                       <button onClick={() => setIsReferralOpen(true)} className="w-full p-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-[2rem] font-black text-sm text-emerald-700 dark:text-emerald-400 flex justify-between items-center px-10 transition-all hover:bg-emerald-600 hover:text-white group border border-emerald-100 dark:border-emerald-800 shadow-soft dark:shadow-none mt-1">
                          <span className="flex items-center gap-5"><i className="fas fa-user-plus opacity-40 group-hover:opacity-100 transition-all"></i> Program Referral</span> 
                          <i className="fas fa-chevron-right text-xs opacity-30"></i>
                       </button>
                    )}
                    <button onClick={onLogout} className="w-full p-6 text-red-500 font-black text-xs uppercase tracking-widest mt-6 flex items-center justify-center gap-3 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-[2rem] transition-all">
                      <i className="fas fa-sign-out-alt"></i> Keluar Akun
                    </button>
                  </div>
                </div>
              )}

              {profileView === 'EDIT' && (
                <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 lg:p-12 border border-slate-100 dark:border-slate-800 shadow-soft dark:shadow-none relative">
                  <button onClick={() => setProfileView('MAIN')} className="absolute top-8 left-8 w-10 h-10 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 hover:text-blue-600 transition-all shadow-sm"><i className="fas fa-arrow-left"></i></button>
                  <div className="text-center mb-10 mt-6">
                     <h4 className="text-xl font-black text-slate-900 dark:text-white mb-1">Edit Profil</h4>
                  </div>
                  <form onSubmit={handleUpdateProfile} className="space-y-6 text-left">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">Nama Lengkap</label>
                      <input type="text" required value={tempProfile.name} onChange={(e) => setTempProfile({...tempProfile, name: e.target.value})} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-black text-slate-900 dark:text-white text-sm" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">No. WhatsApp</label>
                      <input type="tel" required value={tempProfile.phone} onChange={(e) => setTempProfile({...tempProfile, phone: e.target.value})} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-black text-slate-900 dark:text-white text-sm" />
                    </div>
                    <div className="flex gap-4 pt-6">
                      <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all">Simpan Perubahan</button>
                    </div>
                  </form>
                </div>
              )}

              {profileView === 'ADDRESS' && (
                <div className="space-y-6">
                   <div className="flex items-center justify-between">
                      <button onClick={() => setProfileView('MAIN')} className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center text-slate-400 dark:text-slate-500 shadow-sm border border-slate-100 dark:border-slate-800 hover:text-blue-600 transition-all"><i className="fas fa-arrow-left"></i></button>
                      <h4 className="text-base font-black dark:text-white uppercase tracking-widest">Alamat Saya</h4>
                      <div className="w-10"></div>
                   </div>
                   <div className="space-y-4">
                      {addresses.length > 0 ? addresses.map(addr => (
                        <div key={addr.id} className="p-8 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-soft dark:shadow-none hover:shadow-soft-xl transition-all text-left">
                          <div className="flex justify-between items-start mb-6">
                            <span className={`text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${addr.type === 'SENDER' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30'}`}>{addr.type === 'SENDER' ? 'PENGIRIM (INDO)' : 'PENERIMA (LUAR)'}</span>
                            <div className="flex gap-2">
                               <button onClick={() => openAddressForm(addr)} className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-blue-600 transition-all"><i className="fas fa-pen text-xs"></i></button>
                               <button onClick={() => handleDeleteAddress(addr.id)} className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-red-500 transition-all"><i className="fas fa-trash-alt text-xs"></i></button>
                            </div>
                          </div>
                          <h5 className="font-black text-slate-900 dark:text-white text-sm mb-1">{addr.label}</h5>
                          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{addr.detail}, {addr.city}, {addr.province} - {addr.zip}</p>
                        </div>
                      )) : (
                        <div className="text-center py-10 opacity-40">
                           <i className="fas fa-map-location-dot text-4xl mb-4 text-slate-300 dark:text-slate-700"></i>
                           <p className="text-xs font-bold uppercase tracking-widest dark:text-slate-500">Belum ada alamat tersimpan</p>
                        </div>
                      )}
                      <button onClick={() => openAddressForm()} className="w-full py-8 border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 rounded-[2.5rem] font-black text-xs uppercase tracking-widest hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm"><i className="fas fa-plus-circle text-xl mb-1 block"></i> Tambah Alamat</button>
                   </div>
                </div>
              )}

              {profileView === 'ADDRESS_FORM' && (
                <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 lg:p-12 border border-slate-100 dark:border-slate-800 shadow-soft dark:shadow-none relative">
                   <button onClick={() => setProfileView('ADDRESS')} className="absolute top-8 left-8 w-10 h-10 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-blue-600 transition-all shadow-sm"><i className="fas fa-arrow-left"></i></button>
                   <div className="text-center mb-10 mt-6">
                      <h4 className="text-xl font-black text-slate-900 dark:text-white mb-1">{editingAddress ? 'Edit Alamat' : 'Tambah Alamat'}</h4>
                   </div>
                   <form onSubmit={handleSaveAddress} className="space-y-6 text-left">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Label Alamat</label>
                        <input type="text" required placeholder="Rumah Utama, Kantor, dsb." value={addressFormData.label} onChange={e => setAddressFormData({...addressFormData, label: e.target.value})} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-900 dark:text-white shadow-sm" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <button type="button" onClick={() => setAddressFormData({...addressFormData, type: 'SENDER', province: ''})} className={`py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border-2 transition-all shadow-sm ${addressFormData.type === 'SENDER' ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500'}`}>PENGIRIM (INDO)</button>
                        <button type="button" onClick={() => setAddressFormData({...addressFormData, type: 'RECEIVER', province: ''})} className={`py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border-2 transition-all shadow-sm ${addressFormData.type === 'RECEIVER' ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500'}`}>PENERIMA (LUAR)</button>
                      </div>

                      {addressFormData.type === 'SENDER' && (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Provinsi</label>
                          <input type="text" required placeholder="Jawa Barat, Bali, dsb." value={addressFormData.province} onChange={e => setAddressFormData({...addressFormData, province: e.target.value})} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-900 dark:text-white shadow-sm" />
                        </div>
                      )}

                      {addressFormData.type === 'RECEIVER' && (
                        <div className="space-y-1.5 relative" ref={countryPickerRef}>
                          <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Negara Tujuan</label>
                          <button 
                            type="button"
                            onClick={() => setIsCountryPickerOpen(!isCountryPickerOpen)}
                            className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-slate-900 dark:text-white shadow-sm text-left flex justify-between items-center transition-all"
                          >
                            <span className={addressFormData.province ? "opacity-100" : "opacity-40"}>{addressFormData.province || 'Pilih Negara...'}</span>
                            <i className={`fas fa-chevron-down text-xs transition-transform ${isCountryPickerOpen ? 'rotate-180' : ''} ${addressFormData.province ? 'text-emerald-600' : ''}`}></i>
                          </button>

                          {isCountryPickerOpen && (
                            <div className="absolute top-full left-0 right-0 mt-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] shadow-2xl z-[150] overflow-hidden animate-fade-in-up p-3">
                               <div className="relative mb-3">
                                  <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                                  <input 
                                    type="text" 
                                    autoFocus
                                    placeholder="Cari negara..." 
                                    className="w-full pl-10 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl font-bold text-xs outline-none focus:border-emerald-500 dark:text-white"
                                    value={countrySearch}
                                    onChange={(e) => setCountrySearch(e.target.value)}
                                  />
                               </div>
                               <div className="max-h-60 overflow-y-auto scrollbar-hide space-y-1">
                                  {filteredCountries.length > 0 ? filteredCountries.map(c => (
                                    <button
                                      key={c.countryCode}
                                      type="button"
                                      onClick={() => {
                                        setAddressFormData({...addressFormData, province: c.countryName});
                                        setIsCountryPickerOpen(false);
                                        setCountrySearch('');
                                      }}
                                      className={`w-full p-4 rounded-xl text-left text-xs font-bold transition-all hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex items-center justify-between group ${addressFormData.province === c.countryName ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'text-slate-600 dark:text-slate-400'}`}
                                    >
                                       <span>{c.countryName}</span>
                                       <i className="fas fa-check text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity"></i>
                                    </button>
                                  )) : (
                                    <div className="p-10 text-center text-slate-400 text-[10px] font-bold uppercase tracking-widest italic">
                                      Negara belum didukung
                                    </div>
                                  )}
                               </div>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Kota</label>
                          <input type="text" required value={addressFormData.city} onChange={e => setAddressFormData({...addressFormData, city: e.target.value})} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-900 dark:text-white shadow-sm" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Kode Pos</label>
                          <input type="text" value={addressFormData.zip} onChange={e => setAddressFormData({...addressFormData, zip: e.target.value})} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-900 dark:text-white shadow-sm" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Detail Alamat Lengkap</label>
                        <textarea required value={addressFormData.detail} onChange={e => setAddressFormData({...addressFormData, detail: e.target.value})} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold h-24 resize-none text-slate-900 dark:text-white shadow-sm" placeholder="Nama Jalan, RT/RW, dsb."></textarea>
                      </div>
                      <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all">Simpan Alamat</button>
                   </form>
                </div>
              )}

              {profileView === 'HELP' && (
                <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 lg:p-12 border border-slate-100 dark:border-slate-800 shadow-soft dark:shadow-none relative text-left">
                  <button onClick={() => setProfileView('MAIN')} className="absolute top-8 left-8 w-10 h-10 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 hover:text-blue-600 transition-all shadow-sm"><i className="fas fa-arrow-left"></i></button>
                  <div className="text-center mb-10 mt-6">
                     <h4 className="text-xl font-black text-slate-900 dark:text-white mb-1">Pusat Bantuan</h4>
                  </div>

                  {/* Ulangi Tur Aplikasi */}
                  <button
                    onClick={async () => {
                      await resetOnboarding(firebaseUser.uid);
                      setChecklist(getChecklist(firebaseUser.uid));
                      setShowOnboarding(true);
                      setActiveTab('home');
                      setProfileView('MAIN');
                    }}
                    className="w-full mb-6 py-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 text-blue-600 dark:text-blue-400 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-100 transition-all active:scale-95"
                  >
                    <i className="fas fa-rotate-left text-sm"/> Ulangi Tur Aplikasi
                  </button>

                  <div className="space-y-4">
                    {[
                      { q: 'Bagaimana cara lacak paket?', a: 'Anda dapat melihat status terbaru paket di menu Riwayat atau Tracking Aktif di Beranda.' },
                      { q: 'Apakah ada asuransi?', a: 'Ya, setiap pengiriman JastipTKI dilindungi asuransi dasar. Anda bisa upgrade ke asuransi premium.' },
                      { q: 'Berapa lama pengiriman?', a: 'Rata-rata pengiriman kargo udara membutuhkan waktu 5-8 hari kerja sampai di alamat tujuan.' }
                    ].map((faq, i) => (
                      <div key={i} className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <h5 className="font-black text-xs text-slate-900 dark:text-white mb-2">{faq.q}</h5>
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed">{faq.a}</p>
                      </div>
                    ))}
                    <button onClick={() => window.open(`https://wa.me/${appConfig.adminWhatsApp}`, '_blank')} className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 mt-6 active:scale-95 transition-all shadow-lg">
                      <i className="fab fa-whatsapp"></i> Chat Support 24/7
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {selectedTransaction && <TransactionDetailModal transaction={selectedTransaction} onClose={() => setSelectedTransaction(null)} onReviewSubmit={handleReviewSubmit} onConfirmDelivery={handleConfirmDelivery} appConfig={appConfig} />}
      {isKirimJastipOpen && <KirimJastipFlow onClose={() => setIsKirimJastipOpen(false)} onComplete={handleOrderComplete} defaultSender={defaultSender} defaultReceiver={defaultReceiver} user={user} appConfig={appConfig} availableVouchers={availableVouchers} transactions={transactions} />}
      {isBeliTitipanOpen && <BeliTitipanFlow onClose={() => setIsBeliTitipanOpen(false)} onComplete={handleOrderComplete} defaultReceiver={defaultReceiver} user={user} appConfig={appConfig} availableVouchers={availableVouchers} transactions={transactions} />}
      {isReferralOpen && <ReferralModal user={user} onClose={() => setIsReferralOpen(false)} />}

      {/* ─── Service Picker Modal ─── */}
      {isServicePickerOpen && (
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsServicePickerOpen(false)} />
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-8 relative z-10 shadow-2xl animate-fade-in-up">
            <div className="text-center mb-8">
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1">Buat Pesanan Baru</h3>
              <p className="text-xs text-slate-400 font-medium">Pilih jenis layanan yang kamu butuhkan</p>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <button
                onClick={() => { setIsServicePickerOpen(false); appConfig.enableCheckout !== false ? setIsKirimJastipOpen(true) : alert('Pemesanan sementara dinonaktifkan oleh admin.'); }}
                className="flex flex-col items-center gap-3 p-6 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-100 dark:border-blue-800 rounded-3xl hover:border-blue-500 hover:bg-blue-100 transition-all group"
              >
                <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-2xl shadow-lg group-hover:scale-110 transition-transform">
                  <i className="fas fa-paper-plane" />
                </div>
                <div className="text-center">
                  <p className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-wide">Kirim Jastip</p>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">Titip barang dari Indonesia</p>
                </div>
              </button>
              <button
                onClick={() => { setIsServicePickerOpen(false); appConfig.enableCheckout !== false ? setIsBeliTitipanOpen(true) : alert('Pemesanan sementara dinonaktifkan oleh admin.'); }}
                className="flex flex-col items-center gap-3 p-6 bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-100 dark:border-emerald-800 rounded-3xl hover:border-emerald-500 hover:bg-emerald-100 transition-all group"
              >
                <div className="w-14 h-14 bg-emerald-600 text-white rounded-2xl flex items-center justify-center text-2xl shadow-lg group-hover:scale-110 transition-transform">
                  <i className="fas fa-cart-plus" />
                </div>
                <div className="text-center">
                  <p className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-wide">Beli Titipan</p>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">Belanja marketplace</p>
                </div>
              </button>
            </div>
            <button onClick={() => setIsServicePickerOpen(false)} className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest">
              Batal
            </button>
          </div>
        </div>
      )}

      {/* ─── Referral Welcome Banner ─── */}
      {showReferralWelcome && (
        <div className="fixed inset-0 z-[140] flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowReferralWelcome(false)} />
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] relative z-10 shadow-2xl overflow-hidden animate-fade-in-up">
            {/* Header gradient */}
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-8 text-center relative overflow-hidden">
              <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center text-white text-3xl mx-auto mb-4">
                <i className="fas fa-gift" />
              </div>
              <h3 className="text-2xl font-black text-white">Voucher Kamu Aktif! 🎉</h3>
              <p className="text-white/80 text-xs font-bold mt-2">
                Kamu berhasil mendaftar lewat referral teman
              </p>
              <i className="fas fa-star absolute -top-2 -right-2 text-white/10 text-8xl rotate-12" />
            </div>
            {/* Body */}
            <div className="p-8 space-y-5">
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-200 dark:border-emerald-700 rounded-2xl p-5 text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Kode Voucher Kamu</p>
                <p className="text-3xl font-black text-emerald-600 tracking-widest font-mono">
                  {(user.voucherCollection || []).length > 0 ? `${(user.voucherCollection || []).length} voucher` : user.activeClaimedVoucher || '-'}
                </p>
                <p className="text-[10px] font-bold text-slate-500 mt-2">
                  Sudah otomatis terkunci untuk pesanan pertama kamu
                </p>
              </div>
              <div className="space-y-3">
                {[
                  { icon: 'fa-check-circle', color: 'text-emerald-600', text: 'Voucher sudah otomatis terklaim — tidak perlu input manual' },
                  { icon: 'fa-shopping-bag', color: 'text-blue-600', text: 'Akan muncul otomatis di dropdown voucher saat checkout' },
                  { icon: 'fa-clock', color: 'text-amber-500', text: 'Berlaku sesuai tanggal yang tertera di voucher' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <i className={`fas ${item.icon} ${item.color} mt-0.5 text-sm shrink-0`} />
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{item.text}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setShowReferralWelcome(false)}
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95"
              >
                Siap Belanja! 🛍️
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Onboarding System ─── */}
      {showOnboarding && (
        <OnboardingSystem uid={firebaseUser.uid} onComplete={() => setShowOnboarding(false)} />
      )}

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-100 dark:border-slate-800 px-6 py-4 flex justify-between items-center z-40 shadow-soft">
        {navItems.map(item => (
          <button key={item.id} id={item.id === 'history' ? 'onboarding-riwayat-btn' : undefined} onClick={() => {setActiveTab(item.id as any); setProfileView('MAIN');}} className={`flex flex-col items-center gap-1.5 ${activeTab === item.id ? 'text-blue-600 scale-110' : 'text-slate-400 dark:text-slate-400'}`}>
            <i className={`fas ${item.icon} text-lg`}></i>
            <span className="text-[8px] font-black uppercase tracking-widest">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default Dashboard;
