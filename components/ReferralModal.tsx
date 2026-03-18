import React, { useState, useEffect } from 'react';
import {
  getOrCreateReferral,
  generateReferralCode,
  getReferralConfig,
  redeemReferralReward,
  ReferralData,
  ReferralConfig,
  DEFAULT_REFERRAL_CONFIG,
} from '../services/referralService';

interface ReferralModalProps {
  user: any;
  onClose: () => void;
}

const ReferralModal: React.FC<ReferralModalProps> = ({ user, onClose }) => {
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [referralConfig, setReferralConfig] = useState<ReferralConfig>(DEFAULT_REFERRAL_CONFIG);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemMsg, setRedeemMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState<'share' | 'stats'>('share');

  const localCode = generateReferralCode(user.uid, user.displayName || 'User');
  const displayCode = referralData?.code || localCode;
  const referralLink = `${window.location.origin}/?ref=${displayCode}`;
  const formatRp = (n: number) => `Rp ${(n || 0).toLocaleString('id-ID')}`;

  const pendingReward = referralData?.pendingReward ?? 0;
  const canRedeem = pendingReward >= referralConfig.minRedeemAmount;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [config, data] = await Promise.all([
          getReferralConfig(),
          getOrCreateReferral(user.uid, user.displayName || 'User'),
        ]);
        setReferralConfig(config);
        setReferralData(data);
      } catch (err) {
        console.error('Gagal memuat data referral:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user.uid]);

  const copyToClipboard = async (text: string, setter: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      try {
        const el = document.createElement('textarea');
        el.value = text;
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.focus(); el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      } catch { return; }
    }
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const rewardText = formatRp(referralConfig.rewardAmount);
    const text = encodeURIComponent(
      `Hei! Yuk pakai JastipTKI untuk kirim & beli barang dari Indonesia ke luar negeri 🌍✈️\n\nDaftar pakai kode referral aku *${displayCode}* dan kamu langsung dapat voucher ${rewardText}!\n\nLink daftar langsung: ${referralLink}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleRedeem = async () => {
    if (!canRedeem || redeeming) return;
    setRedeeming(true);
    setRedeemMsg('');
    try {
      const result = await redeemReferralReward(user.uid, referralConfig);
      setRedeemMsg(result.message);
      if (result.success) {
        // Refresh data referral
        const data = await getOrCreateReferral(user.uid, user.displayName || 'User');
        setReferralData(data);
      }
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] relative z-10 shadow-2xl animate-fade-in-up overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-8 pb-6 relative overflow-hidden">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-9 h-9 bg-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-all"
          >
            <i className="fas fa-times text-sm" />
          </button>
          <div className="flex items-center gap-4 mb-3">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-white text-xl">
              <i className="fas fa-users" />
            </div>
            <div>
              <p className="text-[9px] font-black text-white/60 uppercase tracking-widest">Program</p>
              <h3 className="text-xl font-black text-white">Ajak Teman, Hemat Bersama!</h3>
            </div>
          </div>
          <p className="text-white/80 text-xs font-medium leading-relaxed">
            Setiap teman yang daftar pakai kode kamu,{' '}
            <span className="font-black text-white">
              teman kamu langsung dapat voucher {formatRp(referralConfig.rewardAmount)}
            </span>{' '}
            dan kamu kumpulkan reward untuk dicairkan.
          </p>
          <i className="fas fa-globe absolute -bottom-4 -right-4 text-white/10 text-8xl rotate-12" />
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-6 pt-4">
          {(['share', 'stats'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 pb-3 font-black text-[10px] uppercase tracking-widest transition-all border-b-2 ${
                activeTab === tab
                  ? 'text-emerald-600 border-emerald-600'
                  : 'text-slate-400 border-transparent'
              }`}
            >
              {tab === 'share' ? '🔗 Bagikan' : '📊 Statistik'}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-4 max-h-[55vh] overflow-y-auto scrollbar-hide">
          {activeTab === 'share' ? (
            <>
              {/* Kode Referral */}
              <div>
                <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-1">
                  Kode Referral Kamu
                </p>
                <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 border-2 border-dashed border-emerald-200 dark:border-emerald-800">
                  <span className="flex-1 text-2xl font-black text-slate-900 dark:text-white tracking-widest text-center font-mono">
                    {displayCode}
                  </span>
                  <button
                    onClick={() => copyToClipboard(displayCode, setCopied)}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black transition-all shrink-0 ${
                      copied ? 'bg-emerald-500 text-white' : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 shadow-sm'
                    }`}
                  >
                    <i className={`fas ${copied ? 'fa-check' : 'fa-copy'}`} />
                  </button>
                </div>
                {loading && (
                  <p className="text-[9px] text-slate-400 text-center mt-2 animate-pulse">Menyinkronkan...</p>
                )}
              </div>

              {/* Cara Kerja */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 space-y-3">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cara Kerja</p>
                {[
                  { icon: 'fa-share-nodes', color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30', text: 'Bagikan kode atau link ke teman kamu' },
                  { icon: 'fa-user-plus', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30', text: 'Teman daftar pakai kode kamu' },
                  { icon: 'fa-gift', color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30', text: `Teman langsung dapat voucher ${formatRp(referralConfig.rewardAmount)}` },
                  { icon: 'fa-sack-dollar', color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/30', text: 'Reward kamu terkumpul → cairkan jadi voucher kapan saja' },
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs shrink-0 ${step.color}`}>
                      <i className={`fas ${step.icon}`} />
                    </div>
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{step.text}</p>
                  </div>
                ))}
              </div>

              {/* Share Buttons */}
              <button
                onClick={handleShareWhatsApp}
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-emerald-100 dark:shadow-none"
              >
                <i className="fab fa-whatsapp text-base" /> Bagikan via WhatsApp
              </button>
              <button
                onClick={() => copyToClipboard(referralLink, setCopiedLink)}
                className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <i className={`fas ${copiedLink ? 'fa-check text-emerald-500' : 'fa-link'}`} />
                {copiedLink ? 'Link Tersalin!' : 'Salin Link Referral'}
              </button>
            </>
          ) : (
            /* STATS TAB */
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Teman Diajak', value: referralData?.referredUsers?.length ?? 0, icon: 'fa-users', color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
                  { label: 'Total Reward', value: formatRp(referralData?.totalReward ?? 0), icon: 'fa-sack-dollar', color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' },
                  { label: 'Bisa Dicairkan', value: formatRp(pendingReward), icon: 'fa-wallet', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' },
                  { label: 'Sudah Dicairkan', value: formatRp(referralData?.redeemedReward ?? 0), icon: 'fa-check-circle', color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20' },
                ].map((stat, i) => (
                  <div key={i} className={`p-4 rounded-2xl ${stat.color} border border-white/50 dark:border-slate-700`}>
                    <i className={`fas ${stat.icon} text-base mb-2 block`} />
                    <p className="text-lg font-black dark:text-white leading-tight">{stat.value}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mt-1">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* Tombol Cairkan Reward */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Cairkan Reward</p>
                {canRedeem ? (
                  <>
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mb-3">
                      Kamu punya <span className="font-black text-emerald-600">{formatRp(pendingReward)}</span> yang siap dicairkan menjadi voucher!
                    </p>
                    <button
                      onClick={handleRedeem}
                      disabled={redeeming}
                      className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                      {redeeming
                        ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Memproses...</>
                        : <><i className="fas fa-coins" /> Cairkan {formatRp(pendingReward)} → Voucher</>
                      }
                    </button>
                  </>
                ) : (
                  <div className="text-center py-2">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      Kumpulkan minimal <span className="text-emerald-600 font-black">{formatRp(referralConfig.minRedeemAmount)}</span> untuk cairkan
                    </p>
                    {pendingReward > 0 && (
                      <div className="mt-3">
                        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100, (pendingReward / referralConfig.minRedeemAmount) * 100)}%` }}
                          />
                        </div>
                        <p className="text-[9px] text-slate-400 mt-1 font-bold">
                          {formatRp(pendingReward)} / {formatRp(referralConfig.minRedeemAmount)}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {redeemMsg && (
                  <p className={`text-xs font-bold mt-3 text-center ${redeemMsg.includes('Berhasil') ? 'text-emerald-600' : 'text-red-500'}`}>
                    {redeemMsg}
                  </p>
                )}
              </div>

              {/* Referred by */}
              {referralData?.referredBy && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-2xl p-4 flex items-center gap-3">
                  <i className="fas fa-heart text-emerald-500" />
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    Kamu didaftarkan oleh teman yang baik hati 🎉
                  </p>
                </div>
              )}

              {/* Daftar teman */}
              {(referralData?.referredUsers?.length ?? 0) === 0 ? (
                <div className="text-center py-6 opacity-40">
                  <i className="fas fa-user-clock text-4xl mb-3 text-slate-300 dark:text-slate-700 block" />
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Belum ada teman bergabung</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Teman yang Bergabung</p>
                  {referralData?.referredUsers.map((uid, i) => (
                    <div key={uid} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                      <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white font-black text-sm">
                        {i + 1}
                      </div>
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-300 flex-1">
                        Pengguna #{uid.slice(0, 8).toUpperCase()}
                      </p>
                      <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-full uppercase">
                        +{formatRp(referralConfig.rewardAmount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {loading && (
                <div className="text-center py-4">
                  <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-6 pt-0">
          <button
            onClick={onClose}
            className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReferralModal;
