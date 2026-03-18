
import React from 'react';
import { Transaction } from '../types';
import { useTransactionConfig } from '../hooks/useTransactionConfig';

interface TransactionListProps {
  transactions: Transaction[];
  onAddClick: () => void;
  onTransactionClick: (transaction: Transaction) => void;
}

const TransactionList: React.FC<TransactionListProps> = ({ transactions, onAddClick, onTransactionClick }) => {
  const { config: transConfig } = useTransactionConfig();

  const getStatusColorClass = (status: string) => {
    return transConfig?.statusColor?.[status] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
  };

  const getStatusLabel = (status: string) => {
    return transConfig?.statusLabel?.[status] || status || '-';
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '-';
      const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
      return d.toLocaleDateString('id-ID', options);
    } catch {
      return '-';
    }
  };

  const formatAmount = (amount?: number | null) => {
    if (amount == null || isNaN(amount)) return '0';
    return amount.toLocaleString('id-ID');
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex justify-between items-center px-2">
        <div>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white">Riwayat Transaksi</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Lacak dan kelola semua kiriman Anda</p>
        </div>
        <div className="flex gap-2">
          <button className="w-10 h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-center text-slate-400 dark:text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm">
            <i className="fas fa-filter"></i>
          </button>
        </div>
      </div>

      <button 
        onClick={onAddClick}
        className="w-full py-8 bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2rem] flex flex-col items-center justify-center gap-4 text-slate-400 dark:text-slate-500 hover:border-blue-400 dark:hover:border-blue-800 hover:text-blue-600 transition-all group shadow-soft dark:shadow-none hover:shadow-soft-xl"
      >
        <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-800 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center transition-all text-xl shadow-inner">
          <i className="fas fa-plus"></i>
        </div>
        <span className="font-bold text-lg">Buat Pengiriman Baru</span>
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
        {transactions.length === 0 ? (
          <div className="col-span-full text-center py-20 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-soft dark:shadow-none transition-colors duration-300">
            <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300 dark:text-slate-700 text-3xl">
              <i className="fas fa-receipt"></i>
            </div>
            <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Belum Ada Transaksi</h4>
            <p className="text-slate-500 dark:text-slate-400 font-medium max-w-xs mx-auto">Mulai pengiriman pertama Anda sekarang untuk melihatnya di sini.</p>
          </div>
        ) : (
          transactions.map((t) => (
            <div 
              key={t.id} 
              onClick={() => onTransactionClick(t)}
              className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-soft dark:shadow-none hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-soft-xl transition-all cursor-pointer group flex flex-col sm:flex-row sm:items-center gap-6"
            >
              <div className={`w-16 h-16 shrink-0 rounded-2xl flex items-center justify-center text-2xl ${t.type === 'JASTIP' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-inner' : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 shadow-inner'}`}>
                <i className={`fas ${t.type === 'JASTIP' ? 'fa-box' : 'fa-shopping-bag'}`}></i>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 mb-1 uppercase tracking-[0.2em] group-hover:text-blue-500 transition-colors">{(t as any).orderNumber || t.id}</p>
                    <h4 className="font-black text-lg text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">Ke {t.destination}</h4>
                  </div>
                  <span className={`text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider ${getStatusColorClass(t.status)} shadow-sm`}>
                    {getStatusLabel(t.status)}
                  </span>
                </div>
                
                <div className="flex flex-wrap items-center gap-y-2 gap-x-6 pt-4 border-t border-slate-50 dark:border-slate-800 mt-4">
                   <div className="flex flex-col">
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-1">Layanan</p>
                      <p className="text-sm font-black text-slate-700 dark:text-slate-300">{t.type === 'JASTIP' ? 'Jasa Titip' : 'Beli Titipan'}</p>
                   </div>
                   <div className="flex flex-col">
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-1">Dibuat</p>
                      <p className="text-sm font-black text-slate-700 dark:text-slate-300">{formatDate(t.date)}</p>
                   </div>
                   <div className="flex flex-col ml-auto text-right">
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-1">Total</p>
                    <p className="text-lg font-black text-blue-600 dark:text-blue-400">Rp {formatAmount(t.amount)}</p>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="py-10 text-center">
        <p className="text-xs text-slate-400 dark:text-slate-600 font-bold uppercase tracking-[0.2em]">Akhir dari daftar transaksi</p>
      </div>
    </div>
  );
};

export default TransactionList;
