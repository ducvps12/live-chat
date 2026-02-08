import api from '@/lib/http';
import { UpdateProfileRequest, User } from '@/types/auth';
import { ApiResponse } from '@/types/api';

export const ProfileService = {
    getProfile: async () => {
        const response = await api.get<ApiResponse<User>>('/profile');
        return response.data.data;
    },

    updateProfile: async (data: UpdateProfileRequest) => {
        const response = await api.patch<ApiResponse<User>>('/profile', data);
        return response.data.data;
    },

    uploadAvatar: async (file: File) => {
        const formData = new FormData();
        formData.append('avatar', file);
        const response = await api.post<ApiResponse<{ avatarUrl: string }>>('/profile/avatar', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data.data;
    },
};
