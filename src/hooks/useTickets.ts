import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TicketsService, Ticket, CreateTicketRequest } from '@/services/tickets.service';
import { message } from 'antd';

const TICKETS_KEY = ['tickets'];

export const useTickets = (filters?: { status?: number; type?: number; assignee?: number; priority?: number }) => {
    return useQuery({
        queryKey: [...TICKETS_KEY, filters],
        queryFn: () => TicketsService.getTickets(filters),
        staleTime: 1000 * 30, // 30 seconds
    });
};

export const useTicketStats = () => {
    return useQuery({
        queryKey: [...TICKETS_KEY, 'stats'],
        queryFn: () => TicketsService.getStats(),
        staleTime: 1000 * 30,
    });
};

export const useCreateTicket = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateTicketRequest) => TicketsService.createTicket(data),
        onSuccess: () => {
            message.success('Tạo ticket thành công');
            queryClient.invalidateQueries({ queryKey: TICKETS_KEY });
        },
        onError: (error: any) => {
            message.error(error?.response?.data?.message || 'Lỗi tạo ticket');
        },
    });
};

export const useUpdateTicket = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ ticketId, data }: { ticketId: string; data: Partial<CreateTicketRequest> }) =>
            TicketsService.updateTicket(ticketId, data),
        onSuccess: () => {
            message.success('Cập nhật thành công');
            queryClient.invalidateQueries({ queryKey: TICKETS_KEY });
        },
        onError: (error: any) => {
            message.error(error?.response?.data?.message || 'Lỗi cập nhật');
        },
    });
};

export const useUpdateTicketStatus = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ ticketId, status, position }: { ticketId: string; status: number; position: number }) =>
            TicketsService.updateTicketStatus(ticketId, status, position),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: TICKETS_KEY });
        },
        onError: (error: any) => {
            message.error(error?.response?.data?.message || 'Lỗi cập nhật trạng thái');
        },
    });
};

export const useDeleteTicket = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (ticketId: string) => TicketsService.deleteTicket(ticketId),
        onSuccess: () => {
            message.success('Đã xóa ticket');
            queryClient.invalidateQueries({ queryKey: TICKETS_KEY });
        },
        onError: (error: any) => {
            message.error(error?.response?.data?.message || 'Lỗi xóa ticket');
        },
    });
};

// Admin hooks
export const useAdminTickets = (filters?: { workspace?: number; status?: number; type?: number; limit?: number; offset?: number }) => {
    return useQuery({
        queryKey: ['admin', ...TICKETS_KEY, filters],
        queryFn: () => TicketsService.adminGetAllTickets(filters),
        staleTime: 1000 * 30,
    });
};
