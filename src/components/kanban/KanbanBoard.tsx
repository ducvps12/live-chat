import React, { useState, useMemo } from 'react';
import {
    DndContext,
    DragEndEvent,
    DragOverEvent,
    DragOverlay,
    DragStartEvent,
    PointerSensor,
    useSensor,
    useSensors,
    closestCorners,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Ticket } from '@/services/tickets.service';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';

interface KanbanBoardProps {
    tickets: Ticket[];
    onStatusChange: (ticketId: string, newStatus: number, newPosition: number) => void;
    onCardClick?: (ticket: Ticket) => void;
    onAddClick?: () => void;
}

const STATUSES = [1, 2, 3, 4]; // Mới, Đang xử lý, Chờ phản hồi, Hoàn thành

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
    tickets,
    onStatusChange,
    onCardClick,
    onAddClick,
}) => {
    const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    // Group tickets by status
    const ticketsByStatus = useMemo(() => {
        const grouped: Record<number, Ticket[]> = {};
        STATUSES.forEach(status => {
            grouped[status] = tickets
                .filter(t => t.Status === status)
                .sort((a, b) => a.Position - b.Position);
        });
        return grouped;
    }, [tickets]);

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        const ticket = tickets.find(t => t.TicketId === active.id);
        setActiveTicket(ticket || null);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveTicket(null);

        if (!over) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        // Find the ticket being dragged
        const activeTicket = tickets.find(t => t.TicketId === activeId);
        if (!activeTicket) return;

        // Determine target status - either from column or from over card
        let targetStatus: number;
        let targetPosition: number;

        if (overId.startsWith('column-')) {
            // Dropped on column
            targetStatus = parseInt(overId.replace('column-', ''));
            targetPosition = ticketsByStatus[targetStatus].length;
        } else {
            // Dropped on another card
            const overTicket = tickets.find(t => t.TicketId === overId);
            if (!overTicket) return;
            targetStatus = overTicket.Status;
            targetPosition = overTicket.Position;
        }

        // Only update if something changed
        if (activeTicket.Status !== targetStatus || activeTicket.Position !== targetPosition) {
            onStatusChange(activeId, targetStatus, targetPosition);
        }
    };

    const handleDragOver = (event: DragOverEvent) => {
        // Optional: Handle drag over for visual feedback
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
        >
            <div className="flex gap-5 overflow-x-auto pb-6 min-h-[600px] px-1">
                {STATUSES.map(status => (
                    <KanbanColumn
                        key={status}
                        status={status}
                        tickets={ticketsByStatus[status] || []}
                        onCardClick={onCardClick}
                        onAddClick={status === 1 ? onAddClick : undefined}
                    />
                ))}
            </div>

            {/* Enhanced Drag Overlay */}
            <DragOverlay>
                {activeTicket ? (
                    <div className="rotate-3 scale-105 shadow-2xl shadow-black/50">
                        <KanbanCard ticket={activeTicket} />
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};

export default KanbanBoard;
