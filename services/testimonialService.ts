import { db } from '../firebase';
import { 
  collection, 
  query, 
  orderBy,
  where,
  getDocs,
  onSnapshot,
  Unsubscribe
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { Testimonial } from '../types';
import { getCache, setCache } from './cacheService';

const CACHE_KEY = 'testimonials';

/** Batas tampil testimoni di Dashboard */
export const TESTIMONIAL_DISPLAY_LIMIT = 10;
/** Batas tampil di Landing Page */
export const TESTIMONIAL_LANDING_LIMIT = 3;

/**
 * [APP] Mengambil testimoni publik (isPublic: true) dengan cache 24 jam.
 * Cache di-invalidate otomatis saat user submit ulasan baru.
 */
export const getTestimonialsCached = async (
  onUpdate: (testimonials: Testimonial[]) => void,
  onError?: (error: Error) => void
): Promise<() => void> => {
  const cached = getCache<Testimonial[]>(CACHE_KEY);
  if (cached) {
    onUpdate(cached);
    return () => {};
  }
  try {
    // Hanya ambil ulasan publik (rating ≥ 4) untuk tampilan user
    const q = query(
      collection(db, "testimonials"),
      where("isPublic", "==", true),
      orderBy("date", "desc")
    );
    const snap = await getDocs(q);
    // Fallback: jika dokumen lama tidak punya field isPublic, tetap tampilkan
    const testimonials = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Testimonial[];
    setCache(CACHE_KEY, testimonials);
    onUpdate(testimonials);
  } catch (error) {
    // Jika query where+orderBy gagal (butuh composite index), fallback ke semua
    try {
      const qFallback = query(collection(db, "testimonials"), orderBy("date", "desc"));
      const snap = await getDocs(qFallback);
      const testimonials = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Testimonial))
        .filter((t: any) => t.isPublic !== false); // tampilkan jika isPublic true atau undefined (data lama)
      setCache(CACHE_KEY, testimonials);
      onUpdate(testimonials);
    } catch (fallbackErr) {
      console.error("Firestore Testimonials Error:", fallbackErr);
      onUpdate([]);
      if (onError) onError(fallbackErr as Error);
    }
  }
  return () => {};
};

/**
 * [ADMIN] Real-time listener.
 */
export const getTestimonialsRealtime = (
  onUpdate: (testimonials: Testimonial[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  const q = query(collection(db, "testimonials"), orderBy("date", "desc"));
  return onSnapshot(q, (snapshot: any) => {
    const testimonials = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) as Testimonial[];
    onUpdate(testimonials);
  }, (error: Error) => {
    console.error("Firestore Testimonials Stream Error:", error);
    if (onError) onError(error);
  });
};
