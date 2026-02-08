import React, { useMemo, useState, useEffect } from 'react';
import { useConversation } from '@/contexts/ConversationContext';
import { formatRelativeTime } from '@/utils/date';
import { Conversation } from '@/services/conversation.service';
import { Select, Popover, Badge } from 'antd';

import { useMyStore } from '@/contexts/MyStoreContext';
import { WorkspaceService } from '@/services/workspace.service';

type FilterType = 'all' | 'open' | 'closed';

// Widget and domain options will be derived from conversations
const widgetOptions: { label: string, value: string }[] = [];
const domainOptions: { label: string, value: string }[] = [];

interface InboxListProps {
  onSelectConversation?: () => void;
}

export const InboxList = ({ onSelectConversation }: InboxListProps) => {
  const {
    conversations,
    selectedConversation,
    selectConversation,
    isLoadingConversations,
    isConnected,
  } = useConversation();

  const { user } = useMyStore(); // Get current user

  const [assignmentFilter, setAssignmentFilter] = useState<'mine' | 'unassigned' | 'all'>('mine');
  const [statusFilter, setStatusFilter] = useState<'open' | 'closed' | 'all'>('open');

  const [selectedWorkspaces, setSelectedWorkspaces] = useState<string[]>([]);
  const [selectedWidgets, setSelectedWidgets] = useState<string[]>([]);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);

  // Workspace options state - fetch from API
  const [workspaceOptions, setWorkspaceOptions] = useState<{ label: string, value: string }[]>([]);

  // Fetch workspaces for filter dropdown
  useEffect(() => {
    const fetchWorkspaces = async () => {
      try {
        const workspaces = await WorkspaceService.list();
        const options = workspaces.map(ws => ({
          label: ws.name,
          value: ws.workspaceId
        }));
        setWorkspaceOptions(options);
      } catch (error) {
        console.error('Failed to fetch workspaces for filter:', error);
      }
    };
    fetchWorkspaces();
  }, []);

  // (Memo blocks for options exist...)

  // Filter conversations
  const filteredConversations = useMemo(() => {
    let result = conversations;

    // Filter by status
    if (statusFilter === 'open') result = result.filter((c) => c.status === 1);
    if (statusFilter === 'closed') result = result.filter((c) => c.status === 2);

    // Filter by Assignment
    if (assignmentFilter === 'mine') {
      if (user) {
        result = result.filter(c => c.assignedUserKey === Number(user.UserKey));
      } else {
        result = []; // If no user loaded, show nothing for 'mine'
      }
    } else if (assignmentFilter === 'unassigned') {
      result = result.filter(c => !c.assignedUserKey);
    }
    // 'all' includes everyone (Manager view)

    // Filter by workspace
    if (selectedWorkspaces.length > 0) {
      result = result.filter(c => c.workspaceId && selectedWorkspaces.includes(c.workspaceId));
    }

    // Filter by widget/domain (name)
    if (selectedWidgets.length > 0) {
      result = result.filter(c => c.widgetId && selectedWidgets.includes(c.widgetId));
    }

    // Filter by domain (hostname)
    if (selectedDomains.length > 0) {
      result = result.filter(c => {
        if (!c.domain) return false;
        try {
          const hostname = new URL(c.domain).hostname;
          return selectedDomains.includes(hostname);
        } catch {
          return selectedDomains.includes(c.domain);
        }
      });
    }

    return result;
  }, [conversations, assignmentFilter, statusFilter, selectedWorkspaces, selectedWidgets, selectedDomains, user]);

  // Count by assignment (with current filters applied except assignment itself)
  const counts = useMemo(() => {
    let base = conversations;

    // Apply Status Filter first? No, counts usually want to show available in each tab.
    // Let's filter by Status + Other Filters first.
    if (statusFilter === 'open') base = base.filter((c) => c.status === 1);
    else if (statusFilter === 'closed') base = base.filter((c) => c.status === 2);

    if (selectedWorkspaces.length > 0) base = base.filter(c => c.workspaceId && selectedWorkspaces.includes(c.workspaceId));
    if (selectedWidgets.length > 0) base = base.filter(c => c.widgetId && selectedWidgets.includes(c.widgetId));

    return {
      all: base.length,
      unassigned: base.filter(c => !c.assignedUserKey).length,
      mine: user ? base.filter(c => c.assignedUserKey === Number(user.UserKey)).length : 0
    };
  }, [conversations, statusFilter, selectedWorkspaces, selectedWidgets, user]);

  // Get initials from name
  const getInitials = (name: string | null): string => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Get display name
  const getDisplayName = (conv: Conversation): string => {
    return conv.visitorName || `Visitor ${conv.visitorId?.slice(-6) || ''}`;
  };

  const filterContent = (
    <div style={{ width: 250, display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>
        <p className="mb-2 font-medium text-xs text-neutral-500">Filter by Workspace</p>
        <Select
          mode="multiple"
          style={{ width: '100%' }}
          placeholder="Select workspaces"
          options={workspaceOptions}
          value={selectedWorkspaces}
          onChange={setSelectedWorkspaces}
          maxTagCount="responsive"
          allowClear
        />
      </div>
      <div>
        <p className="mb-2 font-medium text-xs text-neutral-500">Filter by Widget (Domain)</p>
        <Select
          mode="multiple"
          style={{ width: '100%' }}
          placeholder="Select widgets"
          options={widgetOptions}
          value={selectedWidgets}
          onChange={setSelectedWidgets}
          maxTagCount="responsive"
          allowClear
        />
      </div>
      <div>
        <p className="mb-2 font-medium text-xs text-neutral-500">Filter by Domain (Real)</p>
        <Select
          mode="multiple"
          style={{ width: '100%' }}
          placeholder="Select domains"
          options={domainOptions}
          value={selectedDomains}
          onChange={setSelectedDomains}
          maxTagCount="responsive"
          allowClear
        />
      </div>
    </div>
  );

  // Loading skeleton
  if (isLoadingConversations) {
    return (
      <div className="w-[320px] bg-white border-r border-neutral-200 flex flex-col flex-shrink-0 h-full">
        <div className="p-3 border-b border-neutral-100 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-neutral-900">Inbox</h2>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse mb-4">
              <div className="h-4 bg-neutral-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-neutral-100 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-[320px] bg-white border-r border-neutral-200 flex flex-col flex-shrink-0 h-full">
      {/* Header */}
      <div className="p-3 border-b border-neutral-100 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-neutral-900">Inbox</h2>
            {/* Status Selector */}
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              size="small"
              bordered={false}
              className="text-xs font-medium w-20"
              options={[
                { value: 'open', label: 'Open' },
                { value: 'closed', label: 'Closed' },
                { value: 'all', label: 'All' },
              ]}
            />
          </div>
          <div className="flex items-center gap-1">
            <span
              className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-neutral-300'
                }`}
              title={isConnected ? 'Connected' : 'Disconnected'}
            ></span>
            <Popover content={filterContent} title="Filter" trigger="click" placement="bottomRight">
              <button className={`text-neutral-400 hover:text-neutral-600 ${selectedWorkspaces.length > 0 || selectedWidgets.length > 0 || selectedDomains.length > 0 ? 'text-primary-500' : ''}`}>
                <Badge dot={selectedWorkspaces.length > 0 || selectedWidgets.length > 0 || selectedDomains.length > 0}>
                  <span className="material-symbols-outlined text-[20px]">filter_list</span>
                </Badge>
              </button>
            </Popover>
          </div>
        </div>

        {/* Assignment Filter tabs */}
        <div className="flex bg-neutral-100 p-1 rounded-lg">
          <button
            onClick={() => setAssignmentFilter('mine')}
            className={`flex-1 flex items-center justify-center py-1.5 rounded-md text-xs font-medium transition-all ${assignmentFilter === 'mine'
              ? 'bg-white text-primary-700 shadow-sm'
              : 'text-neutral-500 hover:text-neutral-700'
              }`}
          >
            Mine ({counts.mine})
          </button>
          <button
            onClick={() => setAssignmentFilter('unassigned')}
            className={`flex-1 flex items-center justify-center py-1.5 rounded-md text-xs font-medium transition-all ${assignmentFilter === 'unassigned'
              ? 'bg-white text-primary-700 shadow-sm'
              : 'text-neutral-500 hover:text-neutral-700'
              }`}
          >
            Unassigned ({counts.unassigned})
          </button>
          <button
            onClick={() => setAssignmentFilter('all')}
            className={`flex-1 flex items-center justify-center py-1.5 rounded-md text-xs font-medium transition-all ${assignmentFilter === 'all'
              ? 'bg-white text-primary-700 shadow-sm'
              : 'text-neutral-500 hover:text-neutral-700'
              }`}
          >
            All
          </button>
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto hover:overflow-y-scroll">
        {filteredConversations.length === 0 ? (
          <div className="p-6 text-center text-neutral-400">
            <span className="material-symbols-outlined text-4xl mb-2 block">inbox</span>
            <p className="text-sm">No conversations found</p>
            {selectedWorkspaces.length > 0 && <p className="text-xs mt-1">Try clearing filters</p>}
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isSelected = selectedConversation?.conversationId === conv.conversationId;
            const isOpen = conv.status === 1;

            return (
              <div
                key={conv.conversationId}
                onClick={() => {
                  selectConversation(conv);
                  onSelectConversation?.();
                }}
                className={`p-3 border-b border-neutral-100 cursor-pointer transition-colors relative
                  ${isSelected ? 'bg-primary-50 border-l-4 border-l-primary-500' : 'hover:bg-neutral-50 border-l-4 border-l-transparent'}
                  ${isOpen ? '' : 'opacity-70'}
                `}
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="flex items-center gap-2 max-w-[70%]">
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {getInitials(conv.visitorName)}
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-sm text-neutral-900 truncate block">
                        {getDisplayName(conv)}
                      </span>
                      {conv.assignedAgentName && (
                        <span className="text-[10px] text-primary-600 bg-primary-50 px-1 rounded inline-block mb-1">
                          @{conv.assignedAgentName}
                        </span>
                      )}
                      <div className="flex items-center gap-1 text-[10px] text-neutral-400 leading-tight">
                        <span className="font-medium text-neutral-600">{conv.workspaceName}</span>
                        {conv.domain && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[120px]" title={conv.domain}>
                              {(() => {
                                try { return new URL(conv.domain).hostname; } catch { return conv.domain; }
                              })()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${isOpen
                        ? 'bg-green-100 text-green-700'
                        : 'bg-neutral-100 text-neutral-500'
                        }`}
                    >
                      {isOpen ? 'Open' : 'Closed'}
                    </span>
                    <span className="text-[10px] text-neutral-400 whitespace-nowrap">
                      {formatRelativeTime(conv.lastMessageAt || conv.updatedAt)}
                    </span>
                    {conv.unreadCount !== undefined && conv.unreadCount > 0 && (
                      <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 animate-scaleIn">
                        {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>

                {/* Last message preview */}
                {conv.lastMessageContent && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="material-symbols-outlined text-[14px] text-neutral-400">
                      chat
                    </span>
                    <p className="text-xs text-neutral-600 truncate">
                      {conv.lastMessageContent}
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
