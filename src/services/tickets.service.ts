import api from '@/lib/http';

export interface Ticket {
    TicketKey: number;
    TicketId: string;
    Title: string;
    Description?: string;
    Type: number; // 1=Ticket, 2=Task
    Status: number; // 1=Mới, 2=Đang xử lý, 3=Chờ phản hồi, 4=Hoàn thành
    Priority: number; // 1=Low, 2=Medium, 3=High, 4=Critical
    DueDate?: string;
    Position: number;
    CreatedAt: string;
    UpdatedAt?: string;
    CompletedAt?: string;
    AssigneeUserKey?: number;
    ReporterUserKey: number;
    AssigneeName?: string;
    AssigneeEmail?: string;
    AssigneeAvatar?: string;
    ReporterName?: string;
    ReporterEmail?: string;
}

export interface CreateTicketRequest {
    title: string;
    description?: string;
    type?: number;
    priority?: number;
    assigneeUserKey?: number;
    dueDate?: string;
    conversationKey?: number;
}

export interface TicketStats {
    new: number;
    inProgress: number;
    waiting: number;
    done: number;
}

export const STATUS_LABELS: Record<number, string> = {
    1: 'Mới',
    2: 'Đang xử lý',
    3: 'Chờ phản hồi',
    4: 'Hoàn thành',
};

export const PRIORITY_LABELS: Record<number, string> = {
    1: 'Low',
    2: 'Medium',
    3: 'High',
    4: 'Critical',
};

export const PRIORITY_COLORS: Record<number, string> = {
    1: 'text-gray-400',
    2: 'text-blue-400',
    3: 'text-orange-400',
    4: 'text-red-500',
};

export const TicketsService = {
    // Get all tickets for current workspace
    async getTickets(filters?: { status?: number; type?: number; assignee?: number; priority?: number }) {
        const params = new URLSearchParams();
        if (filters?.status) params.append('status', filters.status.toString());
        if (filters?.type) params.append('type', filters.type.toString());
        if (filters?.assignee) params.append('assignee', filters.assignee.toString());
        if (filters?.priority) params.append('priority', filters.priority.toString());

        const response = await api.get<{ tickets: Ticket[] }>(`/tickets?${params.toString()}`);
        return response.data.tickets;
    },

    // Get ticket by ID
    async getTicketById(ticketId: string) {
        const response = await api.get<Ticket>(`/tickets/${ticketId}`);
        return response.data;
    },

    // Create new ticket
    async createTicket(data: CreateTicketRequest) {
        const response = await api.post<Ticket>('/tickets', data);
        return response.data;
    },

    // Update ticket
    async updateTicket(ticketId: string, data: Partial<CreateTicketRequest>) {
        const response = await api.put<Ticket>(`/tickets/${ticketId}`, data);
        return response.data;
    },

    // Update ticket status (drag-drop)
    async updateTicketStatus(ticketId: string, status: number, position: number) {
        const response = await api.patch(`/tickets/${ticketId}/status`, { status, position });
        return response.data;
    },

    // Delete ticket
    async deleteTicket(ticketId: string) {
        const response = await api.delete(`/tickets/${ticketId}`);
        return response.data;
    },

    // Get ticket stats
    async getStats() {
        const response = await api.get<TicketStats>('/tickets/stats');
        return response.data;
    },

    // Admin: Get all tickets across workspaces
    async adminGetAllTickets(filters?: { workspace?: number; status?: number; type?: number; limit?: number; offset?: number }) {
        const params = new URLSearchParams();
        if (filters?.workspace) params.append('workspace', filters.workspace.toString());
        if (filters?.status) params.append('status', filters.status.toString());
        if (filters?.type) params.append('type', filters.type.toString());
        if (filters?.limit) params.append('limit', filters.limit.toString());
        if (filters?.offset) params.append('offset', filters.offset.toString());

        const response = await api.get<{ tickets: Ticket[] }>(`/admin/tickets?${params.toString()}`);
        return response.data.tickets;
    },
};

export default TicketsService;
