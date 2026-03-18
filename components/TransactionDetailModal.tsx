
import React, { useState } from 'react';
import { Transaction } from '../types';
import { useTransactionConfig } from '../hooks/useTransactionConfig';
import { downloadInvoicePDF } from '../services/invoiceGenerator';

interface TransactionDetailModalProps {
  transaction: Transaction;
  onClose: () => void;
  onReviewSubmit?: (id: string, rating: number, comment: string) => void;
  onConfirmDelivery?: (id: string) => Promise<void>;
  appConfig?: any;
}

const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  transaction, onClose, onReviewSubmit, onConfirmDelivery, appConfig
}) => {
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const { config: transConfig } = useTransactionConfig();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'DELIVERED': return 'fa-check-circle';
      case 'SHIPPING': return 'fa-truck';
      case 'PROCESSING': return 'fa-box';
      default: return 'fa-clock';
    }
  };

  const getStatusLabel = (s: string) => transConfig.statusLabel[s] || s;
  const getStatusColorClass = (s: string) => transConfig.statusColor[s] || 'text-slate-500 bg-slate-50 dark:bg-slate-800 dark:text-slate-400';

  const isBelanja = transaction.type === 'BELANJA';
  const isShipping = transaction.status === 'SHIPPING';
  const isDelivered = transaction.status === 'DELIVERED';
  const hasReviewed = !!transaction.review;
  const confirmedByUser = !!(transaction as any).confirmedByUser;

  // ─── Konfirmasi Penerimaan Barang ────────────────────────────────────────
  const handleConfirmDelivery = async () => {
    if (!onConfirmDelivery) return;
    setIsConfirming(true);
    try {
      await onConfirmDelivery(transaction.id);
      setShowConfirmDialog(false);
      // Langsung tampilkan form ulasan setelah konfirmasi
      setShowReviewForm(true);
    } catch {
      alert('Gagal mengkonfirmasi penerimaan. Silakan coba lagi.');
    } finally {
      setIsConfirming(false);
    }
  };

  // ─── Submit Ulasan (wajib diisi) ─────────────────────────────────────────
  const handleSendReview = async () => {
    if (!comment.trim()) {
      alert('Komentar wajib diisi sebelum mengirim ulasan.');
      return;
    }
    if (!onReviewSubmit) return;
    setIsSubmittingReview(true);
    try {
      await onReviewSubmit(transaction.id, rating, comment);
      setShowReviewForm(false);
    } catch {
      alert('Gagal mengirim ulasan.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={!showConfirmDialog ? onClose : undefined}></div>

      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden animate-fade-in-up max-h-[90vh] flex flex-col transition-colors">

        {/* Header */}
        <div className="p-8 pb-4 flex justify-between items-start shrink-0">
          <div>
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-3 ${getStatusColorClass(transaction.status)}`}>
              <i className={`fas ${getStatusIcon(transaction.status)}`}></i>
              {getStatusLabel(transaction.status)}
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
              {(transaction as any).orderNumber || transaction.id}
            </h3>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Tujuan: {transaction.destination}</p>
            {/* Badge dikonfirmasi user */}
            {confirmedByUser && (
              <span className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-[9px] font-black uppercase tracking-widest">
                <i className="fas fa-circle-check text-[8px]"></i> Dikonfirmasi User
              </span>
            )}
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="px-8 pb-8 overflow-y-auto flex-1 space-y-8 scrollbar-hide">

          {/* ─── Dialog Konfirmasi Penerimaan ─── */}
          {showConfirmDialog && (
            <div className="fixed inset-0 z-[80] flex items-center justify-center p-6">
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"></div>
              <div className="relative bg-white dark:bg-slate-900 rounded-[2rem] p-8 max-w-sm w-full shadow-2xl z-10 animate-fade-in-up">
                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-5">
                  <i className="fas fa-box-open"></i>
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white text-center mb-2">Konfirmasi Penerimaan</h3>
                <p className="text-sm text-slate-500 text-center mb-6 leading-relaxed">
                  Apakah Anda yakin barang sudah diterima? <span className="font-bold text-slate-700 dark:text-slate-300">Aksi ini tidak bisa dibatalkan.</span>
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowConfirmDialog(false)}
                    disabled={isConfirming}
                    className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleConfirmDelivery}
                    disabled={isConfirming}
                    className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-100 dark:shadow-none active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isConfirming
                      ? <><i className="fas fa-spinner animate-spin"></i> Memproses...</>
                      : <><i className="fas fa-check"></i> Ya, Sudah Diterima</>
                    }
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── Form Ulasan (wajib setelah konfirmasi / bisa dari tombol) ─── */}
          {showReviewForm ? (
            <section className="animate-fade-in">
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-3xl p-6 mb-4 flex items-center gap-3">
                <i className="fas fa-circle-check text-emerald-500 text-xl shrink-0"></i>
                <div>
                  <p className="text-sm font-black text-emerald-700 dark:text-emerald-400">Barang Berhasil Dikonfirmasi!</p>
                  <p className="text-[10px] text-emerald-600/70 mt-0.5">Berikan ulasan untuk melengkapi pesanan ini.</p>
                </div>
              </div>
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Berikan Ulasan Anda</h4>
              <div className="space-y-6 bg-slate-50 dark:bg-slate-800 p-6 rounded-3xl">
                <div className="flex flex-col items-center gap-4">
                  <p className="text-sm font-bold dark:text-white">Bagaimana layanan JastipTKI?</p>
                  <div className="flex gap-3">
                    {[1,2,3,4,5].map(star => (
                      <button key={star} onClick={() => setRating(star)} className={`text-2xl transition-all ${rating >= star ? 'text-yellow-400 scale-110' : 'text-slate-300'}`}>
                        <i className="fas fa-star"></i>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Komentar <span className="text-red-400">*Wajib</span>
                  </label>
                  <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium outline-none focus:border-blue-500 h-24"
                    placeholder="Ceritakan pengalaman Anda..."
                  ></textarea>
                  {!comment.trim() && <p className="text-[10px] text-red-400 font-bold ml-1">Komentar tidak boleh kosong.</p>}
                </div>
                <button
                  onClick={handleSendReview}
                  disabled={isSubmittingReview || !comment.trim()}
                  className="w-full py-4 bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-100 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {isSubmittingReview
                    ? <><i className="fas fa-spinner animate-spin"></i> Mengirim...</>
                    : <><i className="fas fa-paper-plane"></i> Kirim Ulasan</>
                  }
                </button>
              </div>
            </section>
          ) : (
            <>
              {/* Timeline / Tracking */}
              <section>
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <i className="fas fa-location-dot text-blue-600"></i> Lacak Status
                </h4>
                <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100 dark:before:bg-slate-800">
                  {[...(transaction.updates || [
                    { date: transaction.date, message: 'Pesanan Diterima', location: 'Sistem' }
                  ])].reverse().map((update, idx) => {
                    const isLatest = idx === 0;
                    return (
                      <div key={idx} className="relative pl-8">
                        <div className={`absolute left-0 top-1.5 w-6 h-6 rounded-full border-4 border-white dark:border-slate-900 shadow-sm flex items-center justify-center z-10 transition-colors ${isLatest ? 'bg-blue-600 shadow-blue-200 dark:shadow-none' : 'bg-slate-200 dark:bg-slate-700'}`}>
                          {isLatest && <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>}
                        </div>
                        <p className={`text-sm font-bold ${isLatest ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}>{update.message}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{update.location} • {update.date}</p>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Ulasan yang sudah diberikan */}
              {hasReviewed && transaction.review && (
                <section className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-3xl border border-emerald-100 dark:border-emerald-800">
                  <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3">Ulasan Anda</h4>
                  <div className="flex gap-1 text-yellow-400 mb-2">
                    {[...Array(5)].map((_, i) => (
                      <i key={i} className={`fas fa-star text-[10px] ${i < transaction.review!.rating ? 'opacity-100' : 'opacity-20'}`}></i>
                    ))}
                  </div>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 italic">"{transaction.review.comment}"</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase mt-3">Dikirim pada {transaction.review.date}</p>
                </section>
              )}

              {/* Items Breakdown for BELANJA */}
              {isBelanja && transaction.items && (
                <section>
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Daftar Belanja</h4>
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-3xl p-5 space-y-3">
                    {transaction.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs">
                        <span className="text-slate-600 dark:text-slate-300 font-bold">{item.name} <span className="text-slate-400 text-[10px] ml-1">x{item.quantity}</span></span>
                        <span className="font-black text-slate-900 dark:text-white">Rp {(item.price * item.quantity).toLocaleString('id-ID')}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Costs Summary */}
              <section>
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Ringkasan Biaya</h4>
                <div className="space-y-3 px-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-bold">Biaya {isBelanja ? 'Barang' : 'Layanan'}</span>
                    <span className="font-black text-slate-900 dark:text-white">Rp {((transaction.amount || 0) - (transaction.shippingCost || 0) - (transaction.serviceFee || 0)).toLocaleString('id-ID')}</span>
                  </div>
                  {(transaction.shippingCost != null) && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 font-bold">Ongkos Kirim</span>
                      <span className="font-black text-slate-900 dark:text-white">Rp {(transaction.shippingCost || 0).toLocaleString('id-ID')}</span>
                    </div>
                  )}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <span className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-widest">Total Bayar</span>
                    <span className="text-xl font-black text-blue-600">Rp {(transaction.amount || 0).toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </section>

              {/* Action Buttons */}
              <div className="pt-4 flex flex-col gap-3">
                {/* Tombol Konfirmasi Penerimaan — hanya saat SHIPPING */}
                {isShipping && !confirmedByUser && (
                  <button
                    onClick={() => setShowConfirmDialog(true)}
                    className="w-full py-5 bg-emerald-600 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-emerald-100 dark:shadow-none active:scale-95 transition-all"
                  >
                    <i className="fas fa-box-open text-sm"></i> Konfirmasi Barang Diterima
                  </button>
                )}

                {/* Tombol Beri Ulasan setelah DELIVERED */}
                {isDelivered && !hasReviewed && (
                  <button
                    onClick={() => setShowReviewForm(true)}
                    className="w-full py-5 bg-blue-600 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-blue-100 dark:shadow-none active:scale-95 transition-all"
                  >
                    <i className="fas fa-star text-sm"></i> Beri Rating & Ulasan
                  </button>
                )}

                {isDelivered && hasReviewed && (
                  <button disabled className="w-full py-5 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-[1.5rem] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 opacity-60 cursor-not-allowed">
                    <i className="fas fa-check-circle text-sm"></i> Ulasan Sudah Diberikan
                  </button>
                )}

                <button 
                  onClick={() => downloadInvoicePDF(transaction, appConfig)}
                  className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-[1.5rem] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-600 hover:text-white transition-all active:scale-95"
                >
                  <i className="fas fa-file-invoice"></i> Unduh Invoice
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransactionDetailModal;
