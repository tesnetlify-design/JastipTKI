
import React, { useState, useMemo, useEffect } from 'react';
import { Voucher, UserProfile, Transaction } from '../types';
import * as VoucherEngine from '../voucherEngine';
import { usePaymentConfig } from '../hooks/usePaymentConfig';
import { useShippingRates } from '../hooks/useShippingRates';

interface JastipItem {
  category: string;
  name: string;
  qty: number;
  value: number;
  weight: string;
}

interface KirimJastipFlowProps {
  onClose: () => void;
  onComplete: (data: any) => Promise<void>;
  defaultSender?: any;
  defaultReceiver?: any;
  user: UserProfile;
  appConfig?: any;
  availableVouchers: Voucher[];
  transactions: Transaction[];
}

const CATEGORIES = [
  'Barang Pecah Belah',
  'Bumbu & Makanan',
  'Benda Cair',
  'Barang Lainnya (Campuran)'
];

const KirimJastipFlow: React.FC<KirimJastipFlowProps> = ({ onClose, onComplete, defaultSender, defaultReceiver, user, appConfig, availableVouchers = [], transactions = [] }) => {
  const { paymentConfig } = usePaymentConfig();
  const { rates: shippingRates, loading: loadingRates } = useShippingRates();
  const [step, setStep] = useState(0); 
  const [paymentMethod, setPaymentMethod] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [waMessageUrl, setWaMessageUrl] = useState('');
  
  // State Voucher
  const [isVoucherDropdownOpen, setIsVoucherDropdownOpen] = useState(false);
  const [selectedVoucherCode, setSelectedVoucherCode] = useState<string | null>((user.voucherCollection || [])[0] || user.activeClaimedVoucher || null);

  // Fallback Hub Address
  const HUB_ADDRESS = {
    name: appConfig?.hubName || "JastipTKI Hub Cianjur (Bp. Ahmad)",
    phone: appConfig?.hubPhone || "081299887766",
    address: appConfig?.hubAddress || "Jl. Raya Cianjur No. 123, Kec. Cianjur, Kabupaten Cianjur, Jawa Barat 43211 (Pusat Logistik Cianjur)"
  };

  // Clean WhatsApp number
  const adminWhatsApp = useMemo(() => {
    const raw = appConfig?.adminWhatsApp || "6281299887766";
    return raw.replace(/\D/g, '');
  }, [appConfig?.adminWhatsApp]);

  const [formData, setFormData] = useState({
    senderName: defaultSender ? (user?.displayName || '') : '',
    senderPhone: defaultSender ? (user?.phone || '08123456789') : '',
    senderProvince: defaultSender?.province || '',
    senderCity: defaultSender?.city || '',
    senderAddress: defaultSender?.detail || '',
    receiverName: defaultReceiver ? (user?.displayName || '') : '',
    receiverPhone: defaultReceiver ? (user?.phone || '') : '',
    receiverCountry: defaultReceiver?.province || '',
    receiverZip: defaultReceiver?.zip || '',
    receiverAddress: defaultReceiver?.detail || '',
    items: [{ category: '', name: '', qty: 1, value: 0, weight: '0.5' }] as JastipItem[],
    length: 10, width: 10, height: 10
  });

  useEffect(() => {
    if (shippingRates.length > 0 && !formData.receiverCountry) {
        // Try to match defaultReceiver province to shipping rates if possible
        const matchedRate = shippingRates.find(r => r.countryName === defaultReceiver?.province);
        setFormData(prev => ({ 
            ...prev, 
            receiverCountry: matchedRate ? matchedRate.countryName : shippingRates[0].countryName 
        }));
    }
  }, [shippingRates, defaultReceiver]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleItemUpdate = (index: number, field: keyof JastipItem, value: any) => {
    const newItems = [...formData.items];
    if (field === 'weight') {
      if (/^[0-9]*[.,]?[0-9]*$/.test(value) || value === '') {
        newItems[index] = { ...newItems[index], [field]: value };
      } else {
        return;
      }
    } else {
      (newItems[index] as any)[field] = value;
    }
    handleInputChange('items', newItems);
  };

  const totalWeight = useMemo(() => {
    return formData.items.reduce((sum, item) => {
      const parsedWeight = parseFloat(item.weight.toString().replace(',', '.')) || 0;
      return sum + (parsedWeight * item.qty);
    }, 0);
  }, [formData.items]);

  const currentCountryRate = useMemo(() => {
    return shippingRates.find(r => r.countryName === formData.receiverCountry) || null;
  }, [shippingRates, formData.receiverCountry]);

  const totalShippingCost = useMemo(() => {
    const billableWeight = Math.max(0.5, Math.ceil(totalWeight * 2) / 2);
    const baseRate = currentCountryRate?.baseRate || 0;
    const perKgRate = currentCountryRate?.perKgRate || 100000;
    return baseRate + (billableWeight * perKgRate);
  }, [totalWeight, currentCountryRate]);
  
  const discountAmount = useMemo(() => {
    if (!selectedVoucherCode) return 0;
    const vData = availableVouchers.find(v => v.code === selectedVoucherCode);
    if (!vData) return 0;
    
    if (vData.discountType === 'PERCENTAGE') {
      return (totalShippingCost * vData.discountValue) / 100;
    }
    return vData.discountValue;
  }, [selectedVoucherCode, availableVouchers, totalShippingCost]);

  const grandTotal = Math.max(0, totalShippingCost + paymentConfig.adminFee - discountAmount);

  // ─── Validasi Batas Transaksi ─────────────────────────────────────────────
  const minTx = paymentConfig.minTransaction || 0;
  const maxTx = paymentConfig.maxTransaction || Infinity;
  const isBelowMin = minTx > 0 && grandTotal > 0 && grandTotal < minTx;
  const isAboveMax = maxTx < Infinity && grandTotal > maxTx;
  const isNearMax = maxTx < Infinity && grandTotal > 0 && grandTotal >= maxTx * 0.8 && !isAboveMax;
  const progressPct = maxTx < Infinity && maxTx > 0 ? Math.min(100, (grandTotal / maxTx) * 100) : 0;

  const txStatusColor = isBelowMin
    ? 'text-red-400'
    : isAboveMax
    ? 'text-amber-400'
    : grandTotal > 0
    ? 'text-emerald-400'
    : 'text-slate-500';

  const nextStep = () => setStep(step + 1);
  const prevStep = () => setStep(step - 1);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    alert(`${label} berhasil disalin!`);
  };

  const stepsInfo = [
    { label: 'Proses', icon: 'fa-info-circle' },
    { label: 'Pengirim', icon: 'fa-user-arrow-up' },
    { label: 'Penerima', icon: 'fa-user-arrow-down' },
    { label: 'Barang', icon: 'fa-box-open' },
    { label: 'Bayar', icon: 'fa-credit-card' },
    { label: 'Hub Cianjur', icon: 'fa-warehouse' },
    { label: 'Konfirmasi', icon: 'fa-check-double' },
    { label: 'Selesai', icon: 'fa-paper-plane' }
  ];

  const handleFinalSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const itemsSummary = formData.items
      .map((item, i) => `${i + 1}. [${item.category}]\nDetail Barang:\n${item.name}\n(Total: ${item.qty} Pcs, Berat: ${item.weight}kg)`)
      .join('\n\n');

    const message = `Halo Admin JastipTKI, saya ingin membuat pesanan baru:

*--- DATA PENGIRIM ---*
Nama: ${formData.senderName || '-'}
WA: ${formData.senderPhone || '-'}
Alamat: ${formData.senderAddress || '-'}, ${formData.senderCity || '-'}, ${formData.senderProvince || '-'}

*--- DATA PENERIMA ---*
Nama: ${formData.receiverName || '-'}
Negara: ${formData.receiverCountry || '-'}
Alamat: ${formData.receiverAddress || '-'}

*--- DETAIL BARANG (PER KATEGORI) ---*
${itemsSummary}

*Total Berat:* ${totalWeight.toFixed(2)} KG
*Estimasi Ongkir:* Rp ${totalShippingCost.toLocaleString('id-ID')}
*Biaya Pengurusan:* Rp ${paymentConfig.adminFee.toLocaleString('id-ID')}
*Voucher:* ${selectedVoucherCode || 'Tidak ada'} ${discountAmount > 0 ? `(-Rp ${discountAmount.toLocaleString()})` : ''}
*Total Tagihan:* Rp ${grandTotal.toLocaleString('id-ID')}
*Metode Bayar:* ${paymentMethod || '-'}

Mohon konfirmasi pesanan saya. Terima kasih!`;

    try {
      // Sanitasi: Firestore MENOLAK nilai undefined, NaN, atau Infinity
      const safeNum = (v: any) => (typeof v === 'number' && isFinite(v) ? v : 0);
      const safeStr = (v: any) => (v != null && v !== undefined ? String(v) : '');

      const orderData = {
        type: 'JASTIP' as const,
        destination: safeStr(formData.receiverCountry),
        amount: safeNum(grandTotal),
        shippingCost: safeNum(totalShippingCost),
        serviceFee: safeNum(paymentConfig.adminFee - discountAmount),
        weight: safeNum(totalWeight),
        ...(isAboveMax ? { requiresAdminConfirmation: true } : {}),
        details: {
          sender: {
            name: safeStr(formData.senderName),
            phone: safeStr(formData.senderPhone),
            address: safeStr(formData.senderAddress)
          },
          receiver: {
            name: safeStr(formData.receiverName),
            address: safeStr(formData.receiverAddress),
            country: safeStr(formData.receiverCountry)
          },
          items: formData.items.map(item => ({
            name: safeStr(item.name),
            category: safeStr(item.category),
            qty: safeNum(item.qty),
            weight: safeNum(item.weight),
            notes: safeStr(item.notes ?? '')
          })),
          paymentMethod: safeStr(paymentMethod),
          voucherUsed: selectedVoucherCode || null,
          voucherDiscount: safeNum(discountAmount)
        }
      };

      await onComplete(orderData);
      const waUrl = `https://wa.me/${adminWhatsApp}?text=${encodeURIComponent(message)}`;
      setWaMessageUrl(waUrl);
      setStep(7);
    } catch (error) {
      console.error("Gagal menyimpan pesanan:", error);
      alert("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openWhatsAppDirectly = () => {
    onClose();
    window.location.href = waMessageUrl;
  };

  const getAvailableCategories = (currentIndex: number) => {
    const usedCategories = formData.items
      .filter((_, idx) => idx !== currentIndex)
      .map(item => item.category)
      .filter(cat => cat !== '');
    
    return CATEGORIES.filter(cat => !usedCategories.includes(cat));
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
      <div className="absolute inset-0 hidden lg:block" onClick={step < 7 ? onClose : undefined}></div>
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl mx-auto h-full lg:h-auto lg:max-h-[95vh] lg:rounded-[3rem] shadow-soft-xl relative z-10 flex flex-col overflow-hidden animate-fade-in-up">
        
        {step < 7 && (
          <div className="px-4 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 z-20">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-3">
                 <button onClick={step === 0 ? onClose : prevStep} className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-90">
                   <i className={`fas ${step === 0 ? 'fa-times' : 'fa-arrow-left'} text-xs`}></i>
                 </button>
                 <div>
                   <h2 className="text-sm font-black text-slate-900 dark:text-white tracking-tight leading-tight">Kirim Jastip</h2>
                   <p className="text-[8px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em]">{stepsInfo[step].label}</p>
                 </div>
              </div>
            </div>
            <div className="hidden lg:flex justify-between items-center relative px-2 mb-1">
              <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 dark:bg-slate-800 -translate-y-1/2 -z-10"></div>
              <div className="absolute top-1/2 left-0 h-0.5 bg-blue-600 -translate-y-1/2 -z-10 transition-all duration-700" style={{ width: `${(step / (stepsInfo.length - 2)) * 100}%` }}></div>
              {stepsInfo.slice(0, 7).map((s, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] transition-all duration-500 border-2 border-white dark:border-slate-900 shadow-sm ${step >= i ? 'bg-blue-600 text-white scale-110' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'}`}>
                    <i className={`fas ${s.icon} text-[8px]`}></i>
                  </div>
                  <span className={`text-[7px] font-black uppercase tracking-widest ${step >= i ? 'text-blue-600' : 'text-slate-400 dark:text-slate-500'}`}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4 scrollbar-hide">
          {step === 0 && (
            <div className="animate-fade-in-up space-y-10 py-4">
              <div className="text-center space-y-3">
                <div className="inline-flex px-4 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-blue-100 dark:border-blue-800">Alur JastipTKI</div>
                <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Bagaimana Cara Kerjanya?</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium max-w-sm mx-auto">Sistem logistik terpadu untuk memastikan paket dari rumah sampai ke pelukan Anda di perantauan.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[
                  { icon: 'fa-house-chimney', color: 'bg-blue-600', label: '1. Packing & Kirim', desc: 'Keluarga menyiapkan barang dan kirim ke Hub Cianjur via ekspedisi lokal.' },
                  { icon: 'fa-microscope', color: 'bg-indigo-600', label: '2. QC & Re-packing', desc: 'Tim kami mengecek isi paket, menimbang akurat, dan packing ulang agar aman.' },
                  { icon: 'fa-plane-up', color: 'bg-emerald-600', label: '3. Cargo Udara', desc: 'Paket diterbangkan via kargo udara reguler untuk proses yang lebih cepat.' },
                  { icon: 'fa-truck-fast', color: 'bg-amber-600', label: '4. Local Delivery', desc: 'Kurir lokal mengantar langsung ke alamat Anda di luar negeri.' },
                ].map((item, i) => (
                  <div key={i} className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border border-slate-100 dark:border-slate-800 group hover:border-blue-500 transition-all shadow-soft dark:shadow-none">
                    <div className={`w-12 h-12 ${item.color} text-white rounded-2xl flex items-center justify-center text-lg mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                      <i className={`fas ${item.icon}`}></i>
                    </div>
                    <h4 className="font-black text-slate-900 dark:text-white text-sm mb-2">{item.label}</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-bold italic">"{item.desc}"</p>
                  </div>
                ))}
              </div>
              <div className="pt-6">
                <button onClick={nextStep} className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-black text-lg shadow-2xl shadow-blue-200 dark:shadow-none active:scale-95 transition-all">
                  Mulai Pesanan <i className="fas fa-arrow-right ml-2 text-sm"></i>
                </button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="animate-fade-in-up space-y-8">
              <div className="bg-blue-600 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-xl mb-8">
                <div className="relative z-10">
                  <h3 className="text-2xl font-black mb-1">Data Pengirim</h3>
                  <p className="text-blue-100 text-xs font-medium">Informasi keluarga/pengirim yang ada di Indonesia.</p>
                </div>
                <i className="fas fa-user-arrow-up absolute -bottom-8 -right-8 text-white/10 text-[10rem]"></i>
              </div>
              <div className="grid gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Nama Lengkap (Sesuai KTP)</label>
                  <input type="text" value={formData.senderName} onChange={(e) => handleInputChange('senderName', e.target.value)} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:bg-white transition-all shadow-sm" placeholder="Contoh: Siti Aminah" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">No. WhatsApp Aktif</label>
                  <input type="tel" value={formData.senderPhone} onChange={(e) => handleInputChange('senderPhone', e.target.value)} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:bg-white transition-all shadow-sm" placeholder="08123456789" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Provinsi</label>
                    <input type="text" value={formData.senderProvince} onChange={(e) => handleInputChange('senderProvince', e.target.value)} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:bg-white transition-all shadow-sm" placeholder="Jawa Barat" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Kota / Kabupaten</label>
                    <input type="text" value={formData.senderCity} onChange={(e) => handleInputChange('senderCity', e.target.value)} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:bg-white transition-all shadow-sm" placeholder="Cianjur" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Alamat Penjemputan / Kirim ke Hub</label>
                  <textarea value={formData.senderAddress} onChange={(e) => handleInputChange('senderAddress', e.target.value)} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:bg-white transition-all shadow-sm h-32 resize-none" placeholder="Nama Jalan, RT/RW, Kecamatan, dsb."></textarea>
                </div>
              </div>
              <div className="pt-4">
                <button onClick={nextStep} className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-black text-lg shadow-xl shadow-blue-100 dark:shadow-none active:scale-95 transition-all">
                  Lanjut ke Data Penerima
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-fade-in-up space-y-8">
              <div className="bg-emerald-600 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-xl mb-8">
                <div className="relative z-10">
                  <h3 className="text-2xl font-black mb-1">Data Penerima</h3>
                  <p className="text-emerald-100 text-xs font-medium">Informasi alamat tujuan di luar negeri.</p>
                </div>
                <i className="fas fa-user-arrow-down absolute -bottom-8 -right-8 text-white/10 text-[10rem]"></i>
              </div>
              <div className="grid gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Nama Lengkap (Sesuai ARC/Paspor)</label>
                  <input type="text" value={formData.receiverName} onChange={(e) => handleInputChange('receiverName', e.target.value)} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 focus:bg-white transition-all shadow-sm" placeholder="Contoh: Budi Santoso" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Negara Tujuan</label>
                    <div className="relative">
                      <select value={formData.receiverCountry} onChange={(e) => handleInputChange('receiverCountry', e.target.value)} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 focus:bg-white transition-all shadow-sm appearance-none">
                        {shippingRates.map(r => (
                            <option key={r.countryCode} value={r.countryName}>{r.countryName}</option>
                        ))}
                      </select>
                      <i className="fas fa-chevron-down absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"></i>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Kode Pos (Zip Code)</label>
                    <input type="text" value={formData.receiverZip} onChange={(e) => handleInputChange('receiverZip', e.target.value)} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 focus:bg-white transition-all shadow-sm" placeholder="Contoh: 123-4567" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">No. Telp Lokal Luar Negeri</label>
                  <input type="tel" value={formData.receiverPhone} onChange={(e) => handleInputChange('receiverPhone', e.target.value)} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 focus:bg-white transition-all shadow-sm" placeholder="+81 / +886..." />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Alamat Lengkap Tujuan</label>
                  <textarea value={formData.receiverAddress} onChange={(e) => handleInputChange('receiverAddress', e.target.value)} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-emerald-500 focus:bg-white transition-all shadow-sm h-32 resize-none" placeholder="Sebutkan Prefektur, Kota, Gedung..."></textarea>
                </div>
              </div>
              <div className="pt-4">
                <button onClick={nextStep} className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-black text-lg shadow-xl shadow-blue-100 dark:shadow-none active:scale-95 transition-all">
                  Lanjut ke Detail Barang
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-fade-in-up space-y-6">
              <div className="bg-slate-900 dark:bg-slate-800 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-xl mb-8">
                <div className="relative z-10">
                  <h3 className="text-2xl font-black mb-1">Daftar Barang</h3>
                  <p className="text-slate-400 text-xs font-medium">Kelompokkan barang Anda berdasarkan kategori.</p>
                </div>
                <i className="fas fa-box-open absolute -bottom-8 -right-8 text-white/10 text-[10rem]"></i>
              </div>
              
              <div className="space-y-6">
                {formData.items.map((item, idx) => {
                  const availableCats = getAvailableCategories(idx);

                  return (
                    <div key={idx} className="p-6 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-soft relative transition-all hover:border-blue-400">
                      <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                           <span className="text-[10px] font-black bg-blue-600 text-white px-3 py-1 rounded-full uppercase tracking-widest shadow-md">#BARANG {idx + 1}</span>
                           {item.category && <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">({item.category})</span>}
                        </div>
                        {formData.items.length > 1 && (
                          <button onClick={() => {
                            const newItems = formData.items.filter((_, i) => i !== idx);
                            handleInputChange('items', newItems);
                          }} className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all">
                            <i className="fas fa-trash-alt text-[10px]"></i>
                          </button>
                        )}
                      </div>
                      
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Pilih Kategori Barang</label>
                          <div className="relative">
                            <select 
                              value={item.category} 
                              onChange={(e) => handleItemUpdate(idx, 'category', e.target.value)} 
                              className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-2xl font-black text-xs outline-none focus:border-blue-500 transition-all appearance-none dark:text-white"
                            >
                              <option value="">-- Klik untuk memilih satu kategori --</option>
                              {item.category && !availableCats.includes(item.category) && (
                                <option value={item.category}>{item.category}</option>
                              )}
                              {availableCats.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <i className="fas fa-chevron-down absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[10px]"></i>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Detail Daftar Barang (Satu Kategori)</label>
                          <textarea 
                            value={item.name} 
                            onChange={(e) => handleItemUpdate(idx, 'name', e.target.value)} 
                            className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-2xl font-bold text-xs outline-none focus:border-blue-500 h-32 resize-none transition-all dark:text-white" 
                            placeholder={`Masukkan semua item yang masuk kategori ${item.category || 'ini'}...\nContoh: Piring Keramik (5), Gelas Kaca (2), Vas Bunga (1)...`}
                          ></textarea>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Total Jumlah (Pcs)</label>
                            <input type="number" value={item.qty} onChange={(e) => handleItemUpdate(idx, 'qty', parseInt(e.target.value) || 1)} className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl font-bold text-xs outline-none focus:border-blue-500 dark:text-white" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Est. Berat Total (KG)</label>
                            <input type="text" inputMode="decimal" value={item.weight} onChange={(e) => handleItemUpdate(idx, 'weight', e.target.value)} className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl font-bold text-xs outline-none focus:border-blue-500 dark:text-white" placeholder="0.5" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {formData.items.length < CATEGORIES.length && (
                  <button onClick={() => handleInputChange('items', [...formData.items, { category: '', name: '', qty: 1, value: 0, weight: '0.5' }])} className="w-full py-6 border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 rounded-[2rem] font-black text-[10px] uppercase tracking-widest hover:border-blue-500 hover:text-blue-600 transition-all flex flex-col items-center justify-center gap-2 group shadow-sm">
                    <i className="fas fa-plus-circle text-2xl group-hover:scale-110 transition-transform"></i>
                    <span>Tambah Kategori Barang Baru</span>
                  </button>
                )}
              </div>

              <div className="bg-slate-900 dark:bg-slate-800 rounded-[2.5rem] p-8 text-white mt-10 shadow-2xl relative overflow-hidden">
                 <div className="relative z-10 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Estimasi Berat Seluruh Paket</p>
                      <p className="text-3xl font-black text-blue-400">{totalWeight.toFixed(2)} <span className="text-sm font-bold text-white opacity-40">KG</span></p>
                    </div>
                    <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-2xl">
                      <i className="fas fa-weight-hanging"></i>
                    </div>
                 </div>
              </div>

              <div className="pt-10">
                <button onClick={nextStep} disabled={formData.items.some(i => !i.name || !i.category)} className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-black text-lg shadow-xl active:scale-95 transition-all disabled:opacity-50">
                  Lanjut ke Pembayaran <i className="fas fa-arrow-right ml-2 text-sm"></i>
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="animate-fade-in-up space-y-8">
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">Metode Pembayaran</h3>
                <p className="text-xs text-slate-500 font-medium">Pilih channel pembayaran & voucher promo.</p>
              </div>

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
                      {/* Info: ada voucher di koleksi */}
                      {((user.voucherCollection || []).length > 1) && (
                        <p className="text-[9px] font-bold text-blue-500 mt-0.5">
                          <i className="fas fa-layer-group mr-1"></i>
                          {(user.voucherCollection || []).length} voucher tersedia
                        </p>
                      )}
                    </div>
                  </div>
                  <i className={`fas fa-chevron-down text-xs transition-transform ${isVoucherDropdownOpen ? 'rotate-180' : ''} ${selectedVoucherCode ? 'text-emerald-600' : 'text-slate-400'}`}></i>
                </button>

                {isVoucherDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-2xl z-50 overflow-hidden animate-fade-in-up">
                    <div className="p-2 space-y-1">
                      {/* Opsi: tidak pakai voucher */}
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

              <div className="grid gap-4">
                {['Transfer Bank (VA)', 'QRIS / E-Wallet'].map((m) => (
                  <button key={m} onClick={() => setPaymentMethod(m)} className={`p-6 rounded-[2rem] border-2 text-left transition-all ${paymentMethod === m ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900'}`}>
                    <div className="flex justify-between items-center">
                      <span className="font-black text-slate-900 dark:text-white">{m}</span>
                      {paymentMethod === m && <i className="fas fa-check-circle text-blue-600 text-xl"></i>}
                    </div>
                  </button>
                ))}
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-[2rem] space-y-4">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-500">Estimasi Ongkir ({totalWeight.toFixed(2)}kg)</span>
                  <span className="text-slate-900 dark:text-white">Rp {totalShippingCost.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-500">Biaya Pengurusan</span>
                  <span className="text-slate-900 dark:text-white">Rp {paymentConfig.adminFee.toLocaleString('id-ID')}</span>
                </div>
                {discountAmount > 0 && (
                   <div className="flex justify-between text-xs font-bold text-emerald-600">
                      <span>Potongan Voucher</span>
                      <span>- Rp {discountAmount.toLocaleString('id-ID')}</span>
                   </div>
                )}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <span className="text-sm font-black text-slate-900 dark:text-white">TOTAL ESTIMASI</span>
                  <span className={`text-xl font-black ${txStatusColor}`}>Rp {grandTotal.toLocaleString('id-ID')}</span>
                </div>
                {/* Indikator batas transaksi */}
                {(minTx > 0 || maxTx < Infinity) && grandTotal > 0 && (
                  <div className={`flex justify-between items-center text-[10px] font-bold pt-1 border-t border-slate-200 dark:border-slate-700`}>
                    <span className={txStatusColor}>
                      {minTx > 0 && `Min: Rp ${minTx.toLocaleString('id-ID')}`}
                      {minTx > 0 && maxTx < Infinity && ' | '}
                      {maxTx < Infinity && `Maks: Rp ${maxTx.toLocaleString('id-ID')}`}
                    </span>
                    <span className={`font-black ${txStatusColor}`}>
                      {isBelowMin ? '✗ Di bawah minimum' : isAboveMax ? '⚠ Di atas maksimum' : '✓ Dalam batas'}
                    </span>
                  </div>
                )}
                {/* Progress bar — hanya muncul saat >80% dari max */}
                {isNearMax && maxTx < Infinity && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-black text-amber-500">
                      <span>Mendekati batas maksimum</span>
                      <span>Rp {grandTotal.toLocaleString('id-ID')} / Rp {maxTx.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                      ></div>
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
                    <p className="text-[10px] text-red-300/70 mt-0.5">Total Anda saat ini Rp {grandTotal.toLocaleString('id-ID')}. Tambahkan item untuk melanjutkan.</p>
                  </div>
                </div>
              )}

              {/* Warning: di atas maksimum */}
              {isAboveMax && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex gap-3 items-start">
                  <i className="fas fa-triangle-exclamation text-amber-400 mt-0.5 shrink-0"></i>
                  <div>
                    <p className="text-xs font-black text-amber-400">Total order Rp {grandTotal.toLocaleString('id-ID')} melebihi batas normal Rp {maxTx.toLocaleString('id-ID')}</p>
                    <p className="text-[10px] text-amber-300/70 mt-0.5">Admin akan menghubungi Anda untuk konfirmasi tambahan sebelum pesanan diproses.</p>
                  </div>
                </div>
              )}

              <button
                onClick={nextStep}
                disabled={!paymentMethod || isBelowMin}
                className={`w-full py-5 rounded-[2rem] font-black text-lg shadow-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3 ${
                  isAboveMax
                    ? 'bg-amber-500 text-white'
                    : 'bg-blue-600 text-white'
                }`}
              >
                {isAboveMax && <i className="fas fa-triangle-exclamation text-sm"></i>}
                {isAboveMax ? 'Lanjut — Perlu Konfirmasi' : 'Lanjut ke Alamat Hub'}
              </button>
            </div>
          )}

          {step === 5 && (
            <div className="animate-fade-in-up space-y-8">
              <div className="bg-amber-600 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-xl mb-8">
                <div className="relative z-10">
                  <h3 className="text-2xl font-black mb-1">Kirim Ke Hub Cianjur</h3>
                  <p className="text-amber-100 text-xs font-medium">Silakan kirim paket Anda ke alamat di bawah ini.</p>
                </div>
                <i className="fas fa-warehouse absolute -bottom-8 -right-8 text-white/10 text-[10rem]"></i>
              </div>
              
              <div className="p-8 bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-soft space-y-6">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nama Penerima Hub</p>
                  <div className="flex justify-between items-center">
                    <p className="font-black text-slate-900 dark:text-white">{HUB_ADDRESS.name}</p>
                    <button onClick={() => copyToClipboard(HUB_ADDRESS.name, 'Nama')} className="text-blue-600 text-xs font-bold">Salin</button>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">No. Telp / WhatsApp</p>
                  <div className="flex justify-between items-center">
                    <p className="font-black text-slate-900 dark:text-white">{HUB_ADDRESS.phone}</p>
                    <button onClick={() => copyToClipboard(HUB_ADDRESS.phone, 'No. Telp')} className="text-blue-600 text-xs font-bold">Salin</button>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Alamat Lengkap</p>
                  <div className="flex justify-between items-start gap-4">
                    <p className="font-black text-slate-900 dark:text-white text-sm leading-relaxed">{HUB_ADDRESS.address}</p>
                    <button onClick={() => copyToClipboard(HUB_ADDRESS.address, 'Alamat')} className="text-blue-600 text-xs font-bold shrink-0">Salin</button>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-3xl border border-blue-100 dark:border-blue-800 flex gap-4">
                <i className="fas fa-info-circle text-blue-600 mt-1"></i>
                <p className="text-xs font-bold text-blue-900 dark:text-blue-300 leading-relaxed">PENTING: Tuliskan ID Pesanan Anda pada paket agar memudahkan proses identifikasi di gudang kami.</p>
              </div>

              <button onClick={nextStep} className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-black text-lg shadow-xl active:scale-95 transition-all">
                Konfirmasi Pesanan
              </button>
            </div>
          )}

          {step === 6 && (
            <div className="animate-fade-in-up flex flex-col items-center text-center py-4">
              <div className="w-24 h-24 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-4xl shadow-2xl mb-8"><i className="fas fa-paper-plane" /></div>
              <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter mb-2">Hampir Selesai!</h3>
              <p className="text-sm text-slate-500 font-medium mb-10 max-w-xs">Klik tombol di bawah untuk menyimpan pesanan dan menghubungi Admin via WhatsApp.</p>
              
              <div className="w-full bg-slate-900 dark:bg-slate-800 text-white rounded-[2.5rem] p-8 text-left shadow-2xl">
                <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Ringkasan Pesanan</p>
                <h4 className="font-black text-xl mb-6">Jastip Ke {formData.receiverCountry}</h4>
                <div className="space-y-3 pt-6 border-t border-white/10">
                   <div className="flex justify-between items-center">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Estimasi Berat:</span>
                      <span className="text-[10px] font-black text-white">{totalWeight.toFixed(2)} KG</span>
                   </div>
                   <div className="flex justify-between items-center">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Biaya Pengurusan:</span>
                      <span className="text-[10px] font-black text-white">Rp {paymentConfig.adminFee.toLocaleString('id-ID')}</span>
                   </div>
                   <div className="flex justify-between items-center">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Total Estimasi:</span>
                      <span className={`text-2xl font-black ${txStatusColor}`}>Rp {grandTotal.toLocaleString('id-ID')}</span>
                   </div>
                   {/* Indikator batas di ringkasan konfirmasi */}
                   {(minTx > 0 || maxTx < Infinity) && (
                     <div className={`flex justify-between items-center text-[9px] font-bold pt-2 border-t border-white/10`}>
                       <span className="text-slate-500">
                         {minTx > 0 && `Min: Rp ${minTx.toLocaleString('id-ID')}`}
                         {minTx > 0 && maxTx < Infinity && ' | '}
                         {maxTx < Infinity && `Maks: Rp ${maxTx.toLocaleString('id-ID')}`}
                       </span>
                       <span className={txStatusColor}>
                         {isBelowMin ? '✗ Di bawah min' : isAboveMax ? '⚠ Perlu konfirmasi' : '✓ Dalam batas'}
                       </span>
                     </div>
                   )}
                </div>
              </div>

              <div className="w-full mt-10 flex flex-col gap-3">
                <button 
                  onClick={handleFinalSubmit} 
                  disabled={isSubmitting}
                  className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-black text-lg shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isSubmitting ? <i className="fas fa-circle-notch animate-spin"></i> : "Kirim & Hubungi Admin"}
                </button>
              </div>
            </div>
          )}

          {step === 7 && (
            <div className="animate-fade-in-up flex flex-col items-center text-center py-10">
               <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-full flex items-center justify-center text-5xl shadow-2xl mb-8">
                  <i className="fas fa-check-circle"></i>
               </div>
               <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-3">Pesanan Terkirim!</h3>
               <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed max-w-xs mb-10">
                 Pesanan Anda telah berhasil disimpan. Silakan klik tombol di bawah untuk **menghubungi Admin** via WhatsApp untuk memproses pesanan Anda.
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

export default KirimJastipFlow;
