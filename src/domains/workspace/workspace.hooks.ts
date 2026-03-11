import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workspaceHttpService } from '../../services/workspace.service';

export const workspaceKeys = {
    all: ['workspaces'] as const,
    list: () => [...workspaceKeys.all, 'list'] as const,
    detail: (id: string) => [...workspaceKeys.all, 'detail', id] as const,
};

export const useMyWorkspaces = () => {
    return useQuery({
        queryKey: workspaceKeys.list(),
        queryFn: () => workspaceHttpService.getMyWorkspaces(),
    });
};

export const useWorkspace = (id: string, enabled = true) => {
    return useQuery({
        queryKey: workspaceKeys.detail(id),
        queryFn: () => workspaceHttpService.getOne(id),
        enabled: !!id && enabled,
    });
};

export const useCreateWorkspace = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: { name: string; slug: string }) => workspaceHttpService.create(payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: workspaceKeys.list() });
        },
    });
};

export const useUpdateWorkspace = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, ...payload }: { id: string; [key: string]: any }) =>
            workspaceHttpService.update(id, payload),
        onSuccess: (_data, variables) => {
            qc.invalidateQueries({ queryKey: workspaceKeys.detail(variables.id) });
            qc.invalidateQueries({ queryKey: workspaceKeys.list() });
        },
    });
};

export const useDeleteWorkspace = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => workspaceHttpService.deleteWorkspace(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: workspaceKeys.list() });
        },
    });
};
