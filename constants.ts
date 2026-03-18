
import { Service, Testimonial } from './types';

// ─── Versi Aplikasi — UPDATE INI SETIAP DEPLOY ───────────────────────────────
// Nilai ini otomatis tersync ke Firestore saat app pertama kali load.
// Tidak perlu update manual di panel admin lagi!
export const APP_VERSION = '1.8.5';
export const MIN_SUPPORTED_VERSION_DEFAULT = '1.6.5'; // fallback jika Firestore belum ada

export const SERVICES: Service[] = [
  {
    id: 'jastip',
    title: 'Jasa Titip Barang',
    description: 'Kirim barang pribadi dari Indonesia ke luar negeri. Kami packing ulang agar aman dan ringkas.',
    icon: 'fa-box-open',
    priceTag: 'Mulai Rp 100.000/kg',
    features: ['Packing Aman & Profesional', 'Asuransi Pengiriman', 'Tracking Real-time', 'Hub Pengumpul di Cianjur'],
    color: 'bg-blue-500'
  },
  {
    id: 'belanja',
    title: 'Jasa Belanjain',
    description: 'Ingin produk Indonesia tapi tidak bisa belanja online? Kami belanjakan di Shopee/Tokopedia untuk Anda.',
    icon: 'fa-shopping-bag',
    priceTag: 'Fee Jasa 10%',
    features: ['Belanja Marketplace', 'Quality Control Barang', 'Konsolidasi Paket', 'Pembayaran via QRIS/Transfer'],
    color: 'bg-emerald-500'
  }
];

export const TESTIMONIALS: Testimonial[] = [
  {
    id: '1',
    name: 'Budi Santoso',
    location: 'Nagoya, Jepang',
    message: 'Barang sampai tepat waktu. Kangen sambal terasi akhirnya terobati berkat JastipTKI!',
    rating: 5
  },
  {
    id: '2',
    name: 'Siti Aminah',
    location: 'Taipei, Taiwan',
    message: 'Awalnya ragu, ternyata adminnya sangat ramah dan membantu belanja baju buat anak.',
    rating: 5
  },
  {
    id: '3',
    name: 'Rudi Hermawan',
    location: 'Incheon, Korea Selatan',
    message: 'Terpercaya! Packing sangat kuat, barang pecah belah aman sampai tujuan.',
    rating: 4
  }
];
