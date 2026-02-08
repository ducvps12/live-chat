/**
 * Zalo Sync Service
 * Syncs Zalo friends as contacts and fetches user info
 */

const { getPool } = require('../../infra/mysql/mysql');
const { getClient } = require('../../services/ZaloBrowser');

/**
 * Sync Zalo friends list as contacts for a workspace
 */
const syncZaloFriends = async (workspaceId, api) => {
    try {
        console.log('[ZaloSync] Starting friend sync for workspace:', workspaceId);

        if (!api || !api.getAllFriends) {
            console.warn('[ZaloSync] API or getAllFriends not available');
            return { synced: 0, error: 'API not available' };
        }

        const friendsData = await api.getAllFriends();
        console.log('[ZaloSync] Got friends data:', typeof friendsData);

        const friends = friendsData?.data || friendsData?.friends || friendsData || [];

        if (!Array.isArray(friends) || friends.length === 0) {
            console.log('[ZaloSync] No friends found to sync');
            return { synced: 0 };
        }

        console.log(`[ZaloSync] Found ${friends.length} friends to sync`);

        let syncedCount = 0;
        for (const friend of friends) {
            try {
                await upsertZaloContact(workspaceId, {
                    zaloId: friend.userId || friend.uid || friend.id,
                    name: friend.displayName || friend.zaloName || friend.name || 'Zalo User',
                    avatar: friend.avatar || friend.avatarUrl,
                    phone: friend.phoneNumber || null,
                    gender: friend.gender || null,
                });
                syncedCount++;
            } catch (err) {
                console.error('[ZaloSync] Error syncing friend:', friend.userId, err.message);
            }
        }

        console.log(`[ZaloSync] Synced ${syncedCount}/${friends.length} friends`);
        return { synced: syncedCount, total: friends.length };

    } catch (error) {
        console.error('[ZaloSync] Error syncing friends:', error.message);
        return { synced: 0, error: error.message };
    }
};

/**
 * Get user info from Zalo API
 */
const getZaloUserInfo = async (workspaceId, zaloUserId) => {
    try {
        const client = getClient(workspaceId);
        if (!client) {
            console.warn('[ZaloSync] No client found for workspace:', workspaceId);
            return null;
        }

        const api = client.getAPI();
        if (!api || !api.getUserInfo) {
            console.warn('[ZaloSync] API or getUserInfo not available');
            return null;
        }

        const userInfo = await api.getUserInfo(zaloUserId);
        console.log('[ZaloSync] Got user info for:', zaloUserId);
        return userInfo?.data || userInfo;

    } catch (error) {
        console.error('[ZaloSync] Error getting user info:', error.message);
        return null;
    }
};

/**
 * Upsert (insert or update) a Zalo contact
 */
const upsertZaloContact = async (workspaceId, contactData) => {
    try {
        const pool = getPool();
        const { zaloId, name, avatar, phone, gender } = contactData;

        if (!zaloId) {
            console.warn('[ZaloSync] Skipping contact without zaloId');
            return;
        }

        const [wsRows] = await pool.execute(
            'SELECT WorkspaceKey FROM iam_Workspaces WHERE WorkspaceId = ?',
            [workspaceId]
        );

        if (!wsRows[0]) {
            console.warn('[ZaloSync] Workspace not found:', workspaceId);
            return;
        }

        const workspaceKey = wsRows[0].WorkspaceKey;

        try {
            const [existing] = await pool.execute(
                'SELECT ContactKey FROM iam_Contacts WHERE WorkspaceKey = ? AND ExternalId = ?',
                [workspaceKey, zaloId]
            );

            if (existing[0]) {
                await pool.execute(
                    `UPDATE iam_Contacts SET 
                        DisplayName = IFNULL(?, DisplayName),
                        AvatarUrl = IFNULL(?, AvatarUrl),
                        Phone = IFNULL(?, Phone),
                        Gender = IFNULL(?, Gender),
                        UpdatedAt = UTC_TIMESTAMP(3)
                    WHERE ContactKey = ?`,
                    [name, avatar, phone, gender, existing[0].ContactKey]
                );
                console.log('[ZaloSync] Updated contact:', zaloId);
            } else {
                await pool.execute(
                    `INSERT INTO iam_Contacts (WorkspaceKey, ExternalId, DisplayName, AvatarUrl, Phone, Gender, Source)
                    VALUES (?, ?, ?, ?, ?, ?, 'zalo_personal')`,
                    [workspaceKey, zaloId, name || `Zalo ${zaloId.substring(0, 8)}`, avatar, phone, gender]
                );
                console.log('[ZaloSync] Created contact:', zaloId);
            }
        } catch (tableErr) {
            if (tableErr.message && (tableErr.message.includes("doesn't exist") || tableErr.code === 'ER_NO_SUCH_TABLE')) {
                console.warn('[ZaloSync] Contacts table does not exist. Skipping contact sync.');
            } else {
                console.error('[ZaloSync] Contact DB error:', tableErr.message);
            }
        }
    } catch (error) {
        console.error('[ZaloSync] Error in upsertZaloContact:', error.message);
    }
};

/**
 * Update conversation with Zalo user info
 */
const updateConversationWithUserInfo = async (conversationKey, userInfo) => {
    if (!userInfo) return;

    const pool = getPool();
    const name = userInfo.displayName || userInfo.zaloName || userInfo.name;
    const avatar = userInfo.avatar || userInfo.avatarUrl;

    if (name) {
        await pool.execute(
            'UPDATE iam_WidgetConversations SET VisitorName = ?, VisitorAvatar = ?, UpdatedAt = UTC_TIMESTAMP(3) WHERE ConversationKey = ?',
            [name, avatar, conversationKey]
        );
        console.log('[ZaloSync] Updated conversation with user info:', conversationKey);
    }
};

module.exports = {
    syncZaloFriends,
    getZaloUserInfo,
    upsertZaloContact,
    updateConversationWithUserInfo,
};
