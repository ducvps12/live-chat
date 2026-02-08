import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ProfileService } from '@/services/profile.service';
import { UpdateProfileRequest } from '@/types/auth';
import { message } from 'antd';

export const PROFILE_KEYS = {
    profile: ['profile'] as const,
};

export const useProfile = () => {
    return useQuery({
        queryKey: PROFILE_KEYS.profile,
        queryFn: ProfileService.getProfile,
        enabled: typeof window !== 'undefined' && !!localStorage.getItem('auth_token'),
    });
};

export const useUpdateProfile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ProfileService.updateProfile,
        onSuccess: () => {
            message.success('Profile updated successfully');
            queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.profile });
        },
        onError: (error: any) => {
            message.error(error?.response?.data?.message || 'Update failed');
        }
    });
};

export const useUploadAvatar = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ProfileService.uploadAvatar,
        onSuccess: () => {
            message.success('Avatar uploaded successfully');
            queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.profile });
        },
        onError: (error: any) => {
            message.error(error?.response?.data?.message || 'Upload failed');
        }
    });
};
