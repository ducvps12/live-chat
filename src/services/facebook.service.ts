import api from './axios';

export interface FacebookPage {
    pageId: string;
    pageKey: number;
    facebookPageId: string;
    facebookPageName: string;
    facebookPageAvatar: string | null;
    status: number;
    statusText: string;
    lastSyncAt: string | null;
    errorMessage: string | null;
    settings: FacebookPageSettings;
    createdAt: string;
    updatedAt: string;
}

export interface FacebookPageSettings {
    autoReplyComment?: boolean;
}

export interface AvailableFacebookPage {
    id: string;
    name: string;
    avatar: string | null;
    category: string;
    accessToken: string;
    isConnected: boolean;
}

// Page status constants
export const PAGE_STATUS = {
    ACTIVE: 1,
    DISCONNECTED: 2,
    TOKEN_EXPIRED: 3,
    ERROR: 4
} as const;

/**
 * Get OAuth URL to start Facebook login flow
 */
export const getOAuthUrl = async (workspaceId: string) => {
    const response = await api.get('/facebook/oauth/url', {
        headers: {
            'x-workspace-id': workspaceId
        }
    });
    return response.data.data as { url: string; redirectUri: string };
};

/**
 * Get connected Facebook pages for workspace
 */
export const getConnectedPages = async (workspaceId: string) => {
    const response = await api.get('/facebook/pages', {
        headers: {
            'x-workspace-id': workspaceId
        }
    });
    return response.data.data.pages as FacebookPage[];
};

/**
 * Get available pages from Facebook after OAuth
 */
export const getAvailablePages = async (workspaceId: string, token: string) => {
    const response = await api.get('/facebook/pages/available', {
        params: { token },
        headers: {
            'x-workspace-id': workspaceId
        }
    });
    return response.data.data.pages as AvailableFacebookPage[];
};

/**
 * Connect selected pages to workspace
 */
export const connectPages = async (
    workspaceId: string,
    pages: Array<{ id: string; name: string }>,
    token: string
) => {
    const response = await api.post(
        '/facebook/pages/connect',
        { pages, token },
        {
            headers: {
                'x-workspace-id': workspaceId
            }
        }
    );
    return response.data.data as {
        connected: FacebookPage[];
        errors: Array<{ pageId: string; pageName: string; error: string }>;
    };
};

/**
 * Disconnect a page
 */
export const disconnectPage = async (workspaceId: string, pageId: string) => {
    const response = await api.delete(`/facebook/pages/${pageId}`, {
        headers: {
            'x-workspace-id': workspaceId
        }
    });
    return response.data;
};

/**
 * Update page settings
 */
export const updatePageSettings = async (
    workspaceId: string,
    pageId: string,
    settings: FacebookPageSettings
) => {
    const response = await api.patch(
        `/facebook/pages/${pageId}/settings`,
        settings,
        {
            headers: {
                'x-workspace-id': workspaceId
            }
        }
    );
    return response.data.data;
};

/**
 * Open Facebook OAuth popup and wait for result
 */
export const openOAuthPopup = (url: string): Promise<{ token?: string; error?: string }> => {
    return new Promise((resolve) => {
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        const popup = window.open(
            url,
            'facebook-oauth',
            `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
        );

        // Poll for popup close or redirect
        const pollTimer = setInterval(() => {
            if (!popup || popup.closed) {
                clearInterval(pollTimer);
                // Check URL params from current page (in case popup redirected back)
                const urlParams = new URLSearchParams(window.location.search);
                const token = urlParams.get('token');
                const error = urlParams.get('error');

                // Clean up URL
                if (token || error) {
                    const newUrl = window.location.pathname;
                    window.history.replaceState({}, document.title, newUrl);
                }

                resolve({ token: token || undefined, error: error || undefined });
            } else {
                try {
                    // Try to read popup URL (will throw if cross-origin)
                    const popupUrl = popup.location.href;
                    if (popupUrl.includes('/settings/facebook')) {
                        const urlParams = new URLSearchParams(new URL(popupUrl).search);
                        const token = urlParams.get('token');
                        const error = urlParams.get('error');

                        popup.close();
                        clearInterval(pollTimer);
                        resolve({ token: token || undefined, error: error || undefined });
                    }
                } catch {
                    // Cross-origin, continue polling
                }
            }
        }, 500);
    });
};

export default {
    getOAuthUrl,
    getConnectedPages,
    getAvailablePages,
    connectPages,
    disconnectPage,
    updatePageSettings,
    openOAuthPopup,
    PAGE_STATUS
};
