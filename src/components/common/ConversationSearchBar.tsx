/**
 * Conversation Search Bar Component
 * Search and filter conversations by keyword, status, date range
 */
import { useState, useCallback } from 'react';
import { useMyStore } from '@/contexts/MyStoreContext';
import api from '@/lib/http';

interface SearchFilters {
    keyword: string;
    status: '' | '1' | '2' | '3';
    dateFrom: string;
    dateTo: string;
}

interface ConversationSearchBarProps {
    onSearch: (conversations: any[]) => void;
    onClear: () => void;
    className?: string;
}

export default function ConversationSearchBar({
    onSearch,
    onClear,
    className = ''
}: ConversationSearchBarProps) {
    const { activeWorkspace } = useMyStore();
    const [isExpanded, setIsExpanded] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [filters, setFilters] = useState<SearchFilters>({
        keyword: '',
        status: '',
        dateFrom: '',
        dateTo: ''
    });

    const handleSearch = useCallback(async () => {
        if (!activeWorkspace?.workspaceId) return;

        // Build query params
        const params = new URLSearchParams();
        if (filters.keyword) params.append('keyword', filters.keyword);
        if (filters.status) params.append('status', filters.status);
        if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
        if (filters.dateTo) params.append('dateTo', filters.dateTo);

        setIsSearching(true);
        try {
            const response = await api.get<{ status: string; data: { conversations: any[] } }>(
                `/embed/workspaces/${activeWorkspace.workspaceId}/conversations/search?${params.toString()}`
            );
            onSearch(response.data.data.conversations);
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setIsSearching(false);
        }
    }, [activeWorkspace?.workspaceId, filters, onSearch]);

    const handleClear = useCallback(() => {
        setFilters({ keyword: '', status: '', dateFrom: '', dateTo: '' });
        onClear();
    }, [onClear]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    return (
        <div className={`bg-white border-b border-gray-200 ${className}`}>
            {/* Search Bar */}
            <div className="flex items-center gap-2 p-3">
                <div className="flex-1 relative">
                    <input
                        type="text"
                        placeholder="Search conversations..."
                        value={filters.keyword}
                        onChange={(e) => setFilters(f => ({ ...f, keyword: e.target.value }))}
                        onKeyDown={handleKeyDown}
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <svg
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>

                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className={`p-2 rounded-lg transition-colors ${isExpanded ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-500'}`}
                    title="Filters"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                </button>

                <button
                    onClick={handleSearch}
                    disabled={isSearching}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
                >
                    {isSearching ? 'Searching...' : 'Search'}
                </button>
            </div>

            {/* Extended Filters */}
            {isExpanded && (
                <div className="px-3 pb-3 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3">
                    {/* Status Filter */}
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600">Status:</label>
                        <select
                            value={filters.status}
                            onChange={(e) => setFilters(f => ({ ...f, status: e.target.value as any }))}
                            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">All</option>
                            <option value="1">Active</option>
                            <option value="2">Closed</option>
                            <option value="3">Pending</option>
                        </select>
                    </div>

                    {/* Date From */}
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600">From:</label>
                        <input
                            type="date"
                            value={filters.dateFrom}
                            onChange={(e) => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
                            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Date To */}
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600">To:</label>
                        <input
                            type="date"
                            value={filters.dateTo}
                            onChange={(e) => setFilters(f => ({ ...f, dateTo: e.target.value }))}
                            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Clear Button */}
                    <button
                        onClick={handleClear}
                        className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        Clear filters
                    </button>
                </div>
            )}
        </div>
    );
}

/**
 * Status Badge Component
 */
export function StatusBadge({ status }: { status: number }) {
    const statusConfig: Record<number, { label: string; className: string }> = {
        1: { label: 'Active', className: 'bg-green-100 text-green-700' },
        2: { label: 'Closed', className: 'bg-gray-100 text-gray-700' },
        3: { label: 'Pending', className: 'bg-yellow-100 text-yellow-700' }
    };

    const config = statusConfig[status] || statusConfig[1];

    return (
        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${config.className}`}>
            {config.label}
        </span>
    );
}
