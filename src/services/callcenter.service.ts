import axiosHttp from '@/lib/http';

export interface CallCenterSettings {
    configured: boolean;
    twilioAccountSid: string | null;
    recordCalls: boolean;
    transcribeCalls: boolean;
    maxQueueTime: number;
    welcomeMessage: string | null;
    holdMusicUrl: string | null;
    workingHours: Record<string, { start: string; end: string }>;
    outOfHoursMessage: string | null;
}

export interface PhoneNumber {
    numberId: string;
    numberKey: number;
    phoneNumber: string;
    friendlyName: string | null;
    provider: string;
    capabilities: {
        voice?: boolean;
        sms?: boolean;
        mms?: boolean;
    };
    status: number;
    statusText: string;
    createdAt: string;
}

export interface AvailableNumber {
    phoneNumber: string;
    friendlyName: string;
    locality: string;
    region: string;
    capabilities: Record<string, boolean>;
    monthlyPrice: string;
}

export interface Call {
    callId: string;
    direction: 'inbound' | 'outbound';
    fromNumber: string;
    toNumber: string;
    callerName: string | null;
    status: string;
    duration: number | null;
    recordingUrl: string | null;
    lineNumber: string;
    lineName: string | null;
    startedAt: string | null;
    endedAt: string | null;
    createdAt: string;
}

const callcenterService = {
    // ==================== SETTINGS ====================

    getSettings: async (): Promise<CallCenterSettings> => {
        const response = await axiosHttp.get('/callcenter/settings');
        return response.data.settings;
    },

    saveCredentials: async (accountSid: string, authToken: string): Promise<void> => {
        await axiosHttp.post('/callcenter/settings/credentials', { accountSid, authToken });
    },

    updateSettings: async (data: Partial<CallCenterSettings>): Promise<CallCenterSettings> => {
        const response = await axiosHttp.patch('/callcenter/settings', data);
        return response.data.settings;
    },

    // ==================== NUMBERS ====================

    getNumbers: async (): Promise<PhoneNumber[]> => {
        const response = await axiosHttp.get('/callcenter/numbers');
        return response.data.numbers;
    },

    searchAvailableNumbers: async (country = 'VN', type = 'local'): Promise<AvailableNumber[]> => {
        const response = await axiosHttp.get('/callcenter/numbers/search', {
            params: { country, type }
        });
        return response.data.numbers;
    },

    purchaseNumber: async (phoneNumber: string, friendlyName?: string): Promise<PhoneNumber> => {
        const response = await axiosHttp.post('/callcenter/numbers/purchase', {
            phoneNumber,
            friendlyName
        });
        return response.data.number;
    },

    releaseNumber: async (numberId: string): Promise<void> => {
        await axiosHttp.delete(`/callcenter/numbers/${numberId}`);
    },

    // ==================== CALLS ====================

    getCalls: async (limit = 50, offset = 0): Promise<Call[]> => {
        const response = await axiosHttp.get('/callcenter/calls', {
            params: { limit, offset }
        });
        return response.data.calls;
    },

    makeCall: async (fromNumberId: string, toNumber: string): Promise<Call> => {
        const response = await axiosHttp.post('/callcenter/calls', {
            fromNumberId,
            toNumber
        });
        return response.data.call;
    },

    // ==================== TOKEN ====================

    getAccessToken: async (): Promise<{ token: string; identity: string }> => {
        const response = await axiosHttp.get('/callcenter/token');
        return response.data;
    },

    // ==================== HELPERS ====================

    formatPhoneNumber: (number: string): string => {
        // Format Vietnamese number: +84 xxx xxx xxx
        if (number.startsWith('+84')) {
            const local = number.slice(3);
            return `+84 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
        }
        return number;
    },

    formatDuration: (seconds: number | null): string => {
        if (!seconds) return '-';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    },

    getCallStatusColor: (status: string): string => {
        switch (status) {
            case 'completed': return 'green';
            case 'in-progress': return 'blue';
            case 'ringing': return 'gold';
            case 'busy': return 'orange';
            case 'no-answer': return 'default';
            case 'failed': return 'red';
            case 'canceled': return 'default';
            default: return 'default';
        }
    },

    getCallStatusText: (status: string): string => {
        const texts: Record<string, string> = {
            'queued': 'Đang chờ',
            'ringing': 'Đang đổ chuông',
            'in-progress': 'Đang gọi',
            'completed': 'Hoàn thành',
            'busy': 'Bận',
            'no-answer': 'Không trả lời',
            'failed': 'Thất bại',
            'canceled': 'Đã hủy'
        };
        return texts[status] || status;
    }
};

export default callcenterService;
