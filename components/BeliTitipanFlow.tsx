
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Voucher, UserProfile, Transaction } from '../types';
import * as VoucherEngine from '../voucherEngine';
import { useProducts } from '../hooks/useProducts';
import { usePaymentConfig } from '../hooks/usePaymentConfig';
import { useShippingRates } from '../hooks/useShippingRates';

interface CustomRequest {
  id: string;
  name: string;
  platform: string;
  link: string;
  imageLink: string;
  estimatedPrice: number;
  weight: string;
  qty: number;
  notes: string;
}

interface BeliTitipanFlowProps {
  onClose: () => void;
  onComplete: (data: any) => Promise<void>;
  defaultReceiver?: any;
  user: UserProfile;
  appConfig?: any;
  availableVouchers: Voucher[];
  transactions: Transaction[];
}

const STORAGE_KEY = 'jastiptki_beli_titipan_draft_v2'; 

const BeliTitipanFlow: React.FC<BeliTitipanFlowProps> = ({ onClose, onComplete, defaultReceiver, user, appConfig, availableVouchers = [], transactions = [] }) => {
  const {
    products,
    categories: productCategories,
    loading: loadingProducts,
    loadingMore,
    error: productError,
    hasMore: hasMoreProducts,
    mode: productMode,
    loadMore,
    setCategory: setProductCategory,
    setSearch: setProductSearch,
    resetFilters: resetProductFilters,
  } = useProducts();
  const { paymentConfig } = usePaymentConfig();
  const { rates: shippingRates, loading: loadingRates } = useShippingRates();
  const [step, setStep] = useState(0);
  const [activeTab, setActiveTab] = useState<'KATALOG' | 'REQUEST'>('KATALOG');
  const [cart, setCart] = useState<{ [id: string]: number }>({});
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [waMessageUrl, setWaMessageUrl] = useState('');
  
  // State Voucher
  const [isVoucherDropdownOpen, setIsVoucherDropdownOpen] = useState(false);
  const [selectedVoucherCode, setSelectedVoucherCode] = useState<string | null>((user.voucherCollection || [])[0] || user.activeClaimedVoucher || null);

  const adminWhatsApp = useMemo(() => {
    const raw = appConfig?.adminWhatsApp || "6281299887766";
    return raw.replace(/\D/g, '');
  }, [appConfig?.adminWhatsApp]);

  const [targetCountry, setTargetCountry] = useState('');

  useEffect(() => {
    if (shippingRates.length > 0 && !targetCountry) {
        const matchedRate = shippingRates.find(r => r.countryName === defaultReceiver?.province);
        setTargetCountry(matchedRate ? matchedRate.countryName : shippingRates[0].countryName);
    }
  }, [shippingRates, defaultReceiver]);

  const [customRequests, setCustomRequests] = useState<CustomRequest[]>([
    { id: 'req_1', name: '', platform: 'Shopee Indonesia', link: '', imageLink: '', estimatedPrice: 0, weight: '0.2', qty: 1, notes: '' }
  ]);

  const [paymentType, setPaymentType] = useState<'FULL' | 'SPLIT'>('FULL');
  const [paymentMethod, setPaymentMethod] = useState('');
  
  const [formData, setFormData] = useState({
    receiverName: defaultReceiver ? (user?.displayName || '') : '',
    receiverPhone: defaultReceiver ? (user?.phone || '') : '',
    receiverZip: defaultReceiver?.zip || '',
    receiverAddress: defaultReceiver?.detail || ''
  });

  // Persist draft to Local Storage
  useEffect(() => {
    const savedDraft = localStorage.getItem(STORAGE_KEY);
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        if (parsed.cart) setCart(parsed.cart);
        if (parsed.customRequests) setCustomRequests(parsed.customRequests);
        if (parsed.targetCountry) setTargetCountry(parsed.targetCountry);
        if (parsed.paymentType) setPaymentType(parsed.paymentType);
      } catch (err) {
        console.error("Failed to parse draft from storage", err);
      }
    }
  }, []);

  useEffect(() => {
    const draft = {
      cart,
      customRequests,
      targetCountry,
      paymentType
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [cart, customRequests, targetCountry, paymentType]);

  // Kategori list dari hook (sudah ter-cache dan lazy load)
  const categories = useMemo(() => ['Semua', ...productCategories], [productCategories]);

  // Sinkronisasi state filter lokal → hook useProducts
  const handleCategoryChange = useCallback((cat: string) => {
    setSelectedCategory(cat);
    setSearchQuery('');          // reset search saat ganti kategori
    setProductSearch('');
    if (cat === 'Semua') {
      resetProductFilters();
    } else {
      setProductCategory(cat);
    }
  }, [setProductCategory, resetProductFilters, setProductSearch]);

  const handleSearchChange = useCallback((q: string) => {
    setSearchQuery(q);
    setProductSearch(q);
    if (q.trim().length > 0) {
      // saat search aktif, tampilkan semua kategori di state lokal
      setSelectedCategory('Semua');
    }
  }, [setProductSearch]);

  // products dari hook sudah filtered sesuai mode (browse/category/search)
  // tidak perlu filter manual lagi
  const filteredProducts = products;

  const updateCart = (id: string, delta: number) => {
    setCart(prev => {
      const newQty = (prev[id] || 0) + delta;
      if (newQty <= 0) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: newQty };
    });
  };

  const addRequest = () => {
    setCustomRequests([
      ...customRequests,
      { id: `req_${Date.now()}`, name: '', platform: 'Shopee Indonesia', link: '', imageLink: '', estimatedPrice: 0, weight: '0.2', qty: 1, notes: '' }
    ]);
  };

  const updateRequest = (id: string, field: keyof CustomRequest, value: any) => {
    setCustomRequests(prev => prev.map(req => {
      if (req.id === id) {
        if (field === 'weight') {
          if (/^[0-9]*[.,]?[0-9]*$/.test(value) || value === '') {
            return { ...req, weight: value };
          }
          return req;
        }
        return { ...req, [field]: value };
      }
      return req;
    }));
  };

  const removeRequest = (id: string) => {
    if (customRequests.length > 1) {
      setCustomRequests(customRequests.filter(req => req.id !== id));
    } else {
      setCustomRequests([{ id: 'req_1', name: '', platform: 'Shopee Indonesia', link: '', imageLink: '', estimatedPrice: 0, weight: '0.2', qty: 1, notes: '' }]);
    }
  };

  const validRequests = useMemo(() => 
    customRequests.filter(req => req.name.trim().length > 0 && req.estimatedPrice > 0),
  [customRequests]);

  const cartItemCount = (Object.values(cart) as number[]).reduce((a, b) => a + b, 0) + validRequests.reduce((a, b) => a + b.qty, 0);

  const totals = useMemo(() => {
    let totalPrice = 0;
    let totalRawWeight = 0;

    (Object.entries(cart) as [string, number][]).forEach(([id, qty]) => {
      const p = products.find(product => product.id === id);
      if (p) {
        totalPrice += p.price * qty;
        totalRawWeight += p.weight * qty;
      }
    });
    
    validRequests.forEach(req => {
      totalPrice += req.estimatedPrice * req.qty;
      const parsedWeight = parseFloat(req.weight.replace(',', '.')) || 0;
      totalRawWeight += parsedWeight * req.qty;
    });

    const serviceFee = totalPrice * paymentConfig.serviceFee;
    const roundedWeight = Math.max(0.5, Math.ceil(totalRawWeight * 2) / 2);
    const countryRate = shippingRates.find(r => r.countryName === targetCountry);
    const baseRate = countryRate?.baseRate || 0;
    const perKgRate = countryRate?.perKgRate || 100000;
    const shipping = baseRate + (roundedWeight * perKgRate);
    const admin = paymentConfig.adminFee;
    
    // Potongan Voucher
    let discount = 0;
    if (selectedVoucherCode) {
      const vData = availableVouchers.find(v => v.code === selectedVoucherCode);
      if (vData) {
        if (vData.discountType === 'PERCENTAGE') {
          discount = (shipping * vData.discountValue) / 100;
        } else {
          discount = vData.discountValue;
        }
      }
    }
    
    const grandTotal = Math.max(0, totalPrice + serviceFee + shipping + admin - discount);

    return { 
      price: totalPrice, 
      serviceFee,
      actualWeight: totalRawWeight, 
      billableWeight: roundedWeight, 
      shipping, 
      admin, 
      discount,
      grandTotal 
    };
  }, [cart, validRequests, targetCountry, selectedVoucherCode, availableVouchers, products, paymentConfig, shippingRates]);

  // ─── Validasi Batas Transaksi ─────────────────────────────────────────────
  const minTx = paymentConfig.minTransaction || 0;
  const maxTx = paymentConfig.maxTransaction || Infinity;
  const isBelowMin = minTx > 0 && totals.grandTotal > 0 && totals.grandTotal < minTx;
  const isAboveMax = maxTx < Infinity && totals.grandTotal > maxTx;
  const isNearMax = maxTx < Infinity && totals.grandTotal > 0 && totals.grandTotal >= maxTx * 0.8 && !isAboveMax;
  const progressPct = maxTx < Infinity && maxTx > 0 ? Math.min(100, (totals.grandTotal / maxTx) * 100) : 0;
  const showCustomsDutyInfo = maxTx < Infinity && totals.price > maxTx / 2;

  const txStatusColor = isBelowMin
    ? 'text-red-400'
    : isAboveMax
    ? 'text-amber-400'
    : totals.grandTotal > 0
    ? 'text-emerald-400'
    : 'text-emerald-400';

  const stepsInfo = [
    { label: 'Proses', icon: 'fa-info-circle' },
    { label: 'Pilih', icon: 'fa-shopping-basket' },
    { label: 'Invoice', icon: 'fa-file-invoice-dollar' },
    { label: 'Alamat', icon: 'fa-map-location-dot' },
    { label: 'Bayar', icon: 'fa-credit-card' },
    { label: 'Konfirmasi', icon: 'fa-check-double' },
    { label: 'Selesai', icon: 'fa-paper-plane' }
  ];

  const nextStep = () => setStep(step + 1);
  const prevStep = () => setStep(step - 1);

  const handleFinalSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const catalogItemsText = (Object.entries(cart) as [string, number][]).map(([id, qty]) => {
      const p = products.find(product => product.id === id);
      return `- ${p?.name} (${qty}x)`;
    }).join('\n');

    const requestItemsText = validRequests.map((req, i) => 
      `Request #${i+1}:\n- Nama: ${req.name}\n- Qty: ${req.qty}\n- Platform: ${req.platform}\n- Link: ${req.link || '-'}\n- Harga: Rp ${req.estimatedPrice.toLocaleString()}\n- Berat Satuan: ${req.weight}kg`
    ).join('\n\n');

    const message = `Halo Admin JastipTKI, saya ingin BELI TITIPAN:

*--- ITEM KATALOG ---*
${catalogItemsText || '-'}

*--- REQUEST KHUSUS ---*
${requestItemsText || '-'}

*--- DATA PENERIMA ---*
Nama: ${formData.receiverName}
Negara: ${targetCountry}
Alamat: ${formData.receiverAddress}
WA: ${formData.receiverPhone}

*--- RINCIAN BIAYA ---*
Harga Barang: Rp ${totals.price.toLocaleString()}
Jasa Belanja (${(paymentConfig.serviceFee * 100).toFixed(0)}%): Rp ${totals.serviceFee.toLocaleString()}
Berat Billable: ${totals.billableWeight.toFixed(2)} KG
Ongkir Int'l: Rp ${totals.shipping.toLocaleString()}
Voucher: ${selectedVoucherCode || 'Tidak ada'} ${totals.discount > 0 ? `(-Rp ${totals.discount.toLocaleString()})` : ''}
*GRAND TOTAL: Rp ${totals.grandTotal.toLocaleString()}*
*Tipe Bayar:* ${paymentType === 'FULL' ? 'Lunas (100%)' : 'DP Barang (60%)'}
*Metode:* ${paymentMethod}

Mohon diproses Admin!`;

    try {
      // Sanitasi: Firestore MENOLAK nilai undefined, NaN, atau Infinity
      const safeName = (v: any) => (typeof v === 'string' && v.trim() ? v.trim() : '');
      const safeNum = (v: any) => (typeof v === 'number' && isFinite(v) ? v : 0);
      const safeStr = (v: any) => (v != null ? String(v) : '');

      const orderData = {
        type: 'BELANJA',
        destination: safeStr(targetCountry),
        amount: safeNum(totals.grandTotal),
        shippingCost: safeNum(totals.shipping),
        serviceFee: safeNum(totals.admin + totals.serviceFee - totals.discount),
        weight: safeNum(totals.billableWeight),
        actualWeight: safeNum(totals.actualWeight),
        ...(isAboveMax ? { requiresAdminConfirmation: true } : {}),
        details: {
          receiver: { 
            name: safeName(formData.receiverName), 
            address: safeName(formData.receiverAddress), 
            country: safeStr(targetCountry), 
            phone: safeName(formData.receiverPhone) 
          },
          catalogItems: Object.entries(cart).map(([id, qty]) => ({
            id: safeStr(id),
            qty: safeNum(qty as number),
            name: safeName(products.find(p => p.id === id)?.name) || id
          })),
          customRequests: validRequests.map(req => ({
            id: safeStr(req.id),
            name: safeName(req.name),
            platform: safeName(req.platform),
            link: safeStr(req.link),
            imageLink: safeStr(req.imageLink),
            estimatedPrice: safeNum(req.estimatedPrice),
            weight: safeStr(req.weight),
            qty: safeNum(req.qty),
            notes: safeStr(req.notes)
          })),
          paymentType: safeStr(paymentType),
          paymentMethod: safeStr(paymentMethod),
          voucherUsed: selectedVoucherCode || null,
          voucherDiscount: safeNum(totals.discount)
        }
      };

      await onComplete(orderData);
      localStorage.removeItem(STORAGE_KEY);
      
      const waUrl = `https://wa.me/${adminWhatsApp}?text=${encodeURIComponent(message)}`;
      setWaMessageUrl(waUrl);
      setStep(6);
    } catch (error) {
      console.error("Gagal mengirim pesanan:", error);
      alert("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openWhatsAppDirectly = () => {
    onClose();
    window.location.href = waMessageUrl;
  };

  if (loadingRates) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-900/60 backdrop-blur-md lg:p-4 overflow-hidden animate-fade-in">
      <div className="absolute inset-0 hidden lg:block" onClick={step < 6 ? onClose : undefined}></div>
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl mx-auto h-full lg:h-auto lg:max-h-[95vh] lg:rounded-[3rem] shadow-soft-xl relative z-10 flex flex-col overflow-hidden animate-fade-in-up">
        
        {step < 6 && (
          <div className="px-4 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 z-[60]">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-3">
                 <button onClick={step === 0 ? onClose : prevStep} className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-emerald-600 hover:text-white transition-all shadow-sm active:scale-90">
                   <i className={`fas ${step === 0 ? 'fa-times' : 'fa-arrow-left'} text-xs`}></i>
                 </button>
                 <div>
                   <h2 className="text-sm font-black text-slate-900 dark:text-white tracking-tight leading-tight">Beli Titipan</h2>
                   <p className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.2em]">{stepsInfo[step].label}</p>
                 </div>
              </div>
              {(step === 1 || step === 2) && (
                <button onClick={() => setStep(2)} className={`relative w-9 h-9 flex items-center justify-center rounded-xl transition-all shadow-md active:scale-90 ${step === 2 ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white'}`}>
                  <i className="fas fa-shopping-cart text-sm"></i>
                  {cartItemCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 border-2 border-white dark:border-slate-900 text-white text-[9px] font-black rounded-full flex items-center justify-center animate-bounce">{cartItemCount}</span>}
                </button>
              )}
            </div>
            <div className="hidden lg:flex justify-between items-center relative px-2 mb-1">
              <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 dark:bg-slate-800 -translate-y-1/2 -z-10"></div>
              <div className="absolute top-1/2 left-0 h-0.5 bg-emerald-600 -translate-y-1/2 -z-10 transition-all duration-700" style={{ width: `${(step / (stepsInfo.length - 2)) * 100}%` }}></div>
              {stepsInfo.slice(0, 6).map((s, i) => (
                <div key={i} className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] transition-all duration-500 border-2 border-white dark:border-slate-900 shadow-sm ${step >= i ? 'bg-emerald-600 text-white scale-110' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'}`} />
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-3 scrollbar-hide">
          {step === 0 && (
            <div className="animate-fade-in-up space-y-8 py-2 text-center">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Belanja Dari Mana Saja</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium max-w-sm mx-auto">Kami belanjakan produk impian Anda di marketplace Indonesia.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                {[
                  { icon: 'fa-magnifying-glass', color: 'bg-emerald-600', label: '1. Cari & Pilih', desc: 'Pilih dari katalog atau request produk marketplace.' },
                  { icon: 'fa-cart-shopping', color: 'bg-blue-600', label: '2. Kami Belanjakan', desc: 'Tim JastipTKI membeli barang Anda, memastikan kualitas.' },
                  { icon: 'fa-box', color: 'bg-indigo-600', label: '3. Konsolidasi', desc: 'Semua belanjaan dikumpulkan di Hub Cianjur.' },
                  { icon: 'fa-plane-arrival', color: 'bg-amber-600', label: '4. Sampai Tujuan', desc: 'Barang diterbangkan dan diantar kurir lokal.' },
                ].map((item, i) => (
                  <div key={i} className="p-5 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-soft dark:shadow-none">
                    <div className={`w-10 h-10 ${item.color} text-white rounded-xl flex items-center justify-center text-sm mb-3 shadow-lg`}><i className={`fas ${item.icon}`} /></div>
                    <h4 className="font-black text-slate-900 dark:text-white text-xs mb-1">{item.label}</h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-bold italic">"{item.desc}"</p>
                  </div>
                ))}
              </div>
              <button onClick={nextStep} className="w-full mt-6 py-4 bg-emerald-600 text-white rounded-2xl font-black text-base shadow-xl active:scale-95 transition-all">Mulai Belanja <i className="fas fa-arrow-right ml-2 text-sm" /></button>
            </div>
          )}

          {step === 1 && (
            <div className="animate-fade-in-up">
              <div className="sticky -top-4 bg-white dark:bg-slate-900 pb-2 z-50 pt-1">
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 mb-2">
                  <button onClick={() => setActiveTab('KATALOG')} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'KATALOG' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-400'}`}>Katalog</button>
                  <button onClick={() => setActiveTab('REQUEST')} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'REQUEST' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-400'}`}>Request</button>
                </div>
                
                {activeTab === 'KATALOG' && (
                  <div className="space-y-2">
                    <div className="relative">
                      <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]" />
                      <input type="text" placeholder="Cari di katalog..." value={searchQuery} onChange={e => handleSearchChange(e.target.value)} className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl font-bold text-xs outline-none focus:border-emerald-500 shadow-sm" />
                    </div>
                    
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
                      {categories.map(cat => (
                        <button 
                          key={cat} 
                          onClick={() => handleCategoryChange(cat)}
                          className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest whitespace-nowrap border-2 transition-all ${selectedCategory === cat ? 'bg-emerald-600 border-emerald-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500'}`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {activeTab === 'KATALOG' ? (
                <div className="pt-2">
                  {loadingProducts ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-40">
                      <i className="fas fa-circle-notch animate-spin text-4xl text-emerald-600"></i>
                      <p className="text-[10px] font-black uppercase tracking-widest">Memuat Katalog...</p>
                    </div>
                  ) : productError ? (
                    <div className="text-center py-20 bg-red-50 dark:bg-red-900/10 rounded-3xl border border-red-100 dark:border-red-900/20">
                      <i className="fas fa-exclamation-triangle text-3xl text-red-500 mb-3"></i>
                      <p className="text-[10px] font-black uppercase text-red-600 tracking-widest">{productError}</p>
                    </div>
                  ) : filteredProducts.length > 0 ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        {filteredProducts.map(product => (
                        <div key={product.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800 p-2.5 flex flex-col group transition-all hover:border-emerald-400 shadow-soft dark:shadow-none">
                          <div className="aspect-square rounded-xl overflow-hidden mb-2 bg-slate-100 dark:bg-slate-900 relative">
                            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-all duration-500" />
                            <span className="absolute top-2 left-2 px-2 py-0.5 bg-white/90 backdrop-blur-sm rounded-lg text-[8px] font-black text-slate-900 uppercase">{product.category}</span>
                          </div>
                          {/* Nama produk dengan tooltip jika panjang */}
                          <div className="relative mb-1 group/name">
                            <h4 className="font-bold text-slate-900 dark:text-white text-[10px] leading-tight truncate cursor-default">
                              {product.name}
                            </h4>
                            {/* Tooltip muncul saat hover — hanya jika nama > 20 karakter */}
                            {product.name.length > 20 && (
                              <div className="absolute bottom-full left-0 mb-1.5 z-50 hidden group-hover/name:block">
                                <div className="bg-slate-900 dark:bg-slate-700 text-white text-[10px] font-bold px-3 py-2 rounded-xl shadow-2xl whitespace-normal max-w-[180px] leading-snug border border-slate-700 dark:border-slate-600">
                                  {product.name}
                                  <div className="absolute top-full left-3 w-2 h-2 bg-slate-900 dark:bg-slate-700 rotate-45 -mt-1 border-r border-b border-slate-700 dark:border-slate-600"></div>
                                </div>
                              </div>
                            )}
                          </div>
                          <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">Rp {product.price.toLocaleString()}</p>
                          <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 mb-2 flex items-center gap-1">
                            <i className="fas fa-weight-hanging text-[8px]"></i>{product.weight} kg
                          </p>
                          {cart[product.id] ? (
                            <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/30 rounded-lg p-1">
                              <button onClick={() => updateCart(product.id, -1)} className="w-6 h-6 flex items-center justify-center bg-white dark:bg-slate-800 rounded-md text-emerald-600 shadow-sm"><i className="fas fa-minus text-[8px]" /></button>
                              <span className="font-black text-emerald-600 dark:text-emerald-400 text-[10px]">{cart[product.id]}</span>
                              <button onClick={() => updateCart(product.id, 1)} className="w-6 h-6 flex items-center justify-center bg-emerald-600 rounded-md text-white shadow-sm"><i className="fas fa-plus text-[8px]" /></button>
                            </div>
                          ) : (
                            <button onClick={() => updateCart(product.id, 1)} className="w-full py-2 bg-slate-900 dark:bg-slate-700 text-white rounded-lg font-bold text-[10px] hover:bg-emerald-600 transition-all">Tambah</button>
                          )}
                        </div>
                      ))}
                    </div>
                    {/* Tombol Muat Lebih — Lazy Load dari Firestore (hanya di mode browse) */}
                    {hasMoreProducts && productMode === 'browse' && (
                      <button
                        onClick={loadMore}
                        disabled={loadingMore}
                        className="w-full py-3 mt-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-bold text-xs hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {loadingMore ? (
                          <><i className="fas fa-circle-notch animate-spin"></i> Memuat...</>
                        ) : (
                          <><i className="fas fa-chevron-down"></i> Muat 30 Produk Lagi</>
                        )}
                      </button>
                    )}
                  </div>
                  ) : (
                    <div className="text-center py-20 opacity-40">
                      <i className="fas fa-search-minus text-4xl mb-4 text-slate-300"></i>
                      <p className="text-[10px] font-black uppercase tracking-widest">Produk tidak ditemukan</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6 pt-2 pb-10">
                  {customRequests.map((req, idx) => (
                    <div key={req.id} className="p-6 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 relative shadow-soft dark:shadow-none animate-fade-in-up">
                      <div className="flex justify-between items-center mb-6">
                        <span className="bg-emerald-600 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-md">Pesanan Khusus #{idx+1}</span>
                        {customRequests.length > 1 && (
                          <button onClick={() => removeRequest(req.id)} className="w-8 h-8 flex items-center justify-center bg-red-50 dark:bg-red-900/30 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-all">
                            <i className="fas fa-trash-alt text-[10px]" />
                          </button>
                        )}
                      </div>
                      
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Nama Barang</label>
                          <input type="text" value={req.name} onChange={e => updateRequest(req.id, 'name', e.target.value)} className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl font-bold text-[11px] outline-none shadow-sm focus:border-emerald-500 dark:text-white" placeholder="Misal: Jaket Batik Khas Solo" />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Marketplace / Toko</label>
                            <select value={req.platform} onChange={e => updateRequest(req.id, 'platform', e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl font-bold text-[10px] outline-none shadow-sm dark:text-white">
                              <option>Shopee Indonesia</option>
                              <option>Tokopedia</option>
                              <option>TikTok Shop</option>
                              <option>Lazada</option>
                              <option>Toko Offline / Lainnya</option>
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Est. Harga Satuan (Rp)</label>
                            <input type="number" value={req.estimatedPrice || ''} onChange={e => updateRequest(req.id, 'estimatedPrice', parseInt(e.target.value) || 0)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl font-black text-[11px] text-emerald-600 outline-none shadow-sm" placeholder="Contoh: 150000" />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Jumlah (Qty)</label>
                            <input type="number" value={req.qty} onChange={e => updateRequest(req.id, 'qty', parseInt(e.target.value) || 1)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl font-bold text-[11px] outline-none shadow-sm dark:text-white" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Berat Satuan (KG)</label>
                            <input type="text" inputMode="decimal" value={req.weight} onChange={e => updateRequest(req.id, 'weight', e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl font-bold text-[11px] outline-none shadow-sm dark:text-white" placeholder="0.2" />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                            {req.platform === 'Toko Offline / Lainnya' ? 'Link Gambar (Optional)' : 'Link Produk (URL)'}
                          </label>
                          <div className="relative">
                            <i className={`fas ${req.platform === 'Toko Offline / Lainnya' ? 'fa-image' : 'fa-link'} absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]`} />
                            <input 
                              type="text" 
                              value={req.link} 
                              onChange={e => updateRequest(req.id, 'link', e.target.value)} 
                              className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl font-bold text-[10px] outline-none shadow-sm dark:text-white" 
                              placeholder={req.platform === 'Toko Offline / Lainnya' ? 'https://link-gambar.com/foto.jpg' : 'https://shopee.co.id/produk-anda...'} 
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Catatan Tambahan (Varian, Warna, Size)</label>
                          <textarea value={req.notes} onChange={e => updateRequest(req.id, 'notes', e.target.value)} className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl font-bold text-[10px] outline-none shadow-sm h-20 resize-none dark:text-white" placeholder="Contoh: Warna merah, ukuran L..."></textarea>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button onClick={addRequest} className="w-full py-5 border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 rounded-[2.5rem] font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 shadow-sm">
                    <i className="fas fa-plus-circle text-lg" /> Tambah Item Request Baru
                  </button>
                </div>
              )}
            </div>
          )}
          {step === 2 && (
            <div className="animate-fade-in-up space-y-6">
              <div className="bg-emerald-600 rounded-3xl p-6 text-white relative overflow-hidden shadow-soft-xl">
                <h3 className="text-xl font-black mb-1 relative z-10">Review & Biaya</h3>
                <p className="text-emerald-100 text-[10px] font-medium relative z-10">Pilih negara untuk melihat estimasi ongkir akurat.</p>
                <i className="fas fa-file-invoice-dollar absolute -bottom-6 -right-6 text-white/10 text-8xl" />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Negara Tujuan</label>
                <div className="relative">
                  <select 
                    value={targetCountry} 
                    onChange={e => setTargetCountry(e.target.value)} 
                    className="w-full px-6 py-4 bg-white dark:bg-slate-800 border-2 border-emerald-500 rounded-2xl font-black text-slate-900 dark:text-white shadow-soft outline-none appearance-none"
                  >
                    {shippingRates.map(r => (
                      <option key={r.countryCode} value={r.countryName}>{r.countryName} (Rp {r.perKgRate.toLocaleString()}/kg)</option>
                    ))}
                  </select>
                  <i className="fas fa-chevron-down absolute right-6 top-1/2 -translate-y-1/2 text-emerald-600 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-3">
                {(Object.entries(cart) as [string, number][]).map(([id, qty]) => {
                  const p = products.find(product => product.id === id);
                  return p && (
                    <div key={id} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-soft dark:shadow-none">
                      <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0"><img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" /></div>
                      <div className="flex-1 min-w-0"><h5 className="font-bold text-slate-900 dark:text-white text-[10px] truncate">{p.name}</h5><p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase mt-0.5">{qty} Item • Total {(p.weight * qty).toFixed(2)} KG</p></div>
                      <span className="font-black text-slate-900 dark:text-white text-xs">Rp {(p.price * qty).toLocaleString()}</span>
                    </div>
                  );
                })}
                {validRequests.map(req => (
                  <div key={req.id} className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 border-dashed flex items-center gap-3">
                    <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-lg flex items-center justify-center text-blue-600 text-lg shrink-0 shadow-sm"><i className="fas fa-hand-holding-heart" /></div>
                    <div className="flex-1 min-w-0"><h5 className="font-bold text-blue-900 dark:text-blue-300 text-[10px] truncate">{req.name}</h5><p className="text-[9px] text-blue-400 font-bold uppercase mt-0.5">{req.platform} • {req.qty}x • Total {(parseFloat(req.weight.replace(',', '.')) * req.qty).toFixed(2)}kg</p></div>
                    <span className="font-black text-blue-900 dark:text-blue-300 text-xs">Rp {(req.estimatedPrice * req.qty).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              
              <div className="bg-slate-900 dark:bg-slate-800 rounded-[2rem] p-6 text-white shadow-xl space-y-4">
                 <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest opacity-60">
                    <span>Rincian Invoice</span>
                    <span>Biaya (IDR)</span>
                 </div>
                 <div className="space-y-2 border-t border-white/10 pt-4">
                    <div className="flex justify-between items-center text-xs">
                       <span className="opacity-60">Total Harga Barang:</span>
                       <span className="font-bold">Rp {totals.price.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                       <span className="opacity-60 text-emerald-400">Jasa Belanja ({(paymentConfig.serviceFee * 100).toFixed(0)}%):</span>
                       <span className="font-bold text-emerald-400">Rp {totals.serviceFee.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                       <span className="opacity-60">Ongkir ({totals.billableWeight.toFixed(2)} KG):</span>
                       <span className="font-bold">Rp {totals.shipping.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs pb-2">
                       <span className="opacity-60">Biaya Pengurusan:</span>
                       <span className="font-bold">Rp {totals.admin.toLocaleString()}</span>
                    </div>
                 </div>
                 <div className="flex justify-between items-end border-t border-white/10 pt-4">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Total Pembayaran</p>
                      <p className={`text-3xl font-black ${txStatusColor}`}>Rp {totals.grandTotal.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                       <span className="block text-[8px] font-bold opacity-40 uppercase tracking-widest">Tujuan: {targetCountry}</span>
                       <span className="text-[10px] font-bold text-blue-400">Berat Asli: {totals.actualWeight.toFixed(2)} kg</span>
                    </div>
                 </div>
                 {/* Indikator batas transaksi */}
                 {(minTx > 0 || maxTx < Infinity) && totals.grandTotal > 0 && (
                   <div className="flex justify-between items-center text-[9px] font-bold border-t border-white/10 pt-3">
                     <span className="text-slate-500">
                       {minTx > 0 && `Min: Rp ${minTx.toLocaleString('id-ID')}`}
                       {minTx > 0 && maxTx < Infinity && ' | '}
                       {maxTx < Infinity && `Maks: Rp ${maxTx.toLocaleString('id-ID')}`}
                     </span>
                     <span className={txStatusColor}>
                       {isBelowMin ? '✗ Di bawah minimum' : isAboveMax ? '⚠ Perlu konfirmasi' : '✓ Dalam batas'}
                     </span>
                   </div>
                 )}
                 {/* Progress bar mendekati maks */}
                 {isNearMax && maxTx < Infinity && (
                   <div className="space-y-1.5 border-t border-white/10 pt-3">
                     <div className="flex justify-between text-[9px] font-black text-amber-400">
                       <span>Mendekati batas maksimum</span>
                       <span>Rp {totals.grandTotal.toLocaleString()} / Rp {maxTx.toLocaleString()}</span>
                     </div>
                     <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                       <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }}></div>
                     </div>
                   </div>
                 )}
              </div>

              {/* Error: di bawah minimum */}
              {isBelowMin && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex gap-3 items-start">
                  <i className="fas fa-times-circle text-red-400 mt-0.5 shrink-0"></i>
                  <div>
                    <p className="text-xs font-black text-red-400">Total order minimum Rp {minTx.toLocaleString('id-ID')}</p>
                    <p className="text-[10px] text-red-300/70 mt-0.5">Total Anda saat ini Rp {totals.grandTotal.toLocaleString('id-ID')}. Tambahkan item untuk melanjutkan.</p>
                  </div>
                </div>
              )}

              {/* Warning: di atas maksimum */}
              {isAboveMax && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex gap-3 items-start">
                  <i className="fas fa-triangle-exclamation text-amber-400 mt-0.5 shrink-0"></i>
                  <div>
                    <p className="text-xs font-black text-amber-400">Total order Rp {totals.grandTotal.toLocaleString('id-ID')} melebihi batas normal Rp {maxTx.toLocaleString('id-ID')}</p>
                    <p className="text-[10px] text-amber-300/70 mt-0.5">Admin akan menghubungi Anda untuk konfirmasi tambahan sebelum pesanan diproses.</p>
                  </div>
                </div>
              )}

              {/* Info bea cukai khusus Beli Titipan */}
              {showCustomsDutyInfo && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex gap-3 items-start">
                  <i className="fas fa-circle-info text-blue-400 mt-0.5 shrink-0"></i>
                  <div>
                    <p className="text-xs font-black text-blue-400">Potensi Bea Cukai</p>
                    <p className="text-[10px] text-blue-300/70 mt-0.5">Nilai barang yang tinggi mungkin dikenakan bea cukai. Estimasi bea cukai akan dihitung saat konfirmasi dengan admin.</p>
                  </div>
                </div>
              )}

              <button
                onClick={nextStep}
                disabled={isBelowMin}
                className={`w-full py-5 rounded-[1.5rem] font-black text-base shadow-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
                  isAboveMax ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'
                }`}
              >
                {isAboveMax && <i className="fas fa-triangle-exclamation text-sm"></i>}
                {isAboveMax ? 'Lanjut — Perlu Konfirmasi' : 'Lanjut ke Data Penerima'}
              </button>
            </div>
          )}
          {step === 3 && (
            <div className="animate-fade-in-up space-y-6">
              <div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-soft-xl">
                <div className="relative z-10">
                  <h3 className="text-2xl font-black mb-1">Data Penerima</h3>
                  <p className="text-indigo-100 text-[10px] font-medium">Lengkapi detail alamat pengiriman di {targetCountry}.</p>
                </div>
                <i className="fas fa-truck-fast absolute -bottom-10 -right-10 text-white/10 text-[12rem] -rotate-12"></i>
              </div>
              
              <div className="grid gap-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Nama Lengkap Penerima</label>
                  <input type="text" value={formData.receiverName} onChange={e => setFormData({...formData, receiverName: e.target.value})} className="w-full px-6 py-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl font-bold text-sm text-slate-900 dark:text-white shadow-soft outline-none focus:border-indigo-500" placeholder="Contoh: Budi Santoso" />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div className="space-y-1.5 opacity-60">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Negara (Sesuai Invoice)</label>
                    <div className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl font-black text-xs text-slate-500">{targetCountry}</div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Kode Pos (Zip Code)</label>
                    <input type="text" value={formData.receiverZip} onChange={e => setFormData({...formData, receiverZip: e.target.value})} className="w-full px-6 py-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl font-bold text-sm text-slate-900 dark:text-white shadow-soft outline-none focus:border-indigo-500" placeholder="Contoh: 123-4567" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">No. WhatsApp Aktif</label>
                  <input type="tel" value={formData.receiverPhone} onChange={e => setFormData({...formData, receiverPhone: e.target.value})} className="w-full px-6 py-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl font-bold text-sm text-slate-900 dark:text-white shadow-soft outline-none focus:border-indigo-500" placeholder="+81 / +886..." />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Alamat Lengkap Tujuan</label>
                  <textarea value={formData.receiverAddress} onChange={e => setFormData({...formData, receiverAddress: e.target.value})} className="w-full px-6 py-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl font-bold text-sm outline-none h-32 resize-none shadow-soft focus:border-indigo-500 dark:text-white" placeholder="Sebutkan Prefektur, Kota, Gedung..."></textarea>
                </div>
              </div>
              
              <button onClick={nextStep} disabled={!formData.receiverName || !formData.receiverAddress} className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-lg shadow-xl active:scale-95 transition-all disabled:opacity-50">Lanjut ke Pembayaran <i className="fas fa-arrow-right ml-2 text-sm"></i></button>
            </div>
          )}
          {step === 4 && (
            <div className="animate-fade-in-up space-y-10">
              <div className="text-center space-y-3">
                <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Metode Pembayaran</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Pilih channel pembayaran & voucher Anda.</p>
              </div>

              {/* Kartu Voucher Dropdown */}
              <div className="relative">
                <button 
                  onClick={() => setIsVoucherDropdownOpen(!isVoucherDropdownOpen)}
                  className={`w-full p-6 rounded-3xl border-2 text-left transition-all flex items-center justify-between group ${selectedVoucherCode ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900'}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${selectedVoucherCode ? 'bg-emerald-600 text-white shadow-lg' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600'}`}>
                      <i className="fas fa-ticket-alt"></i>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Voucher Promo</p>
                      <p className={`font-black text-sm ${selectedVoucherCode ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                        {selectedVoucherCode ? availableVouchers.find(v => v.code === selectedVoucherCode)?.title || selectedVoucherCode : 'Pilih Voucher Promo'}
                      </p>
                      {user.activeClaimedVoucher && user.claimStatus === 'claimed' && selectedVoucherCode !== user.activeClaimedVoucher && (
                        <p className="text-[9px] font-bold text-amber-500 mt-0.5">
                          <i className="fas fa-triangle-exclamation mr-1"></i>
                          Voucher klaim akan hangus jika tidak dipakai
                        </p>
                      )}
                    </div>
                  </div>
                  <i className={`fas fa-chevron-down text-xs transition-transform ${isVoucherDropdownOpen ? 'rotate-180' : ''} ${selectedVoucherCode ? 'text-emerald-600' : 'text-slate-400'}`}></i>
                </button>

                {isVoucherDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-2xl z-50 overflow-hidden animate-fade-in-up">
                    <div className="p-2 space-y-1">
                      <button 
                        onClick={() => { setSelectedVoucherCode(null); setIsVoucherDropdownOpen(false); }}
                        className={`w-full p-4 rounded-2xl text-left transition-all flex items-center justify-between ${!selectedVoucherCode ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                      >
                        <span className="text-xs font-bold text-slate-400">Tidak Menggunakan Voucher</span>
                        {!selectedVoucherCode && <i className="fas fa-check-circle text-slate-400 text-xs"></i>}
                      </button>
                      {availableVouchers.length > 0 ? availableVouchers.map((v) => (
                        <button 
                          key={v.code}
                          onClick={() => { setSelectedVoucherCode(v.code); setIsVoucherDropdownOpen(false); }}
                          className={`w-full p-5 rounded-2xl text-left transition-all border-2 flex items-center justify-between ${selectedVoucherCode === v.code ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-black text-slate-900 dark:text-white text-sm">{v.title}</p>
                              {((user.voucherCollection || []).includes(v.code) || (user.activeClaimedVoucher === v.code && user.claimStatus === 'claimed')) && (
                                <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-500 text-[8px] font-black rounded-full uppercase tracking-widest">Koleksi</span>
                              )}
                            </div>
                            <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">
                              Potongan {v.discountType === 'PERCENTAGE' ? `${v.discountValue}%` : `Rp ${v.discountValue.toLocaleString()}`}
                            </p>
                            <p className="text-[7px] font-black uppercase tracking-widest opacity-40 mt-0.5">KODE: {v.code}</p>
                          </div>
                          {selectedVoucherCode === v.code && <i className="fas fa-check-circle text-emerald-600"></i>}
                        </button>
                      )) : (
                        <div className="p-6 text-center">
                          <i className="fas fa-ticket-alt text-3xl mb-3 text-slate-300 dark:text-slate-600"></i>
                          <p className="text-xs font-black text-slate-500 dark:text-slate-400 mb-1">Belum Ada Voucher Diklaim</p>
                          <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 leading-relaxed">Klaim voucher di halaman Beranda terlebih dahulu untuk mendapatkan diskon</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4">
                <button onClick={() => setPaymentType('FULL')} className={`p-8 rounded-[2.5rem] border-2 text-left transition-all shadow-soft group ${paymentType === 'FULL' ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-50 dark:border-slate-800 bg-white dark:bg-slate-900'}`}>
                  <div className="flex justify-between items-start mb-4">
                     <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 rounded-2xl flex items-center justify-center text-xl shadow-inner"><i className="fas fa-money-bill-wave"></i></div>
                     {paymentType === 'FULL' && <div className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-[10px] animate-bounce"><i className="fas fa-check"></i></div>}
                  </div>
                  <h4 className="text-xl font-black text-slate-900 dark:text-white mb-1">Bayar Lunas (100%)</h4>
                  <div className="mt-6 pt-6 border-t border-slate-200/50 dark:border-slate-800">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Total Tagihan:</p>
                    <p className="text-2xl font-black text-emerald-600">Rp {totals.grandTotal.toLocaleString()}</p>
                  </div>
                </button>

                <button onClick={() => setPaymentType('SPLIT')} className={`p-8 rounded-[2.5rem] border-2 text-left transition-all shadow-soft group ${paymentType === 'SPLIT' ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-50 dark:border-slate-800 bg-white dark:bg-slate-900'}`}>
                   <div className="flex justify-between items-start mb-4">
                     <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/50 text-blue-600 rounded-2xl flex items-center justify-center text-xl shadow-inner"><i className="fas fa-hand-holding-dollar"></i></div>
                     {paymentType === 'SPLIT' && <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px] animate-bounce"><i className="fas fa-check"></i></div>}
                  </div>
                  <h4 className="text-xl font-black text-slate-900 dark:text-white mb-1">Bayar DP (60%)</h4>
                  <div className="mt-6 flex gap-6 pt-6 border-t border-slate-200/50 dark:border-slate-800">
                    <div>
                      <p className="text-[9px] font-black text-blue-600 uppercase mb-1">DP (60%):</p>
                      <p className="text-xl font-black text-blue-600">Rp {(totals.grandTotal * 0.6).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Sisa Nanti:</p>
                      <p className="text-xl font-black text-slate-400">Rp {(totals.grandTotal * 0.4).toLocaleString()}</p>
                    </div>
                  </div>
                </button>
              </div>

              <div className="space-y-4">
                 <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 text-center">Pilih Channel Bayar</h5>
                 <div className="grid grid-cols-2 gap-3">
                    {[{ id: 'VA', label: 'Transfer Bank', icon: 'fa-university' }, { id: 'QRIS', label: 'QRIS / E-Wallet', icon: 'fa-qrcode' }].map(ch => (
                      <button 
                        key={ch.id} 
                        onClick={() => setPaymentMethod(ch.label)}
                        className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all font-black text-[10px] uppercase tracking-widest ${paymentMethod === ch.label ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg' : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-500'}`}
                      >
                        <i className={`fas ${ch.icon} text-sm opacity-60`}></i>
                        {ch.label}
                      </button>
                    ))}
                 </div>
              </div>

              <button onClick={nextStep} disabled={!paymentMethod} className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-lg shadow-xl active:scale-95 transition-all disabled:opacity-50">Konfirmasi & Simpan Pesanan</button>
            </div>
          )}
          {step === 5 && (
            <div className="animate-fade-in-up flex flex-col items-center text-center py-4">
              <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center text-4xl shadow-2xl mb-8"><i className="fas fa-shopping-bag" /></div>
              <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter mb-2">Belanjaan Siap!</h3>
              
              <div className="w-full bg-slate-900 dark:bg-slate-800 text-white rounded-[2.5rem] p-8 text-left shadow-2xl relative overflow-hidden">
                <div className="relative z-10">
                  <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">Ringkasan Pesanan Belanja</p>
                  <h4 className="font-black text-xl mb-6">{cartItemCount} Barang • Tujuan {targetCountry}</h4>
                  <div className="space-y-3 pt-6 border-t border-white/10">
                     <div className="flex justify-between items-center">
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Berat Tagihan:</span>
                        <span className="text-[10px] font-black text-white">{totals.billableWeight.toFixed(2)} KG</span>
                     </div>
                     <div className="flex justify-between items-center">
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Tagihan Sekarang:</span>
                        <span className="text-2xl font-black text-emerald-400">Rp {(paymentType === 'FULL' ? totals.grandTotal : (totals.grandTotal * 0.6)).toLocaleString()}</span>
                     </div>
                  </div>
                </div>
                <i className="fas fa-shopping-basket absolute -bottom-10 -right-10 text-white/5 text-[10rem]"></i>
              </div>

              <div className="w-full mt-10 flex flex-col gap-3">
                <button 
                  onClick={handleFinalSubmit} 
                  disabled={isSubmitting}
                  className="w-full py-5 bg-emerald-600 text-white rounded-[2.5rem] font-black text-lg shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isSubmitting ? <i className="fas fa-circle-notch animate-spin"></i> : "Kirim Sekarang"}
                </button>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="animate-fade-in-up flex flex-col items-center text-center py-10">
               <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-full flex items-center justify-center text-5xl shadow-2xl mb-8">
                  <i className="fas fa-check-circle"></i>
               </div>
               <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-3">Siap Belanja!</h3>
               <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed max-w-xs mb-10">
                 Pesanan belanja Anda telah tersimpan. Klik tombol di bawah untuk **menghubungi Admin** dan memproses pembelian barang Anda.
               </p>
               
               <div className="w-full space-y-4">
                  <button 
                    onClick={openWhatsAppDirectly}
                    className="w-full py-4 bg-emerald-600 text-white rounded-[2rem] font-black text-base shadow-2xl shadow-emerald-200 dark:shadow-none active:scale-95 transition-all flex items-center justify-center gap-4 animate-bounce"
                  >
                    <i className="fab fa-whatsapp text-2xl"></i> HUBUNGI ADMIN (WA)
                  </button>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BeliTitipanFlow;
