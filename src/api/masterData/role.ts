import api from '../axios'

export interface Role {
  id: number;
  nama: string;
}

export async function getRoles(): Promise<Role[]> {
  const res = await api.get('/roles');
  return res.data;
}