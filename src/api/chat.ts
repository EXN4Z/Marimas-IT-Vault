import api from './axios';

export interface ExportPrompt {
  jenis: 'absensi_status';
  status: 'telat' | 'tepat_waktu';
  tanggal_mulai: string;
  tanggal_selesai: string;
  label: string;
}

export interface ChatbotResponse {
  reply: string;
  exportPrompt?: ExportPrompt;
}

export const sendChatMessage = async (
  message: string,
  previousExport?: ExportPrompt
): Promise<ChatbotResponse> => {
  const res = await api.post('/chat', { message, previous_export: previousExport ?? null });
  return {
    reply: res.data.reply,
    exportPrompt: res.data.exportPrompt,
  };
};