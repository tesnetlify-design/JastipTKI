
import React, { useState } from 'react';
import { Transaction } from '../types';

interface AddTransactionModalProps {
  onClose: () => void;
  // Fix: Omit userId from the submission type as it is handled by the caller/Dashboard
  onSubmit: (trans: Omit<Transaction, 'id' | 'status' | 'userId'>) => void;
}

const AddTransactionModal: React.FC<AddTransactionModalProps> = ({ onClose, onSubmit }) => {
  const [type, setType] = useState<'JASTIP' | 'BELANJA'>('JASTIP');
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination || amount <= 0) return;
    
    onSubmit({
      type,
      destination,
      amount,
      date
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal Card */}
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden animate-fade-in-up">
        <div className="p-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-slate-900">Tambah Transaksi</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Jenis Layanan</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setType('JASTIP')}
                  className={`py-3 rounded-2xl font-bold text-sm transition-all border ${
                    type === 'JASTIP' 
                      ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200' 
                      : 'bg-white border-slate-200 text-slate-500 hover:border-blue-200'
                  }`}
                >
                  <i className="fas fa-box-open mr-2"></i> Jasa Titip
                </button>
                <button
                  type="button"
                  onClick={() => setType('BELANJA')}
                  className={`py-3 rounded-2xl font-bold text-sm transition-all border ${
                    type === 'BELANJA' 
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-200' 
                      : 'bg-white border-slate-200 text-slate-500 hover:border-emerald-200'
                  }`}
                >
                  <i className="fas fa-shopping-bag mr-2"></i> Belanja
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Negara & Kota Tujuan</label>
              <input 
                type="text" 
                required
                placeholder="Contoh: Osaka, Jepang"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Biaya (Rp)</label>
                <input 
                  type="number" 
                  required
                  placeholder="0"
                  value={amount || ''}
                  onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Tanggal</label>
                <input 
                  type="date" 
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                />
              </div>
            </div>

            <div className="pt-4 flex gap-3">
              <button 
                type="button"
                onClick={onClose}
                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
              >
                Batal
              </button>
              <button 
                type="submit"
                className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
              >
                Simpan
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddTransactionModal;
