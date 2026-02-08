import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

interface Message {
  id: string;
  sender: 'visitor' | 'agent' | 'bot';
  text: string;
  createdAt: string;
  senderName?: string;
  senderAvatar?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function WidgetPage() {
  const router = useRouter();
  const { siteKey, visitorId } = router.query as { siteKey?: string; visitorId?: string };
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [widgetName, setWidgetName] = useState('Nemark Inbox');
  const [isTyping, setIsTyping] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Initialize conversation
  useEffect(() => {
    if (!siteKey || !visitorId) return;

    const initConversation = async () => {
      try {
        const response = await fetch(`${API_BASE}/public/widgets/init`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteKey, visitorId })
        });

        if (!response.ok) {
          throw new Error('Failed to initialize chat');
        }

        const data = await response.json();
        setConversationId(data.data.conversationId);
        setWidgetName(data.data.widgetName || 'Nemark Inbox');
        setIsLoading(false);

        // Notify parent of successful load
        notifyParent({ type: 'WIDGET_READY' });
        
        // Add welcome message if new conversation
        if (data.data.created) {
          setMessages([{
            id: 'welcome',
            sender: 'bot',
            senderName: 'AI Assistant',
            text: 'Hi there! 👋 Welcome to Nemark Inbox. I can help you route your request or answer basic questions. How can we help you today?',
            createdAt: new Date().toISOString()
          }]);
        }
        
      } catch (err) {
        console.error('Init error:', err);
        setError('Failed to load chat. Please try again.');
        setIsLoading(false);
      }
    };

    initConversation();
  }, [siteKey, visitorId]);

  // Fetch messages
  const fetchMessages = useCallback(async (afterTimestamp?: string) => {
    if (!conversationId) return;

    try {
      let url = `${API_BASE}/public/widgets/messages/${conversationId}`;
      if (afterTimestamp) {
        url += `?after=${encodeURIComponent(afterTimestamp)}`;
      }

      const response = await fetch(url);
      if (!response.ok) return;

      const data = await response.json();
      
      if (afterTimestamp) {
        if (data.data.items.length > 0) {
          setMessages(prev => [...prev, ...data.data.items]);
          setIsTyping(false);
        }
      } else {
        if (data.data.items.length > 0) {
          setMessages(data.data.items);
        }
      }
    } catch (err) {
      console.error('Fetch messages error:', err);
    }
  }, [conversationId]);

  // Initial message fetch and polling
  useEffect(() => {
    if (!conversationId) return;

    fetchMessages();

    pollIntervalRef.current = setInterval(() => {
      const lastMessage = messages[messages.length - 1];
      fetchMessages(lastMessage?.createdAt);
    }, 3000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [conversationId, fetchMessages, messages]);

  // Send message
  const sendMessage = async () => {
    if (!inputValue.trim() || !conversationId) return;

    const text = inputValue.trim();
    setInputValue('');

    const tempMessage: Message = {
      id: 'temp-' + Date.now(),
      sender: 'visitor',
      text,
      createdAt: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempMessage]);
    setIsTyping(true);

    try {
      const response = await fetch(`${API_BASE}/public/widgets/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          sender: 'visitor',
          text
        })
      });

      if (!response.ok) throw new Error('Send failed');

      const data = await response.json();
      
      setMessages(prev => 
        prev.map(m => m.id === tempMessage.id 
          ? { ...data.data, sender: 'visitor' as const } 
          : m
        )
      );
    } catch (err) {
      console.error('Send error:', err);
      setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const notifyParent = (message: object) => {
    if (window.parent !== window) {
      window.parent.postMessage(message, '*');
    }
  };

  const handleClose = () => {
    notifyParent({ type: 'WIDGET_CLOSE' });
  };

  const handleMinimize = () => {
    notifyParent({ type: 'WIDGET_CLOSE' });
  };

  useEffect(() => {
    notifyParent({ type: 'WIDGET_RESIZE', height: 560, width: 400 });
  }, []);

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full bg-white flex items-center justify-center font-sans">
        <Head>
          <title>Chat Widget</title>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
          <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
        </Head>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-sm text-neutral-500">Loading chat...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-full bg-white flex items-center justify-center font-sans">
        <Head>
          <title>Chat Widget</title>
        </Head>
        <div className="flex flex-col items-center gap-4 p-6">
          <span className="material-symbols-outlined text-4xl text-red-400">error</span>
          <p className="text-sm text-neutral-600">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-white flex flex-col overflow-hidden font-sans relative">
      <Head>
        <title>Chat Widget</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
        <script src="https://cdn.tailwindcss.com"></script>
      </Head>

      <style jsx global>{`
        body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        .animate-bounce-slow { animation: bounce 1.4s infinite; }
        .delay-75 { animation-delay: 0.15s; }
        .delay-150 { animation-delay: 0.3s; }
      `}</style>

      {/* Top accent bar */}
      <div className="h-[3px] w-full bg-blue-600 absolute top-0 left-0 z-20"></div>

      {/* Header */}
      <header className="h-[68px] border-b border-neutral-100 flex items-center justify-between px-5 pt-[3px] bg-white flex-shrink-0 relative z-30">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
              {widgetName.substring(0, 2).toUpperCase()}
            </div>
            <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-white rounded-full flex items-center justify-center">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm text-neutral-900 leading-none">{widgetName}</span>
            <span className="text-[10px] text-neutral-500 font-medium mt-0.5">Online • Replies in ~2m</span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-neutral-400">
          <button 
            className="p-1.5 hover:bg-neutral-100 rounded text-neutral-400 hover:text-neutral-600 transition-colors" 
            title="Pop-out"
          >
            <span className="material-symbols-outlined text-[20px]">open_in_new</span>
          </button>
          <button 
            onClick={handleMinimize}
            className="p-1.5 hover:bg-neutral-100 rounded text-neutral-400 hover:text-neutral-600 transition-colors" 
            title="Minimize"
          >
            <span className="material-symbols-outlined text-[20px]">remove</span>
          </button>
          <button 
            onClick={handleClose}
            className="p-1.5 hover:bg-neutral-100 rounded text-neutral-400 hover:text-neutral-600 transition-colors" 
            title="Close"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 bg-white overflow-y-auto p-5 space-y-6 scroll-smooth relative no-scrollbar">
        {/* Date separator */}
        <div className="flex justify-center">
          <span className="text-[10px] font-medium text-neutral-400 bg-neutral-50 px-2 py-1 rounded-full">Today</span>
        </div>

        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.sender === 'visitor' ? (
              // Visitor message (right aligned)
              <div className="flex gap-3 flex-row-reverse items-end group">
                <div className="flex flex-col gap-1 items-end max-w-[85%]">
                  <div className="bg-blue-50 text-neutral-900 p-3.5 rounded-2xl rounded-br-none text-[13.5px] shadow-sm border border-blue-100/50 leading-relaxed">
                    {msg.text}
                  </div>
                  <span className="text-[9px] text-neutral-300 pr-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
              </div>
            ) : msg.sender === 'bot' ? (
              // Bot message
              <div className="flex gap-3 items-end group">
                <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600 shadow-sm">
                  <span className="material-symbols-outlined text-[16px]">smart_toy</span>
                </div>
                <div className="flex flex-col gap-1 max-w-[85%]">
                  <div className="flex items-baseline gap-2 ml-1">
                    <span className="text-[10px] font-bold text-neutral-500">{msg.senderName || 'AI Assistant'}</span>
                  </div>
                  <div className="bg-white border border-neutral-200 text-neutral-800 p-3.5 rounded-2xl rounded-bl-none text-[13.5px] shadow-sm leading-relaxed">
                    {msg.text}
                  </div>
                  <span className="text-[9px] text-neutral-300 pl-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
              </div>
            ) : (
              // Agent message
              <div className="flex gap-3 items-end group">
                <div className="w-8 h-8 rounded-full bg-white border border-neutral-200 flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden">
                  {msg.senderAvatar ? (
                    <img src={msg.senderAvatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-[16px] text-neutral-400">support_agent</span>
                  )}
                </div>
                <div className="flex flex-col gap-1 max-w-[85%]">
                  <div className="flex items-baseline gap-2 ml-1">
                    <span className="text-[10px] font-bold text-neutral-700">{msg.senderName || 'Support Agent'}</span>
                  </div>
                  <div className="bg-white border border-neutral-200 text-neutral-800 p-3.5 rounded-2xl rounded-bl-none text-[13.5px] shadow-sm group-hover:shadow-md transition-shadow leading-relaxed">
                    {msg.text}
                  </div>
                  <span className="text-[9px] text-neutral-300 pl-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex gap-3 items-end">
            <div className="w-8 h-8 flex-shrink-0"></div>
            <div className="bg-white border border-neutral-200 px-4 py-3 rounded-2xl rounded-bl-none flex items-center gap-1 shadow-sm">
              <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce-slow"></div>
              <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce-slow delay-75"></div>
              <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce-slow delay-150"></div>
            </div>
          </div>
        )}

        <div className="h-32" ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="absolute bottom-0 left-0 w-full bg-white z-40 flex flex-col shadow-[0_-8px_30px_-6px_rgba(0,0,0,0.08)] rounded-b-xl">
        <div className="p-4 bg-white">
          <textarea 
            ref={inputRef}
            className="w-full text-sm text-neutral-800 placeholder-neutral-400 bg-transparent border-none focus:ring-0 resize-none min-h-[44px] px-0 py-0 no-scrollbar leading-relaxed outline-none"
            placeholder="Type a message..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            rows={1}
          />
          <div className="flex justify-between items-center mt-3 pt-2 border-t border-neutral-100">
            <div className="flex items-center gap-1 -ml-2">
              <button className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-neutral-600 rounded-full hover:bg-neutral-50 transition-colors" title="Emoji">
                <span className="material-symbols-outlined text-[20px]">sentiment_satisfied</span>
              </button>
              <button className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-neutral-600 rounded-full hover:bg-neutral-50 transition-colors" title="Attach">
                <span className="material-symbols-outlined text-[20px]">attach_file</span>
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[9px] font-medium text-neutral-300 hidden sm:inline-block">Enter to send</span>
              <button 
                onClick={sendMessage}
                disabled={!inputValue.trim()}
                className="w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-300 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 disabled:shadow-none transition-all hover:scale-105 active:scale-95 disabled:hover:scale-100"
              >
                <span className="material-symbols-outlined text-[18px] ml-0.5">send</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Disable layout for widget page
WidgetPage.getLayout = (page: React.ReactElement) => page;
