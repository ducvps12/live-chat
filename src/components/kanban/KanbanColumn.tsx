import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Ticket, STATUS_LABELS } from '@/services/tickets.service';
import { KanbanCard } from './KanbanCard';

interface KanbanColumnProps {
    status: number;
    tickets: Ticket[];
    onCardClick?: (ticket: Ticket) => void;
    onAddClick?: () => void;
}

// Status configuration with gradients and colors
const STATUS_CONFIG: Record<number, { gradient: string; dotColor: string; bgHover: string }> = {
    1: { gradient: 'from-blue-500/20 to-blue-600/5', dotColor: 'bg-blue-500', bgHover: 'bg-blue-500/10' },
    2: { gradient: 'from-amber-500/20 to-amber-600/5', dotColor: 'bg-amber-500', bgHover: 'bg-amber-500/10' },
    3: { gradient: 'from-orange-500/20 to-orange-600/5', dotColor: 'bg-orange-500', bgHover: 'bg-orange-500/10' },
    4: { gradient: 'from-emerald-500/20 to-emerald-600/5', dotColor: 'bg-emerald-500', bgHover: 'bg-emerald-500/10' },
};

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
    status,
    tickets,
    onCardClick,
    onAddClick
}) => {
    const { setNodeRef, isOver } = useDroppable({
        id: `column-${status}`,
        data: { status }
    });

    const ticketIds = tickets.map(t => t.TicketId);
    const config = STATUS_CONFIG[status] || STATUS_CONFIG[1];

    return (
        <div className="flex flex-col bg-neutral-900/50 backdrop-blur-sm rounded-2xl min-w-[300px] max-w-[340px] flex-1 border border-neutral-800/50 overflow-hidden">
            {/* Column Header with gradient */}
            <div className={`bg-gradient-to-b ${config.gradient} border-b border-neutral-800/50`}>
                <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                        {/* Animated dot indicator */}
                        <div className="relative">
                            <div className={`w-3 h-3 rounded-full ${config.dotColor}`} />
                            <div className={`absolute inset-0 w-3 h-3 rounded-full ${config.dotColor} animate-ping opacity-50`} />
                        </div>
                        <span className="text-white font-semibold text-sm tracking-wide">
                            {STATUS_LABELS[status]}
                        </span>
                        <span className="text-neutral-400 text-sm bg-neutral-800/80 rounded-full px-2.5 py-0.5 font-medium">
                            {tickets.length}
                        </span>
                    </div>
                    {status === 1 && onAddClick && (
                        <button
                            onClick={onAddClick}
                            className="p-1.5 hover:bg-white/10 rounded-lg transition-all duration-200 group"
                            title="Thêm ticket mới"
                        >
                            <span className="material-symbols-outlined text-neutral-400 group-hover:text-white text-lg transition-colors">
                                add_circle
                            </span>
                        </button>
                    )}
                </div>
            </div>

            {/* Column Body - Droppable Area */}
            <div
                ref={setNodeRef}
                className={`
                    flex-1 p-3 min-h-[300px] overflow-y-auto
                    transition-all duration-300 ease-out
                    ${isOver ? `${config.bgHover} ring-2 ring-inset ring-primary-500/30` : ''}
                `}
                style={{
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'rgb(64 64 64) transparent'
                }}
            >
                <SortableContext items={ticketIds} strategy={verticalListSortingStrategy}>
                    {tickets.map(ticket => (
                        <KanbanCard
                            key={ticket.TicketId}
                            ticket={ticket}
                            onClick={() => onCardClick?.(ticket)}
                        />
                    ))}
                </SortableContext>

                {/* Enhanced Empty State */}
                {tickets.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-48 text-center">
                        <div className={`w-16 h-16 rounded-2xl ${config.bgHover} flex items-center justify-center mb-4`}>
                            <span className="material-symbols-outlined text-3xl text-neutral-500">
                                {status === 1 ? 'add_task' :
                                    status === 2 ? 'pending_actions' :
                                        status === 3 ? 'hourglass_empty' :
                                            'task_alt'}
                            </span>
                        </div>
                        <p className="text-neutral-500 text-sm font-medium">Chưa có ticket</p>
                        <p className="text-neutral-600 text-xs mt-1">Kéo thả ticket vào đây</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default KanbanColumn;
