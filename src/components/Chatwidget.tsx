import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MessageCircle, X, Send } from 'lucide-react';
import { sendChatMessage } from '../api/chat';
import { useChat, type ChatMessage } from '../context/ChatContext';
import { detectIntent } from '../lib/chatIntent';
import { printLaporanKaryawanTerlambat, downloadLaporanKaryawanTerlambatExcel } from '../api/laporan';

function timeNow() {
  return new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export default function ChatWidget() {
  const { messages, setMessages, isOpen, setIsOpen } = useChat();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleSend = async () => {
    if (!input.trim()) return;
    const userText = input;
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: userText,
      time: timeNow(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const intent = detectIntent(userText);

    try {
      const { reply, exportPrompt } = await sendChatMessage(userText);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', text: reply, time: timeNow(), exportPrompt },
      ]);

      if (intent && location.pathname !== intent.path) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            text: `Saya arahkan kamu ke halaman ${intent.label} ya.`,
            time: timeNow(),
          },
        ]);
        navigate(intent.path);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: 'Maaf, terjadi kesalahan.',
          time: timeNow(),
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintTerlambat = (bulan: number, tahun: number) => {
    // window.open HARUS di sini, di dalam onClick, sebelum ada await —
    // sama seperti pola di Laporan.tsx, supaya tidak diblokir popup blocker.
    const w = window.open('', '_blank');
    if (!w) return;
    printLaporanKaryawanTerlambat(bulan, tahun, w);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen ? (
        <div className="w-80 h-96 bg-white rounded-xl shadow-xl border border-slate-200 flex flex-col overflow-hidden">
          <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-semibold">AI Assistant</span>
            <button onClick={() => setIsOpen(false)}>
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.map((m) => (
              <div key={m.id}>
                <div
                  className={`text-sm px-3 py-2 rounded-lg max-w-[85%] ${
                    m.role === 'user'
                      ? 'bg-slate-900 text-white ml-auto'
                      : m.error
                      ? 'bg-red-50 text-red-600'
                      : 'bg-slate-100 text-slate-800'
                  }`}
                >
                  {m.text}
                </div>

                {m.exportPrompt?.jenis === 'karyawan_terlambat' && (
                  <div className="flex gap-2 mt-1.5">
                    <button
                      onClick={() => handlePrintTerlambat(m.exportPrompt!.bulan, m.exportPrompt!.tahun)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800"
                    >
                      PDF
                    </button>
                    <button
                      onClick={() =>
                        downloadLaporanKaryawanTerlambatExcel(m.exportPrompt!.bulan, m.exportPrompt!.tahun)
                      }
                      className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      Excel
                    </button>
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="text-sm px-3 py-2 rounded-lg bg-slate-100 text-slate-400 w-fit">
                Mengetik...
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 p-2 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Tanya sesuatu..."
              className="flex-1 text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <button
              onClick={handleSend}
              className="bg-slate-900 text-white p-2 rounded-lg hover:bg-slate-800"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-slate-900 text-white p-4 rounded-full shadow-lg hover:bg-slate-800"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}