/**
 * Resend an invite email
 */
const resendInvite = async ({ workspaceKey, inviteKey }) => {
    const invites = await inviteRepo.findPendingByWorkspace(workspaceKey);
    const invite = invites.find(i => i.InviteKey === parseInt(inviteKey));

    if (!invite) {
        throw new AppError('Invite not found or already accepted', 404);
    }

    // Check if expired
    if (new Date(invite.ExpiresAt) < new Date()) {
        throw new AppError('Invite has expired. Please create a new invite.', 400);
    }

    // Get full invite with token
    const fullInvite = await inviteRepo.findByKey(inviteKey);

    // TODO: Send email with token
    console.log(`[EMAIL] Resend invite to ${invite.Email} | Token: ${fullInvite.token}`);

    return {
        success: true,
        email: invite.Email,
        expiresAt: invite.ExpiresAt,
    };
};

module.exports.resendInvite = resendInvite;
