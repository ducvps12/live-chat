import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useConversation } from '@/contexts/ConversationContext';
import { formatTime, formatDateSeparator } from '@/utils/date';
import { Message } from '@/services/conversation.service';
import { Virtuoso, VirtuosoHandle, Components } from 'react-virtuoso';

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

  const [inputText, setInputText] = useState('');
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
        <div className="flex gap-3 mb-6 px-6">
          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1">
            {initials}
          </div>
          <div className="bg-white border border-neutral-200 p-3 rounded-2xl rounded-tl-none shadow-sm">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
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
        <div className="flex gap-3 mb-6 px-6 justify-end group">
          <div className="max-w-[75%] flex flex-col items-end">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-[10px] text-neutral-400">{formatTime(msg.createdAt)}</span>
              <span className="text-xs font-bold text-neutral-900">You</span>
            </div>
            <div className="bg-primary-600 text-white p-3 rounded-2xl rounded-tr-none shadow-sm text-sm leading-relaxed whitespace-pre-wrap">
              {msg.text}
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1">
            A
          </div>
        </div>
      );
    } else {
      return (
        <div className="flex gap-3 mb-6 px-6 group">
          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1">
            {initials}
          </div>
          <div className="max-w-[75%]">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-xs font-bold text-neutral-900">{vName}</span>
              <span className="text-[10px] text-neutral-400">{formatTime(msg.createdAt)}</span>
            </div>
            <div className="bg-white border border-neutral-200 p-3 rounded-2xl rounded-tl-none shadow-sm text-sm text-neutral-800 leading-relaxed whitespace-pre-wrap">
              {msg.text}
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
      <div className="flex-1 flex flex-col bg-neutral-50 h-full relative z-0 items-center justify-center">
        <div className="text-center text-neutral-400">
          <span className="material-symbols-outlined text-6xl mb-4 block">forum</span>
          <h3 className="text-lg font-medium text-neutral-600 mb-2">Select a conversation</h3>
          <p className="text-sm">Choose a conversation from the list to start chatting</p>
        </div>
      </div>
    );
  }

  const isOpen = selectedConversation.status === 1;
  const visitorName = getVisitorName();
  const visitorInitials = getInitials(selectedConversation.visitorName);

  return (
    <div className="flex-1 flex flex-col bg-white h-full relative z-0">
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
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
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

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-neutral-200">
        <div className="relative rounded-xl border border-neutral-300 shadow-sm focus-within:ring-1 focus-within:ring-primary-500 focus-within:border-primary-500 bg-white transition-all">
          <div className="flex items-center gap-1 p-2 border-b border-neutral-100 bg-neutral-50/50 rounded-t-xl">
            <button className="p-1.5 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded transition-colors"><span className="material-symbols-outlined text-[18px]">flash_on</span></button>
            <button className="p-1.5 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded transition-colors"><span className="material-symbols-outlined text-[18px]">lock</span></button>
          </div>
          <textarea
            ref={textareaRef}
            className="block w-full border-0 bg-transparent p-3 text-sm text-neutral-900 placeholder-neutral-400 focus:ring-0 resize-none min-h-[80px] focus:outline-none"
            placeholder="Type your message... (Shift+Enter for new line)"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSending || !isOpen}
          />
          <div className="flex justify-between items-center p-2">
            <span className="text-[10px] text-neutral-400 pl-1">Press <strong>Enter</strong> to send</span>
            <button
              onClick={handleSend}
              disabled={!inputText.trim() || isSending || !isOpen}
              className={`px-4 py-1.5 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm flex items-center gap-2 ${!inputText.trim() || isSending || !isOpen ? 'bg-neutral-300 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700'}`}
            >
              {isSending ? 'Sending...' : <>Send <span className="material-symbols-outlined text-[16px]">send</span></>}
            </button>
          </div>
        </div>
        {!isOpen && <div className="mt-2 text-center text-xs text-neutral-500">This conversation is closed.</div>}
      </div>
    </div>
  );
};
