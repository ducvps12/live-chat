/**
 * Tag Selector Component
 * Select and manage tags for a conversation
 */
import { useState, useEffect, useCallback } from 'react';
import { useMyStore } from '@/contexts/MyStoreContext';
import { usePermission, IfPermission } from '@/hooks/usePermission';
import api from '@/lib/http';

interface Tag {
    tagKey: number;
    tagId: string;
    name: string;
    color: string;
}

interface TagSelectorProps {
    conversationId: string;
    className?: string;
}

export default function TagSelector({ conversationId, className = '' }: TagSelectorProps) {
    const { activeWorkspace } = useMyStore();
    const { hasPermission } = usePermission();
    const [workspaceTags, setWorkspaceTags] = useState<Tag[]>([]);
    const [conversationTags, setConversationTags] = useState<Tag[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [newTagName, setNewTagName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // Load workspace tags
    const loadWorkspaceTags = useCallback(async () => {
        if (!activeWorkspace?.workspaceId) return;

        try {
            const response = await api.get<{ status: string; data: { tags: Tag[] } }>(
                `/embed/workspaces/${activeWorkspace.workspaceId}/tags`
            );
            setWorkspaceTags(response.data.data.tags);
        } catch (error) {
            console.error('Failed to load workspace tags:', error);
        }
    }, [activeWorkspace?.workspaceId]);

    // Load conversation tags
    const loadConversationTags = useCallback(async () => {
        if (!conversationId) return;

        setIsLoading(true);
        try {
            const response = await api.get<{ status: string; data: { tags: Tag[] } }>(
                `/embed/conversations/${conversationId}/tags`
            );
            setConversationTags(response.data.data.tags);
        } catch (error) {
            console.error('Failed to load conversation tags:', error);
        } finally {
            setIsLoading(false);
        }
    }, [conversationId]);

    useEffect(() => {
        loadWorkspaceTags();
    }, [loadWorkspaceTags]);

    useEffect(() => {
        loadConversationTags();
    }, [loadConversationTags]);

    // Create new tag
    const handleCreateTag = async () => {
        if (!newTagName.trim() || !activeWorkspace?.workspaceId || isCreating) return;

        setIsCreating(true);
        try {
            await api.post(`/embed/workspaces/${activeWorkspace.workspaceId}/tags`, {
                name: newTagName.trim(),
                color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`
            });
            setNewTagName('');
            loadWorkspaceTags();
        } catch (error) {
            console.error('Failed to create tag:', error);
        } finally {
            setIsCreating(false);
        }
    };

    // Assign tag to conversation
    const handleAssignTag = async (tagKey: number) => {
        try {
            await api.post(`/embed/conversations/${conversationId}/tags/${tagKey}`);
            loadConversationTags();
        } catch (error) {
            console.error('Failed to assign tag:', error);
        }
    };

    // Remove tag from conversation
    const handleRemoveTag = async (tagKey: number) => {
        try {
            await api.delete(`/embed/conversations/${conversationId}/tags/${tagKey}`);
            loadConversationTags();
        } catch (error) {
            console.error('Failed to remove tag:', error);
        }
    };

    // Check if tag is assigned
    const isTagAssigned = (tagKey: number) => {
        return conversationTags.some((t) => t.tagKey === tagKey);
    };

    // Available tags (not yet assigned)
    const availableTags = workspaceTags.filter((t) => !isTagAssigned(t.tagKey));

    return (
        <div className={`relative ${className}`}>
            {/* Current Tags */}
            <div className="flex flex-wrap gap-1">
                {isLoading ? (
                    <span className="text-xs text-gray-400">Loading...</span>
                ) : conversationTags.length === 0 ? (
                    <span className="text-xs text-gray-400">No tags</span>
                ) : (
                    conversationTags.map((tag) => (
                        <span
                            key={tag.tagId}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full text-white"
                            style={{ backgroundColor: tag.color }}
                        >
                            {tag.name}
                            <IfPermission permission="conversation.tag">
                                <button
                                    onClick={() => handleRemoveTag(tag.tagKey)}
                                    className="hover:bg-white/20 rounded-full p-0.5"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </IfPermission>
                        </span>
                    ))
                )}

                {/* Add Tag Button */}
                <IfPermission permission="conversation.tag">
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="inline-flex items-center px-2 py-0.5 text-xs text-gray-500 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                    >
                        + Add tag
                    </button>
                </IfPermission>
            </div>

            {/* Dropdown */}
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-full mt-1 left-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-2 min-w-[200px]">
                        {/* Create New Tag */}
                        <div className="px-3 pb-2 border-b border-gray-100">
                            <div className="flex gap-1">
                                <input
                                    type="text"
                                    value={newTagName}
                                    onChange={(e) => setNewTagName(e.target.value)}
                                    placeholder="New tag name..."
                                    className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                                />
                                <button
                                    onClick={handleCreateTag}
                                    disabled={!newTagName.trim() || isCreating}
                                    className="px-2 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                                >
                                    +
                                </button>
                            </div>
                        </div>

                        {/* Available Tags */}
                        <div className="max-h-40 overflow-y-auto">
                            {availableTags.length === 0 ? (
                                <div className="px-3 py-2 text-xs text-gray-400">No more tags available</div>
                            ) : (
                                availableTags.map((tag) => (
                                    <button
                                        key={tag.tagId}
                                        onClick={() => {
                                            handleAssignTag(tag.tagKey);
                                            setIsOpen(false);
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors"
                                    >
                                        <span
                                            className="w-3 h-3 rounded-full"
                                            style={{ backgroundColor: tag.color }}
                                        />
                                        <span className="text-sm text-gray-700">{tag.name}</span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

/**
 * Tag Badge - Simple display component for a single tag
 */
export function TagBadge({ name, color }: { name: string; color: string }) {
    return (
        <span
            className="inline-flex items-center px-2 py-0.5 text-xs rounded-full text-white"
            style={{ backgroundColor: color }}
        >
            {name}
        </span>
    );
}
