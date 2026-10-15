export interface Cabang {
    id: number;
    nama: string;
    alamat: string | null;
    telepon: string | null;
    link: string | null;
    pekerja_count?: number;
}
