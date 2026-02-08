/**
 * Audit Log Viewer Component
 * View audit logs for workspace (Admin only)
 */
import { useState, useEffect, useCallback } from 'react';
import { useMyStore } from '@/contexts/MyStoreContext';
import { usePermission, IfPermission } from '@/hooks/usePermission';
import api from '@/lib/http';

interface AuditLog {
    logKey: number;
    logId: string;
    action: string;
    resourceType: string | null;
    resourceId: string | null;
    metadata: Record<string, any> | null;
    ipAddress: string | null;
    createdAt: string;
    userName: string | null;
    userEmail: string | null;
}

interface AuditLogViewerProps {
    className?: string;
}

export default function AuditLogViewer({ className = '' }: AuditLogViewerProps) {
    const { activeWorkspace } = useMyStore();
    const { hasPermission } = usePermission();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filters, setFilters] = useState({
        action: '',
        dateFrom: '',
        dateTo: ''
    });

    const loadLogs = useCallback(async () => {
        if (!activeWorkspace?.workspaceId || !hasPermission('audit.read')) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.action) params.append('action', filters.action);
            if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
            if (filters.dateTo) params.append('dateTo', filters.dateTo);

            const response = await api.get<{ status: string; data: { logs: AuditLog[] } }>(
                `/embed/workspaces/${activeWorkspace.workspaceId}/audit-logs?${params.toString()}`
            );
            setLogs(response.data.data.logs);
        } catch (error) {
            console.error('Failed to load audit logs:', error);
        } finally {
            setIsLoading(false);
        }
    }, [activeWorkspace?.workspaceId, hasPermission, filters]);

    useEffect(() => {
        loadLogs();
    }, [loadLogs]);

    // Action type display formatting
    const formatAction = (action: string) => {
        return action.replace(/\./g, ' → ').replace(/_/g, ' ');
    };

    // Action color coding
    const getActionColor = (action: string) => {
        if (action.includes('created')) return 'bg-green-100 text-green-700';
        if (action.includes('deleted') || action.includes('removed')) return 'bg-red-100 text-red-700';
        if (action.includes('updated') || action.includes('changed')) return 'bg-blue-100 text-blue-700';
        return 'bg-gray-100 text-gray-700';
    };

    if (!hasPermission('audit.read')) {
        return null;
    }

    return (
        <div className={`bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200">
                <h2 className="font-semibold text-gray-900">📋 Audit Logs</h2>
            </div>

            {/* Filters */}
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap gap-3">
                <select
                    value={filters.action}
                    onChange={(e) => setFilters(f => ({ ...f, action: e.target.value }))}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
                >
                    <option value="">All Actions</option>
                    <option value="conversation.status_changed">Status Changed</option>
                    <option value="conversation.note_added">Note Added</option>
                    <option value="conversation.tag_added">Tag Added</option>
                    <option value="member.invited">Member Invited</option>
                    <option value="widget.created">Widget Created</option>
                </select>

                <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
                    placeholder="From"
                />

                <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters(f => ({ ...f, dateTo: e.target.value }))}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
                    placeholder="To"
                />

                <button
                    onClick={loadLogs}
                    className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
                >
                    Filter
                </button>
            </div>

            {/* Logs Table */}
            <div className="overflow-x-auto">
                {isLoading ? (
                    <div className="px-4 py-8 text-center text-gray-400">Loading...</div>
                ) : logs.length === 0 ? (
                    <div className="px-4 py-8 text-center text-gray-400">No audit logs found</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="text-left px-4 py-2 font-medium text-gray-600">Time</th>
                                <th className="text-left px-4 py-2 font-medium text-gray-600">User</th>
                                <th className="text-left px-4 py-2 font-medium text-gray-600">Action</th>
                                <th className="text-left px-4 py-2 font-medium text-gray-600">Resource</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {logs.map((log) => (
                                <tr key={log.logId} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                                        {new Date(log.createdAt).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-gray-900">{log.userName || 'System'}</div>
                                        <div className="text-xs text-gray-400">{log.userEmail}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                                            {formatAction(log.action)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">
                                        {log.resourceType && (
                                            <span className="text-gray-400">{log.resourceType}:</span>
                                        )}
                                        {log.resourceId && (
                                            <span className="ml-1 text-gray-700">{log.resourceId}</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
