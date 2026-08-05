export const zaloOAService = {
    readiness() {
        const appId = String(process.env.ZALO_OA_APP_ID || '').trim();
        const callbackUrl = String(process.env.ZALO_OA_CALLBACK_URL || '').trim();
        const appSecret = String(process.env.ZALO_OA_APP_SECRET || '').trim();
        const missing = [
            !appId && 'ZALO_OA_APP_ID',
            !appSecret && 'ZALO_OA_APP_SECRET',
            !callbackUrl && 'ZALO_OA_CALLBACK_URL',
        ].filter(Boolean) as string[];
        return {
            connector: 'zalo-oa',
            configured: missing.length === 0,
            appIdConfigured: Boolean(appId),
            appSecretConfigured: Boolean(appSecret),
            callbackUrl: callbackUrl || null,
            missing,
            status: missing.length ? 'configuration_required' : 'ready_for_oa_authorization',
            note: 'Chỉ đánh dấu connected sau khi workspace uỷ quyền OA và webhook được xác minh.',
        };
    },
};
