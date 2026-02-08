import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useConversation } from '@/contexts/ConversationContext';
import { useMyStore } from '@/contexts/MyStoreContext';
import { assignConversation } from '@/services/conversation.service';
import { formatTime, formatDateSeparator } from '@/utils/date';
import { Message } from '@/services/conversation.service';
import { Virtuoso, VirtuosoHandle, Components } from 'react-virtuoso';
import api from '@/lib/http';

// Type for the flat list items (Message or Date Separator)
type ChatItem =
  | { type: 'message'; data: Message }
  | { type: 'date'; date: string }
  | { type: 'typing'; visitorId: string };

export const ChatArea = () => {
  const {
    selectedConversation,
    messages,
    isLoadingMessages,
    sendMessage,
    isSending,
    typingVisitor,
    hasMoreMessages,
    loadMoreMessages,
    isLoadingOlderMessages,
  } = useConversation();

  const { user, activeWorkspace } = useMyStore();
  const [inputText, setInputText] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Zalo connection status check
  const [zaloConnected, setZaloConnected] = useState<boolean | null>(null);
  const [pastedImage, setPastedImage] = useState<File | null>(null);

  // Assignment Logic
  const isAssigned = !!selectedConversation?.assignedUserKey;
  const isAssignedToMe = user && selectedConversation?.assignedUserKey === Number(user.UserKey);
  const isLocked = isAssigned && !isAssignedToMe;

  // Check if this is a Zalo conversation
  const isZaloConversation = selectedConversation?.widgetName?.toLowerCase().includes('zalo') ||
    (selectedConversation as any)?.source?.toLowerCase() === 'zalo' ||
    selectedConversation?.widgetName?.toLowerCase().includes('personal');

  // Disable send if Zalo conversation but not connected
  const isZaloDisconnected = isZaloConversation && zaloConnected === false;

  // Check Zalo connection status when conversation changes
  useEffect(() => {
    const checkZaloConnection = async () => {
      if (!activeWorkspace || !isZaloConversation) {
        setZaloConnected(null);
        return;
      }

      try {
        const res = await api.get(`/zalo-personal/accounts/${activeWorkspace.workspaceId}`);
        const accounts = res.data?.data || [];
        // Check if any account is connected (has status 'connected' or similar)
        const hasConnected = accounts.some((acc: { status?: string; isConnected?: boolean }) =>
          acc.status === 'connected' || acc.isConnected === true
        );
        setZaloConnected(hasConnected || accounts.length > 0);
      } catch (error) {
        console.error('Failed to check Zalo connection:', error);
        setZaloConnected(false);
      }
    };

    checkZaloConnection();
  }, [activeWorkspace, isZaloConversation, selectedConversation?.conversationId]);

  // Handle image paste (Ctrl+V)
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          setPastedImage(file);
          return;
        }
      }
    }
  }, []);

  // Clear pasted image
  const clearPastedImage = useCallback(() => {
    setPastedImage(null);
  }, []);

  // Send pasted image to Zalo
  const [isSendingImage, setIsSendingImage] = useState(false);

  const sendPastedImage = useCallback(async () => {
    if (!pastedImage || !selectedConversation || !activeWorkspace || isSendingImage) return;

    // Get thread ID (visitorId for Zalo conversations)
    const threadId = selectedConversation.visitorId;
    if (!threadId) {
      alert('Không tìm thấy thread ID để gửi ảnh');
      return;
    }

    setIsSendingImage(true);

    try {
      const formData = new FormData();
      formData.append('image', pastedImage, pastedImage.name || 'pasted_image.png');
      formData.append('threadId', threadId);
      formData.append('workspaceId', activeWorkspace.workspaceId);
      formData.append('conversationId', selectedConversation.conversationId);

      const response = await api.post('/zalo-personal/send-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data?.success) {
        console.log('[ChatArea] Image sent successfully:', response.data);
        clearPastedImage();
        // Message will appear via socket update
      } else {
        throw new Error(response.data?.error || 'Failed to send image');
      }
    } catch (error: any) {
      console.error('[ChatArea] Send image error:', error);
      alert(`Lỗi gửi ảnh: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsSendingImage(false);
    }
  }, [pastedImage, selectedConversation, activeWorkspace, isSendingImage, clearPastedImage]);

  // Get preview URL for pasted image
  const pastedImageUrl = pastedImage ? URL.createObjectURL(pastedImage) : null;

  const handleAssign = async () => {
    if (!selectedConversation || !user || isAssigning) return;
    try {
      setIsAssigning(true);
      // Assuming workspaceId is available in selectedConversation or context
      // But context only exposes sendMessage. I imported assignConversation service.
      // I need workspaceId. selectedConversation usually has workspaceId?
      // Let's check conversation interface ... yes it has workspaceId.
      if (selectedConversation.workspaceId) {
        await assignConversation(selectedConversation.workspaceId, selectedConversation.conversationId, user.UserKey);
        // Force refresh? Context should update via socket/polling?
        // Ideally backend emits update. I'll assume it does or optimistic update needed.
      }
    } catch (e) {
      console.error('Failed to assign', e);
    } finally {
      setIsAssigning(false);
    }
  };

  // Flatten messages and inject date separators
  const chatItems = useMemo(() => {
    const items: ChatItem[] = [];
    if (!messages.length) return items;

    let currentDate = '';

    messages.forEach((msg) => {
      const msgDate = new Date(msg.createdAt).toDateString();
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        items.push({ type: 'date', date: msg.createdAt });
      }
      items.push({ type: 'message', data: msg });
    });

    // Add typing indicator at the bottom if active
    if (typingVisitor && selectedConversation && typingVisitor === selectedConversation.visitorId) {
      items.push({ type: 'typing', visitorId: typingVisitor });
    }

    return items;
  }, [messages, typingVisitor, selectedConversation]);

  // Handle send message
  const handleSend = useCallback(async () => {
    if (!inputText.trim() || isSending) return;

    const text = inputText;
    setInputText('');

    try {
      await sendMessage(text);
      // Scroll to bottom after sending
      // setTimeout(() => virtuosoRef.current?.scrollToIndex({ index: chatItems.length - 1, align: 'end', behavior: 'smooth' }), 50);
    } catch (error) {
      setInputText(text);
      console.error('Failed to send message:', error);
    }
  }, [inputText, isSending, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getInitials = (name: string | null): string => {
    if (!name) return '?';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getVisitorName = (): string => {
    if (!selectedConversation) return 'Visitor';
    return selectedConversation.visitorName || `Visitor ${selectedConversation.visitorId?.slice(-6) || ''}`;
  };

  // ========== ZALO MESSAGE TYPE PARSING ==========
  type ZaloMessageType =
    | { type: 'text'; content: string }
    | { type: 'sticker'; data: { id: number; catId: number; url?: string } }
    | { type: 'link'; data: { title: string; href: string; thumb?: string; description?: string } }
    | { type: 'image'; data: { thumb?: string; hdUrl?: string; url?: string } }
    | { type: 'file'; data: { fileName: string; fileSize?: number; url?: string } };

  const parseZaloMessage = (text: string): ZaloMessageType => {
    if (!text) return { type: 'text', content: text || '' };

    // Trim whitespace and newlines for pattern matching
    const trimmedText = text.trim();

    // Helper to clean up escaped unicode and malformed JSON fragments
    const cleanText = (str: string): string => {
      return str
        .replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n')
        .replace(/\\"([^"]+)\\"/g, '"$1"');
    };

    // ========== SIMPLE CHECK: Handle markdown-style format from backend ==========
    // Use includes() first for fast check, then extract URL

    // DEBUG: Log what we're parsing
    console.log('[parseZaloMessage] Input text:', trimmedText);

    // Sticker: [Sticker](url)
    if (trimmedText.includes('[Sticker]')) {
      console.log('[parseZaloMessage] Detected sticker pattern');
      const urlMatch = trimmedText.match(/\[Sticker\]\(([^)]+)\)/);
      if (urlMatch && urlMatch[1]) {
        const url = urlMatch[1];
        const idMatch = url.match(/\/(\d+)_w\d+\.webp/);
        const stickerId = idMatch ? parseInt(idMatch[1], 10) : 0;
        return { type: 'sticker', data: { id: stickerId, catId: 0, url } };
      }
    }

    // Image: [Image](url) 
    if (trimmedText.includes('[Image]')) {
      const urlMatch = trimmedText.match(/\[Image\]\(([^)]+)\)/);
      if (urlMatch && urlMatch[1]) {
        return { type: 'image', data: { hdUrl: urlMatch[1], thumb: urlMatch[1], url: urlMatch[1] } };
      }
    }

    // GIF: [GIF](url)
    if (trimmedText.includes('[GIF]')) {
      const urlMatch = trimmedText.match(/\[GIF\]\(([^)]+)\)/);
      if (urlMatch && urlMatch[1]) {
        return { type: 'image', data: { hdUrl: urlMatch[1], thumb: urlMatch[1], url: urlMatch[1] } };
      }
    }

    // Link: [Link: title](url)
    if (trimmedText.includes('[Link:')) {
      const linkMatch = trimmedText.match(/\[Link:\s*([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch && linkMatch[1] && linkMatch[2]) {
        return { type: 'link', data: { title: linkMatch[1].trim(), href: linkMatch[2] } };
      }
    }

    // File: [File: filename](url)
    if (trimmedText.includes('[File:')) {
      const fileMatch = trimmedText.match(/\[File:\s*([^\]]+)\]\(([^)]+)\)/);
      if (fileMatch && fileMatch[1] && fileMatch[2]) {
        return { type: 'file', data: { fileName: fileMatch[1].trim(), url: fileMatch[2] } };
      }
    }

    // Voice: [Voice: Ns](url)
    if (trimmedText.includes('[Voice:')) {
      const voiceMatch = trimmedText.match(/\[Voice:\s*(\d+)s\]\(([^)]+)\)/);
      if (voiceMatch && voiceMatch[1] && voiceMatch[2]) {
        return { type: 'file', data: { fileName: `Tin nhắn thoại (${voiceMatch[1]}s)`, url: voiceMatch[2] } };
      }
    }

    // Location: [Location](url)
    if (trimmedText.includes('[Location]')) {
      const locMatch = trimmedText.match(/\[Location\]\(([^)]+)\)/);
      if (locMatch && locMatch[1]) {
        return { type: 'link', data: { title: '📍 Vị trí', href: locMatch[1] } };
      }
    }

    // ========== LEGACY: Handle JSON format ==========

    // Check if this looks like corrupted/malformed JSON (contains JSON-like patterns but doesn't start with {)
    const looksLikeCorruptedJson = !text.startsWith('{') && (
      text.includes('"title"') ||
      text.includes('"href"') ||
      text.includes('"src"') ||
      text.includes('\\u') ||
      text.includes('\\"')
    );

    if (looksLikeCorruptedJson) {
      // Try to extract meaningful text from corrupted JSON
      // Pattern: extract text before first JSON-like pattern
      const cleanedText = cleanText(text);

      // Extract title-like content (text before " - " or first quote)
      const titleMatch = cleanedText.match(/^([^"{}[\]]+?)(?:\s*[-–—]\s*|\s*[",{])/);
      if (titleMatch && titleMatch[1].trim().length > 5) {
        return { type: 'text', content: titleMatch[1].trim() };
      }

      // Just clean and return
      return { type: 'text', content: cleanedText.replace(/[{}"\[\]]/g, ' ').replace(/\s+/g, ' ').trim() };
    }

    try {
      if (text.startsWith('{')) {
        // Try to fix double-escaped JSON
        let jsonText = text;
        if (text.includes('\\"') || text.includes('\\u')) {
          jsonText = cleanText(text);
        }

        const parsed = JSON.parse(jsonText);

        // ========== NEW: Check for explicit _type from backend ==========
        if (parsed._type) {
          switch (parsed._type) {
            case 'image':
              return { type: 'image', data: { thumb: parsed.thumb, hdUrl: parsed.hdUrl || parsed.normalUrl, url: parsed.url } };
            case 'sticker':
              return { type: 'sticker', data: { id: parsed.id, catId: parsed.catId } };
            case 'link':
              return { type: 'link', data: { title: cleanText(parsed.title || ''), href: parsed.href, thumb: parsed.thumb, description: parsed.description } };
            case 'file':
              return { type: 'file', data: { fileName: parsed.fileName, fileSize: parsed.fileSize, url: parsed.url } };
          }
        }

        // ========== FALLBACK: Auto-detection for legacy messages ==========
        // Sticker (type 7)
        if (parsed.id && parsed.catId && parsed.type === 7) {
          return { type: 'sticker', data: { id: parsed.id, catId: parsed.catId } };
        }

        // Link preview (title + href)
        if (parsed.title && parsed.href) {
          return {
            type: 'link', data: {
              title: cleanText(parsed.title),
              href: parsed.href,
              thumb: parsed.thumb || parsed.src,
              description: parsed.description ? cleanText(parsed.description) : (parsed.mediaTitle ? cleanText(parsed.mediaTitle) : undefined)
            }
          };
        }

        // Image (thumb or hdUrl)
        if (parsed.thumb || parsed.hdUrl || (parsed.params && parsed.params.photoId)) {
          return {
            type: 'image', data: {
              thumb: parsed.thumb,
              hdUrl: parsed.hdUrl || parsed.normalUrl,
              url: parsed.url
            }
          };
        }

        // File (fileName)
        if (parsed.fileName) {
          return {
            type: 'file', data: {
              fileName: parsed.fileName,
              fileSize: parsed.fileSize,
              url: parsed.url || parsed.href
            }
          };
        }
      }
    } catch {
      // If JSON parse fails, try to extract clean text
      const cleanedText = cleanText(text);
      if (cleanedText !== text) {
        return { type: 'text', content: cleanedText.replace(/[{}"\[\]]/g, ' ').replace(/\s+/g, ' ').trim() };
      }
    }

    return { type: 'text', content: text };
  };

  // ========== ZALO MESSAGE RENDERERS ==========

  // Sticker Component
  const ZaloSticker: React.FC<{ stickerId: number; catId: number; url?: string }> = ({ stickerId, catId, url }) => {
    // Use provided URL directly if available, otherwise build from stickerId
    const stickerUrl = url || `https://zalo-api.zadn.vn/api/emoticon/sticker/webpc/${stickerId}_w120.webp`;
    return (
      <img
        src={stickerUrl}
        alt="Sticker"
        className="w-24 h-24 object-contain"
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          if (!target.dataset.fallback) {
            target.dataset.fallback = '1';
            target.src = `https://zalo-api.zadn.vn/api/emoticon/sticker/${catId}/${stickerId}@2x.png`;
          }
        }}
      />
    );
  };

  // Link Preview Component
  const ZaloLinkPreview: React.FC<{ data: { title: string; href: string; thumb?: string; description?: string } }> = ({ data }) => (
    <a
      href={data.href}
      target="_blank"
      rel="noopener noreferrer"
      className="block border border-neutral-200 rounded-lg overflow-hidden hover:bg-neutral-50 transition-colors max-w-xs"
    >
      {data.thumb && (
        <img src={data.thumb} alt="" className="w-full h-32 object-cover" onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
      )}
      <div className="p-3">
        <div className="font-medium text-sm text-neutral-900 line-clamp-2">{data.title}</div>
        {data.description && <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{data.description}</p>}
        <p className="text-xs text-primary-500 mt-2 truncate">{new URL(data.href).hostname}</p>
      </div>
    </a>
  );

  // Image Component
  const ZaloImage: React.FC<{ data: { thumb?: string; hdUrl?: string; url?: string } }> = ({ data }) => {
    const imgUrl = data.hdUrl || data.thumb || data.url;
    if (!imgUrl) return <span className="text-neutral-400">[Ảnh không khả dụng]</span>;
    return (
      <img
        src={imgUrl}
        alt="Ảnh"
        className="max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
        onClick={() => window.open(imgUrl, '_blank')}
      />
    );
  };

  // File Component
  const ZaloFile: React.FC<{ data: { fileName: string; fileSize?: number; url?: string } }> = ({ data }) => (
    <a
      href={data.url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-3 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
    >
      <span className="material-symbols-outlined text-2xl text-primary-500">attach_file</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-neutral-900 truncate">{data.fileName}</div>
        {data.fileSize && <div className="text-xs text-neutral-500">{(data.fileSize / 1024).toFixed(1)} KB</div>}
      </div>
    </a>
  );

  // Main render function
  const renderMessageContent = (text: string) => {
    const parsed = parseZaloMessage(text);

    switch (parsed.type) {
      case 'sticker':
        return <ZaloSticker stickerId={parsed.data.id} catId={parsed.data.catId} url={parsed.data.url} />;
      case 'link':
        return <ZaloLinkPreview data={parsed.data} />;
      case 'image':
        return <ZaloImage data={parsed.data} />;
      case 'file':
        return <ZaloFile data={parsed.data} />;
      default:
        return <span className="whitespace-pre-wrap">{parsed.content}</span>;
    }
  };

  // Render Row
  const renderItem = (index: number, item: ChatItem) => {
    if (item.type === 'date') {
      return (
        <div className="flex justify-center py-4">
          <span className="text-xs text-neutral-400 bg-neutral-100 px-3 py-1 rounded-full">
            {formatDateSeparator(item.date)}
          </span>
        </div>
      );
    }

    if (item.type === 'typing') {
      const initials = getInitials(selectedConversation?.visitorName || null);
      return (
        <div className="flex gap-3 mb-6 px-6 animate-fade-up">
          <div className="avatar-enterprise flex-shrink-0 mt-1" style={{ width: '32px', height: '32px', fontSize: '0.75rem' }}>
            {initials}
          </div>
          <div className="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      )
    }

    const msg = item.data;
    const isAgent = msg.sender === 'agent' || msg.senderType === 2;
    const initials = getInitials(selectedConversation?.visitorName || null);
    const vName = getVisitorName();

    if (isAgent) {
      return (
        <div className="flex gap-2 mb-4 px-3 md:px-6 justify-end group animate-fade-up">
          <div className="max-w-[85%] md:max-w-[75%] flex flex-col items-end">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-[10px] md:text-[11px] text-slate-400 font-medium">{formatTime(msg.createdAt)}</span>
              <span className="text-xs font-semibold text-slate-700">You</span>
            </div>
            <div className="message-bubble-agent text-sm leading-relaxed">
              {renderMessageContent(msg.text)}
            </div>
          </div>
          <div className="avatar-enterprise flex-shrink-0 mt-1 hidden md:flex" style={{ width: '32px', height: '32px', fontSize: '0.75rem' }}>
            A
          </div>
        </div>
      );
    } else {
      return (
        <div className="flex gap-2 mb-4 px-3 md:px-6 group animate-fade-up">
          <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-slate-600 flex items-center justify-center text-[10px] md:text-xs font-semibold flex-shrink-0 mt-1 shadow-sm">
            {initials}
          </div>
          <div className="max-w-[85%] md:max-w-[75%]">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-xs font-semibold text-slate-700">{vName}</span>
              <span className="text-[10px] md:text-[11px] text-slate-400 font-medium">{formatTime(msg.createdAt)}</span>
            </div>
            <div className="message-bubble-visitor text-sm leading-relaxed">
              {renderMessageContent(msg.text)}
            </div>
          </div>
        </div>
      );
    }
  };

  const Header = () => (
    isLoadingOlderMessages ? <div className="flex justify-center py-4"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-500"></div></div> : null
  );

  // START_INDEX for Virtuoso to handle prepending
  // We offset it by a large number so index 0 is at 10000 (roughly)
  // When we prepend 50 items, the new first item is at 9950.
  // Virtuoso preserves the scroll position relative to the items.
  const START_INDEX = 10000;
  const firstItemIndex = Math.max(0, START_INDEX - chatItems.length);

  // Empty state
  if (!selectedConversation) {
    return (
      <div className="flex-1 flex flex-col bg-gradient-to-b from-slate-50 to-white h-full relative z-0 items-center justify-center">
        <div className="empty-state-enterprise animate-fade-up">
          <div className="empty-state-enterprise-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <h3>Select a conversation</h3>
          <p>Choose a conversation from the list to start chatting with your customers</p>
        </div>
      </div>
    );
  }

  const isOpen = selectedConversation.status === 1;
  const visitorName = getVisitorName();
  const visitorInitials = getInitials(selectedConversation.visitorName);

  return (
    <div className="flex-1 flex flex-col bg-white h-full relative z-0 min-w-0 overflow-hidden">
      {/* Header */}
      <div className="h-16 px-6 border-b border-neutral-200 flex items-center justify-between flex-shrink-0 bg-white shadow-sm z-10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-sm font-bold">
            {visitorInitials}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-neutral-900">{visitorName}</h2>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${isOpen ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-500'}`}>
                {isOpen ? 'Open' : 'Closed'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-neutral-500 mt-0.5">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-primary-500">chat</span>
                {selectedConversation.workspaceName || selectedConversation.widgetName || 'Live Chat'}
              </span>
              {selectedConversation.assignedAgentName && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-primary-600 font-medium">
                    <span className="material-symbols-outlined text-[14px]">person</span>
                    {selectedConversation.assignedAgentName}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!isAssigned && isOpen && (
            <button
              onClick={handleAssign}
              disabled={isAssigning}
              className="px-3 py-1.5 bg-primary-50 text-primary-600 hover:bg-primary-100 rounded-md text-sm font-semibold transition-colors border border-primary-200 flex items-center gap-1"
            >
              {isAssigning ? 'Joining...' : 'Claim Chat'}
            </button>
          )}
          <button className="p-2 text-neutral-400 hover:text-green-600 rounded hover:bg-neutral-50">
            <span className="material-symbols-outlined text-[20px]">check_circle</span>
          </button>
          <button className="p-2 text-neutral-400 hover:text-neutral-600 rounded hover:bg-neutral-50">
            <span className="material-symbols-outlined text-[20px]">more_vert</span>
          </button>
        </div>
      </div>

      {/* Messages Area with Virtuoso */}
      <div className="flex-1 bg-neutral-50 relative">
        {isLoadingMessages && chatItems.length === 0 ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : chatItems.length === 0 ? (
          <div className="flex justify-center items-center h-full">
            <div className="text-center text-neutral-400">
              <span className="material-symbols-outlined text-4xl mb-2 block">chat_bubble_outline</span>
              <p className="text-sm">No messages yet</p>
            </div>
          </div>
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            style={{ height: '100%' }}
            data={chatItems}
            firstItemIndex={firstItemIndex}
            initialTopMostItemIndex={chatItems.length - 1} // Start at bottom
            startReached={loadMoreMessages} // Trigger when scrolling up
            itemContent={renderItem}
            followOutput="smooth" // Auto-scroll on new messages
            components={{ Header }}
            atBottomThreshold={50} // 50px offset stickiness
          />
        )}
      </div>

      {/* Input Area - Premium Enterprise Design */}
      <div className="p-4 bg-gradient-to-t from-slate-50 to-white border-t border-slate-200">
        {/* Zalo Disconnected Warning */}
        {isZaloDisconnected && (
          <div className="mb-3 p-3 badge-warning rounded-lg flex items-center gap-2 border border-amber-200/50">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <span className="text-xs">Zalo chưa kết nối. Vui lòng kết nối tài khoản Zalo trong <a href="/workspace/settings/zalo-personal" className="underline font-semibold hover:text-amber-800 transition-colors">Cài đặt</a>.</span>
          </div>
        )}
        <div className="chat-input-container">
          <div className="flex items-center gap-1 p-2 border-b border-slate-100">
            {/* Attachment Button */}
            <button className="icon-btn" title="Attach file">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
              </svg>
            </button>
            {/* Emoji Button */}
            <button className="icon-btn" title="Emoji">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                <line x1="9" y1="9" x2="9.01" y2="9"></line>
                <line x1="15" y1="9" x2="15.01" y2="9"></line>
              </svg>
            </button>
            {/* Template Button */}
            <button className="icon-btn" title="Quick replies">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>
            </button>

            {/* Status Indicators */}
            {isLocked && (
              <span className="text-xs badge-error ml-auto flex items-center gap-1.5 px-2 py-1 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                Assigned to {selectedConversation.assignedAgentName}
              </span>
            )}
            {isZaloDisconnected && !isLocked && (
              <span className="text-xs badge-warning ml-auto flex items-center gap-1.5 px-2 py-1 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
                  <line x1="12" y1="2" x2="12" y2="12"></line>
                </svg>
                Zalo chưa kết nối
              </span>
            )}
          </div>

          {/* Image Preview Panel */}
          {pastedImage && pastedImageUrl && (
            <div className="p-3 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-start gap-3">
                <div className="relative group">
                  <img
                    src={pastedImageUrl}
                    alt="Preview"
                    className="w-20 h-20 object-cover rounded-lg border border-slate-200 shadow-sm"
                  />
                  <button
                    onClick={clearPastedImage}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm"
                    title="Remove image"
                    disabled={isSendingImage}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-slate-700">{pastedImage.name || 'Pasted image'}</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded font-medium">
                      {(pastedImage.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  <button
                    onClick={sendPastedImage}
                    disabled={isSendingImage || isZaloDisconnected}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSendingImage ? (
                      <>
                        <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Đang gửi...
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="22" y1="2" x2="11" y2="13"></line>
                          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                        Gửi ảnh
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}


          <textarea
            ref={textareaRef}
            className="block w-full border-0 bg-transparent p-4 text-sm text-slate-800 placeholder-slate-400 focus:ring-0 resize-none min-h-[90px] focus:outline-none disabled:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            placeholder={isZaloDisconnected ? "Kết nối Zalo để nhắn tin..." : isLocked ? "This conversation is assigned to another agent." : "Write a message... (Shift+Enter for new line)"}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            disabled={isSending || !isOpen || isLocked || isZaloDisconnected}
          />
          <div className="flex justify-between items-center p-3 pt-0">
            <span className="text-[11px] text-slate-400 font-medium pl-1">Press <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 text-[10px] font-semibold">Enter</kbd> to send</span>
            <button
              onClick={handleSend}
              disabled={!inputText.trim() || isSending || !isOpen || isLocked || isZaloDisconnected}
              className={`btn-enterprise text-sm flex items-center gap-2 ${!inputText.trim() || isSending || !isOpen || isLocked || isZaloDisconnected ? '!bg-slate-200 !shadow-none cursor-not-allowed' : ''}`}
              style={{ padding: '0.5rem 1rem' }}
            >
              {isSending ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Sending...
                </>
              ) : (
                <>
                  Send
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
        {!isOpen && <div className="mt-3 text-center text-xs text-slate-500 bg-slate-100 p-2 rounded-lg">This conversation is closed.</div>}
      </div>
    </div>
  );
};
