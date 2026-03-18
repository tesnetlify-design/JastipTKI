
import React, { useState, useEffect } from 'react';
import { usePaymentConfig } from '../hooks/usePaymentConfig';
import { useShippingRates } from '../hooks/useShippingRates';

const Calculator: React.FC = () => {
  const { paymentConfig } = usePaymentConfig();
  const { rates, loading: loadingRates } = useShippingRates();
  const [weightInput, setWeightInput] = useState<string>('1'); 
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>('');
  const [total, setTotal] = useState(0);
  const [roundedWeight, setRoundedWeight] = useState(1);

  useEffect(() => {
    if (rates.length > 0 && !selectedCountryCode) {
      setSelectedCountryCode(rates[0].countryCode);
    }
  }, [rates, selectedCountryCode]);

  useEffect(() => {
    const rateData = rates.find(r => r.countryCode === selectedCountryCode);
    const perKgRate = rateData?.perKgRate || 0;
    const weight = parseFloat(weightInput.replace(',', '.')) || 0;
    const calculatedRoundedWeight = Math.ceil(weight * 2) / 2;
    const finalWeight = Math.max(0.5, calculatedRoundedWeight);
    
    setRoundedWeight(finalWeight);
    setTotal(finalWeight * perKgRate);
  }, [weightInput, selectedCountryCode, rates]);

  const handleWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (/^[0-9]*[.,]?[0-9]*$/.test(val) || val === '') {
      setWeightInput(val);
    }
  };

  const currentRate = rates.find(r => r.countryCode === selectedCountryCode);

  if (loadingRates) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-12 border border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Memuat Biaya...</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-soft dark:shadow-none transition-all duration-300">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg">
          <i className="fas fa-calculator"></i>
        </div>
        <div>
          <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight">Kalkulator Ongkir</h3>
          <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mt-0.5">Estimasi Biaya Transparan</p>
        </div>
      </div>
      
      <div className="space-y-6">
        <div>
          <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-1">Negara Tujuan</label>
          <div className="relative">
            <select 
              value={selectedCountryCode}
              onChange={(e) => setSelectedCountryCode(e.target.value)}
              className="w-full pl-6 pr-12 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 appearance-none transition-all font-black text-slate-900 dark:text-white"
            >
              {rates.map(r => (
                <option key={r.countryCode} value={r.countryCode}>{r.countryName}</option>
              ))}
            </select>
            <i className="fas fa-chevron-down absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"></i>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-1">Berat Barang</label>
          <div className="relative flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus-within:ring-2 focus-within:ring-blue-500 transition-all overflow-hidden group">
            <input 
              type="text" 
              inputMode="decimal"
              value={weightInput}
              onChange={handleWeightChange}
              className="w-full pl-6 pr-16 py-4 bg-transparent outline-none font-black text-slate-900 dark:text-white text-lg"
              placeholder="Contoh: 1.5"
            />
            <div className="absolute right-0 top-0 bottom-0 px-6 flex items-center justify-center bg-slate-200 dark:bg-slate-700 font-black text-slate-600 dark:text-slate-300 text-sm">
              KG
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 px-1 text-[10px] font-bold text-slate-400 dark:text-slate-500">
            <i className="fas fa-circle-info text-blue-500"></i>
            <p>Sistem pembulatan ke atas per 0.5 KG diterapkan.</p>
          </div>
        </div>

        <div className="bg-slate-900 dark:bg-blue-600 rounded-[2rem] p-8 text-white mt-10 shadow-soft-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl transition-transform group-hover:scale-125"></div>
          
          <div className="relative z-10 space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-white/10">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-1">Berat Tagihan</p>
                <p className="text-xl font-black">{roundedWeight.toFixed(1)} <span className="text-xs opacity-60">KG</span></p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-1">Harga / KG</p>
                <p className="text-sm font-black">Rp {(currentRate?.perKgRate || 0).toLocaleString('id-ID')}</p>
              </div>
            </div>

            <div className="pt-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-2">Total Estimasi</p>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-black tracking-tighter text-blue-400 dark:text-white">Rp {total.toLocaleString('id-ID')}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 p-5 rounded-2xl border border-amber-100 dark:border-amber-800 flex gap-4 items-start shadow-sm">
          <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-800 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
            <i className="fas fa-triangle-exclamation text-xs"></i>
          </div>
          <p className="text-[10px] text-amber-800 dark:text-amber-400 leading-relaxed font-bold">
            Estimasi ini belum termasuk biaya pengurusan (Rp {paymentConfig.adminFee.toLocaleString()}) dan asuransi opsional. {currentRate && `Estimasi tiba: ${currentRate.estimatedDays} hari.`}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Calculator;
