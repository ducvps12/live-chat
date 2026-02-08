import React, { useState } from 'react';
import { InboxList } from '../dashboard/components/InboxList';
import { ChatArea } from '../dashboard/components/ChatArea';
import { ContactSidebar } from '../dashboard/components/ContactSidebar';
import { ConversationProvider, useConversation } from '@/contexts/ConversationContext';
import { useMyStore } from '@/contexts/MyStoreContext';

// Inner component to access conversation context
const InboxContent = () => {
  const { selectedConversation } = useConversation();
  const [showInboxList, setShowInboxList] = useState(true);
  const [showContactSidebar, setShowContactSidebar] = useState(false);

  // On mobile: show InboxList first, hide when conversation selected
  // On desktop: always show InboxList

  return (
    <div className="flex h-full w-full overflow-hidden relative min-w-0">
      {/* InboxList - Full width on mobile when shown, fixed width on desktop */}
      <div
        className={`
          ${showInboxList ? 'flex' : 'hidden md:flex'}
          w-full md:w-[320px] 
          flex-shrink-0
          absolute md:relative inset-0 md:inset-auto
          z-20 md:z-auto
          bg-white
        `}
      >
        <InboxList onSelectConversation={() => setShowInboxList(false)} />
      </div>

      {/* ChatArea - Hidden on mobile when InboxList shown */}
      <div
        className={`
          ${!showInboxList || selectedConversation ? 'flex' : 'hidden md:flex'}
          flex-1 
          flex-col
          min-w-0
          overflow-hidden
        `}
      >
        {/* Mobile header to show inbox */}
        <div className="md:hidden flex items-center gap-2 p-2 border-b border-neutral-200 bg-white">
          <button
            onClick={() => setShowInboxList(true)}
            className="p-2 hover:bg-neutral-100 rounded-lg"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
          <span className="font-semibold text-sm">
            {selectedConversation?.visitorName || 'Select conversation'}
          </span>
          <div className="flex-1" />
          <button
            onClick={() => setShowContactSidebar(!showContactSidebar)}
            className="p-2 hover:bg-neutral-100 rounded-lg md:hidden"
          >
            <span className="material-symbols-outlined">info</span>
          </button>
        </div>
        <ChatArea />
      </div>

      {/* ContactSidebar - Overlay on mobile */}
      <div
        className={`
          ${showContactSidebar ? 'flex' : 'hidden'} 
          md:flex
          w-full md:w-[280px]
          flex-shrink-0
          absolute md:relative inset-0 md:inset-auto
          z-30 md:z-auto
          bg-white
        `}
      >
        {/* Mobile close button */}
        <button
          onClick={() => setShowContactSidebar(false)}
          className="md:hidden absolute top-2 right-2 p-2 hover:bg-neutral-100 rounded-lg z-10"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
        <ContactSidebar />
      </div>
    </div>
  );
};

export const InboxPage = () => {
  const { activeWorkspace } = useMyStore();

  // Show loading if no workspace selected
  if (!activeWorkspace) {
    return (
      <div className="flex h-full w-full items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-2" />
          <p>Loading workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <ConversationProvider workspaceId={activeWorkspace.workspaceId}>
      <InboxContent />
    </ConversationProvider>
  );
};
