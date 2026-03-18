
import React from 'react';

interface MaintenancePageProps {
  message?: string;
}

const MaintenancePage: React.FC<MaintenancePageProps> = ({ 
  message = "Kami sedang melakukan pemeliharaan rutin untuk meningkatkan layanan. Silakan kembali lagi nanti." 
}) => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-[3rem] p-10 shadow-soft-xl border border-slate-100 dark:border-slate-800 animate-fade-in-up">
        <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-8 animate-pulse">
          <i className="fas fa-tools"></i>
        </div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">Sedang Pemeliharaan</h1>
        <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-8">
          {message}
        </p>
        <div className="flex justify-center gap-4">
          <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
          <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
        </div>
        <div className="mt-12 pt-8 border-t border-slate-50 dark:border-slate-800">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tim Teknis JastipTKI</p>
        </div>
      </div>
    </div>
  );
};

export default MaintenancePage;
