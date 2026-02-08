/**
 * Analytics Controller - API endpoints for dashboard
 */
const analyticsService = require('./analytics.service');

class AnalyticsController {
    /**
     * GET /workspaces/:workspaceId/analytics/dashboard
     * Get full dashboard data
     */
    async getDashboard(req, res) {
        try {
            const { workspaceKey } = req.workspace;
            const { range = 'last30days' } = req.query;

            const data = await analyticsService.getDashboardData(workspaceKey, range);

            res.json({
                success: true,
                data
            });
        } catch (error) {
            console.error('[AnalyticsController.getDashboard] Error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch dashboard data'
            });
        }
    }

    /**
     * GET /workspaces/:workspaceId/analytics/conversations
     * Get conversation statistics
     */
    async getConversationStats(req, res) {
        try {
            const { workspaceKey } = req.workspace;
            const { range = 'last30days' } = req.query;

            const stats = await analyticsService.getConversationStats(workspaceKey, range);

            res.json({
                success: true,
                data: { stats }
            });
        } catch (error) {
            console.error('[AnalyticsController.getConversationStats] Error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch conversation stats'
            });
        }
    }

    /**
     * GET /workspaces/:workspaceId/analytics/messages
     * Get message statistics
     */
    async getMessageStats(req, res) {
        try {
            const { workspaceKey } = req.workspace;
            const { range = 'last30days' } = req.query;

            const stats = await analyticsService.getMessageStats(workspaceKey, range);

            res.json({
                success: true,
                data: { stats }
            });
        } catch (error) {
            console.error('[AnalyticsController.getMessageStats] Error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch message stats'
            });
        }
    }

    /**
     * GET /workspaces/:workspaceId/analytics/chart
     * Get chart data (conversations or messages by day)
     */
    async getChartData(req, res) {
        try {
            const { workspaceKey } = req.workspace;
            const { type = 'conversations', days = 30 } = req.query;

            const data = await analyticsService.getChartData(workspaceKey, type, parseInt(days));

            res.json({
                success: true,
                data: { chartData: data }
            });
        } catch (error) {
            console.error('[AnalyticsController.getChartData] Error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch chart data'
            });
        }
    }
}

module.exports = new AnalyticsController();
