import { useEffect, useRef, useState } from 'react';
import { Bot, Send, Sparkles, Trash2 } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { sendChatMessage } from '../api/chat';
import { printLaporanKaryawanTerlambat, downloadLaporanKaryawanTerlambatExcel } from '../api/laporan';

const SUGGESTIONS = [
  'Berapa total karyawan di perusahaan?',
  'Bagaimana cara absen menggunakan QR code?',
  'Siapa saja karyawan di divisi saya?',
  'Jelaskan fitur yang ada di Marimas ONE',
];

function now() {
  return new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function initials(name?: string) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function AiAssistant() {
  const { user } = useAuth();
  const { messages, setMessages, resetChat } = useChat();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const resizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;

    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      text,
      time: now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    requestAnimationFrame(resizeTextarea);

    try {
      const { reply, exportPrompt } = await sendChatMessage(text);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', text: reply, time: now(), exportPrompt },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: 'Maaf, terjadi kesalahan saat menghubungi AI Assistant. Coba lagi beberapa saat lagi.',
          time: now(),
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    resetChat();
  };

  const handlePrintTerlambat = (bulan: number, tahun: number) => {
    // window.open HARUS di sini, di dalam onClick, sebelum ada await —
    // supaya tidak diblokir popup blocker.
    const w = window.open('', '_blank');
    if (!w) return;
    printLaporanKaryawanTerlambat(bulan, tahun, w);
  };

  return (
    <AppLayout title="AI Assistant">
      <div className="flex flex-col h-[calc(100vh-7rem)] max-h-[820px] bg-white border border-slate-200 rounded-xl overflow-hidden">
        {/* HEADER */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Marimas ONE Assistant</p>
              <p className="text-xs text-slate-400">Ditenagai Gemini &middot; siap membantu 24/7</p>
            </div>
          </div>
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-red-600 transition px-3 py-1.5 rounded-lg hover:bg-red-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Bersihkan
          </button>
        </div>

        {/* MESSAGES */}
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex items-start gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
                  m.role === 'user' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {m.role === 'user' ? initials(user?.name) : <Bot className="w-4 h-4" />}
              </div>
              <div className={`max-w-[75%] flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-slate-900 text-white rounded-tr-sm'
                      : m.error
                      ? 'bg-red-50 text-red-700 rounded-tl-sm'
                      : 'bg-slate-100 text-slate-800 rounded-tl-sm'
                  }`}
                >
                  {m.text}
                </div>

                {m.exportPrompt?.jenis === 'karyawan_terlambat' && (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handlePrintTerlambat(m.exportPrompt!.bulan, m.exportPrompt!.tahun)}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition"
                    >
                      Unduh PDF
                    </button>
                    <button
                      onClick={() =>
                        downloadLaporanKaryawanTerlambatExcel(m.exportPrompt!.bulan, m.exportPrompt!.tahun)
                      }
                      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition"
                    >
                      Unduh Excel
                    </button>
                  </div>
                )}

                <span className="text-[10px] text-slate-400 mt-1 px-1">{m.time}</span>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 shrink-0 rounded-full bg-slate-100 flex items-center justify-center">
                <Bot className="w-4 h-4 text-slate-600" />
              </div>
              <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-slate-100 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* SUGGESTIONS */}
        {messages.length <= 1 && (
          <div className="px-5 pb-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => handleSend(s)}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5 hover:bg-slate-100 hover:border-slate-300 transition"
              >
                <Sparkles className="w-3 h-3 text-slate-400" />
                {s}
              </button>
            ))}
          </div>
        )}

        {/* INPUT */}
        <div className="border-t border-slate-200 p-4">
          <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-slate-900">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                resizeTextarea();
              }}
              onKeyDown={handleKeyDown}
              placeholder="Tulis pertanyaan kamu di sini..."
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none py-1.5 max-h-40"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              className="shrink-0 bg-slate-900 text-white p-2.5 rounded-lg hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 px-1">
            Enter untuk kirim &middot; Shift + Enter untuk baris baru
          </p>
        </div>
      </div>
    </AppLayout>
  );
}