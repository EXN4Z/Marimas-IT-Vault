import toast from 'react-hot-toast';

// Toast untuk error validasi di sisi client. Menampilkan pesan field pertama yang bermasalah
// (mis. "Email tidak boleh kosong!"); kalau ada beberapa, ditambah jumlah sisanya.
export function toastFormErrors(errors: object, fallback = 'Mohon lengkapi data yang wajib diisi.'): void {
  const messages = Object.values(errors as Record<string, unknown>).filter(
    (m): m is string => typeof m === 'string' && m.length > 0,
  );
  if (messages.length === 0) {
    toast.error(fallback);
    return;
  }
  toast.error(messages.length === 1 ? messages[0] : `${messages[0]} (+${messages.length - 1} kolom lain)`);
}
