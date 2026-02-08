import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Ticket } from '@/services/tickets.service';

interface KanbanCardProps {
    ticket: Ticket;
    onClick?: () => void;
}

// Priority configuration with proper icons (no emojis)
const PRIORITY_CONFIG: Record<number, { icon: string; color: string; bg: string; label: string }> = {
    4: { icon: 'keyboard_double_arrow_up', color: 'text-red-400', bg: 'bg-red-500/20', label: 'Critical' },
    3: { icon: 'keyboard_arrow_up', color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'High' },
    2: { icon: 'drag_handle', color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Medium' },
    1: { icon: 'keyboard_arrow_down', color: 'text-neutral-400', bg: 'bg-neutral-500/20', label: 'Low' },
};

const getTypeConfig = (type: number) => {
    return type === 2
        ? { icon: 'task_alt', color: 'text-emerald-400', label: 'Task' }
        : { icon: 'confirmation_number', color: 'text-purple-400', label: 'Ticket' };
};

export const KanbanCard: React.FC<KanbanCardProps> = ({ ticket, onClick }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: ticket.TicketId });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return { text: 'Quá hạn', isOverdue: true };
        if (diffDays === 0) return { text: 'Hôm nay', isToday: true };
        if (diffDays === 1) return { text: 'Ngày mai', isSoon: true };
        return { text: date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) };
    };

    const priorityConfig = PRIORITY_CONFIG[ticket.Priority] || PRIORITY_CONFIG[1];
    const typeConfig = getTypeConfig(ticket.Type);
    const dateInfo = formatDate(ticket.DueDate);

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={onClick}
            className={`
                group relative bg-neutral-800/80 backdrop-blur-sm rounded-xl p-4 mb-3 
                cursor-grab active:cursor-grabbing
                border border-neutral-700/50 
                hover:border-primary-500/50 hover:bg-neutral-750
                transition-all duration-200 ease-out
                hover:shadow-lg hover:shadow-primary-500/5
                ${isDragging ? 'opacity-50 scale-105 shadow-2xl ring-2 ring-primary-500 rotate-2' : ''}
            `}
        >
            {/* Priority indicator line */}
            <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-full ${priorityConfig.bg.replace('/20', '')}`} />

            {/* Header: Type badge + Key */}
            <div className="flex items-center gap-2 mb-3 pl-3">
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md ${typeConfig.color} bg-neutral-700/50`}>
                    <span className="material-symbols-outlined text-sm">{typeConfig.icon}</span>
                    <span className="text-xs font-medium">{typeConfig.label}</span>
                </div>
                <span className="text-xs text-neutral-500 font-mono">
                    #{ticket.TicketKey}
                </span>
            </div>

            {/* Title */}
            <h4 className="text-white text-sm font-medium mb-3 line-clamp-2 leading-relaxed pl-3 group-hover:text-primary-100 transition-colors">
                {ticket.Title}
            </h4>

            {/* Footer */}
            <div className="flex items-center justify-between pl-3">
                {/* Left side: Priority + Due Date */}
                <div className="flex items-center gap-3">
                    {/* Priority badge */}
                    <div
                        className={`flex items-center gap-1 px-2 py-1 rounded-md ${priorityConfig.bg}`}
                        title={priorityConfig.label}
                    >
                        <span className={`material-symbols-outlined text-sm ${priorityConfig.color}`}>
                            {priorityConfig.icon}
                        </span>
                        <span className={`text-xs font-medium ${priorityConfig.color}`}>
                            {priorityConfig.label}
                        </span>
                    </div>

                    {/* Due Date */}
                    {dateInfo && (
                        <div className={`flex items-center gap-1.5 text-xs ${dateInfo.isOverdue ? 'text-red-400' :
                                dateInfo.isToday ? 'text-orange-400' :
                                    dateInfo.isSoon ? 'text-yellow-400' :
                                        'text-neutral-400'
                            }`}>
                            <span className="material-symbols-outlined text-sm">schedule</span>
                            <span>{dateInfo.text}</span>
                        </div>
                    )}
                </div>

                {/* Right side: Assignee Avatar */}
                {ticket.AssigneeName ? (
                    <div
                        className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 
                                   flex items-center justify-center text-white text-xs font-semibold
                                   ring-2 ring-neutral-800 shadow-lg
                                   transition-transform group-hover:scale-110"
                        title={ticket.AssigneeName}
                    >
                        {ticket.AssigneeName.charAt(0).toUpperCase()}
                    </div>
                ) : (
                    <div
                        className="w-7 h-7 rounded-full bg-neutral-700 border border-dashed border-neutral-600
                                   flex items-center justify-center transition-colors group-hover:border-neutral-500"
                        title="Chưa gán"
                    >
                        <span className="material-symbols-outlined text-neutral-500 text-sm">person_add</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default KanbanCard;
