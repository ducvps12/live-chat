const asyncHandler = require('../../utils/asyncHandler');
const onboardingService = require('./onboarding.service');

/**
 * GET /api/onboarding/status
 */
const checkStatus = asyncHandler(async (req, res) => {
    const userKey = req.user?.UserKey || req.user?.key;
    const status = await onboardingService.checkStatus(userKey);

    res.status(200).json({
        status: 'success',
        data: status
    });
});

/**
 * POST /api/onboarding/complete
 */
const completeOnboarding = asyncHandler(async (req, res) => {
    const userKey = req.user?.UserKey || req.user?.key;
    const { workspaceKey } = req.body;

    if (!workspaceKey) {
        return res.status(400).json({
            status: 'error',
            message: 'workspaceKey is required'
        });
    }

    const result = await onboardingService.completeOnboarding(userKey, workspaceKey);

    res.status(200).json({
        status: 'success',
        message: 'Workspace activated successfully',
        data: result
    });
});

module.exports = {
    checkStatus,
    completeOnboarding
};
