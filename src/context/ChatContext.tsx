import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  time: string;
  error?: boolean;
}

export const CHAT_STORAGE_KEY = 'marimas_ai_chat_history';

function timeNow() {
  return new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function welcomeMessage(): ChatMessage {
  return {
    id: 'welcome',
    role: 'assistant',
    text: 'Halo! Saya AI Assistant Marimas ONE. Tanyakan apa saja seputar absensi, data karyawan, atau inventaris.',
    time: timeNow(),
  };
}

function loadInitialMessages(): ChatMessage[] {
  try {
    const stored = localStorage.getItem(CHAT_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // localStorage tidak tersedia / data korup, abaikan dan mulai dari welcome message
  }
  return [welcomeMessage()];
}

interface ChatContextType {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  resetChat: () => void;
  isOpen: boolean; // TAMBAH: status buka/tutup panel, biar gak balik ketutup pas pindah halaman
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

// Provider ini sengaja diletakkan di atas <Routes> (lihat App.tsx) supaya
// TIDAK ikut ter-unmount saat pindah halaman/sidebar. Dengan begitu state
// percakapan tetap hidup selama sesi berjalan, dan hanya direset lewat
// tombol "Bersihkan" (resetChat) atau saat logout.
export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>(loadInitialMessages);
  const [isOpen, setIsOpen] = useState(false); // TAMBAH

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // storage penuh/tidak tersedia, biarkan saja — chat tetap jalan di memori
    }
  }, [messages]);

  const resetChat = () => {
    setMessages([
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: 'Riwayat percakapan sudah dibersihkan. Ada yang bisa saya bantu?',
        time: timeNow(),
      },
    ]);
  };

  return (
    <ChatContext.Provider value={{ messages, setMessages, resetChat, isOpen, setIsOpen }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used within ChatProvider');
  return context;
}