/**
 * Notes Panel Component
 * Display and manage notes for a conversation
 */
import { useState, useEffect, useCallback } from 'react';
import { useMyStore } from '@/contexts/MyStoreContext';
import { usePermission, IfPermission } from '@/hooks/usePermission';
import api from '@/lib/http';

interface Note {
    noteKey: number;
    noteId: string;
    content: string;
    createdAt: string;
    authorName: string;
    authorEmail: string;
}

interface NotesPanelProps {
    conversationId: string;
    isOpen: boolean;
    onClose: () => void;
}

export default function NotesPanel({ conversationId, isOpen, onClose }: NotesPanelProps) {
    const { hasPermission } = usePermission();
    const [notes, setNotes] = useState<Note[]>([]);
    const [newNote, setNewNote] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Load notes
    const loadNotes = useCallback(async () => {
        if (!conversationId) return;

        setIsLoading(true);
        try {
            const response = await api.get<{ status: string; data: { notes: Note[] } }>(
                `/embed/conversations/${conversationId}/notes`
            );
            setNotes(response.data.data.notes);
        } catch (error) {
            console.error('Failed to load notes:', error);
        } finally {
            setIsLoading(false);
        }
    }, [conversationId]);

    useEffect(() => {
        if (isOpen && conversationId) {
            loadNotes();
        }
    }, [isOpen, conversationId, loadNotes]);

    // Create note
    const handleCreateNote = async () => {
        if (!newNote.trim() || isSaving) return;

        setIsSaving(true);
        try {
            await api.post(`/embed/conversations/${conversationId}/notes`, {
                content: newNote.trim()
            });
            setNewNote('');
            loadNotes();
        } catch (error) {
            console.error('Failed to create note:', error);
        } finally {
            setIsSaving(false);
        }
    };

    // Delete note
    const handleDeleteNote = async (noteId: number) => {
        if (!confirm('Delete this note?')) return;

        try {
            await api.delete(`/embed/notes/${noteId}`);
            loadNotes();
        } catch (error) {
            console.error('Failed to delete note:', error);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-900">📝 Conversation Notes</h3>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Notes List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {isLoading ? (
                        <div className="text-center py-8 text-gray-500">Loading notes...</div>
                    ) : notes.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">No notes yet</div>
                    ) : (
                        notes.map((note) => (
                            <div key={note.noteId} className="bg-gray-50 rounded-lg p-3 group">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1">
                                        <p className="text-gray-700 whitespace-pre-wrap">{note.content}</p>
                                        <div className="mt-2 text-xs text-gray-400">
                                            {note.authorName} • {new Date(note.createdAt).toLocaleString()}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteNote(note.noteKey)}
                                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded text-red-500 transition-all"
                                        title="Delete"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Add Note Form */}
                <IfPermission permission="conversation.note">
                    <div className="border-t border-gray-200 p-4">
                        <textarea
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            placeholder="Add a note..."
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                        <div className="mt-2 flex justify-end">
                            <button
                                onClick={handleCreateNote}
                                disabled={!newNote.trim() || isSaving}
                                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
                            >
                                {isSaving ? 'Saving...' : 'Add Note'}
                            </button>
                        </div>
                    </div>
                </IfPermission>
            </div>
        </div>
    );
}
