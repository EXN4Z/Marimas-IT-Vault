import api from './axios';

export interface ExportPrompt {
  jenis: 'karyawan_terlambat';
  bulan: number;
  tahun: number;
}

export interface ChatbotResponse {
  reply: string;
  exportPrompt?: ExportPrompt;
}

export const sendChatMessage = async (message: string): Promise<ChatbotResponse> => {
  const res = await api.post('/chat', { message });
  return {
    reply: res.data.reply,
    exportPrompt: res.data.exportPrompt,
  };
};