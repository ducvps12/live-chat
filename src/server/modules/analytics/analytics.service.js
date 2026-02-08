/**
 * Analytics Service - Business logic for dashboard metrics
 */
const analyticsRepo = require('./analytics.repo');

class AnalyticsService {
    /**
     * Get full dashboard data for a workspace
     */
    async getDashboardData(workspaceKey, dateRange = 'last30days') {
        const { startDate, endDate, days } = this.parseDateRange(dateRange);

        const [
            conversationStats,
            messageStats,
            conversationsByDay,
            messagesByDay,
            peakHours,
            responseTimeStats,
            widgetStats,
            botStats
        ] = await Promise.all([
            analyticsRepo.getConversationStats(workspaceKey, startDate, endDate),
            analyticsRepo.getMessageStats(workspaceKey, startDate, endDate),
            analyticsRepo.getConversationsByDay(workspaceKey, days),
            analyticsRepo.getMessagesByDay(workspaceKey, days),
            analyticsRepo.getPeakHours(workspaceKey, days),
            analyticsRepo.getResponseTimeStats(workspaceKey, days),
            analyticsRepo.getWidgetStats(workspaceKey),
            analyticsRepo.getBotStats(workspaceKey, days)
        ]);

        return {
            summary: {
                totalConversations: conversationStats?.totalConversations || 0,
                activeConversations: conversationStats?.activeConversations || 0,
                closedConversations: conversationStats?.closedConversations || 0,
                newToday: conversationStats?.newToday || 0,
                newThisWeek: conversationStats?.newThisWeek || 0,
                totalMessages: messageStats?.totalMessages || 0,
                visitorMessages: messageStats?.visitorMessages || 0,
                agentMessages: messageStats?.agentMessages || 0,
                botMessages: messageStats?.botMessages || 0
            },
            responseTime: {
                average: this.formatDuration(responseTimeStats?.avgResponseTimeSeconds),
                min: this.formatDuration(responseTimeStats?.minResponseTimeSeconds),
                max: this.formatDuration(responseTimeStats?.maxResponseTimeSeconds),
                respondedCount: responseTimeStats?.respondedConversations || 0
            },
            charts: {
                conversationsByDay: this.fillMissingDays(conversationsByDay, days),
                messagesByDay: this.fillMissingDays(messagesByDay, days)
            },
            peakHours: this.formatPeakHours(peakHours),
            widgets: widgetStats || [],
            bot: {
                messages: botStats?.botMessages || 0,
                responseRate: Math.round(botStats?.botResponseRate || 0)
            },
            dateRange: { startDate, endDate, days }
        };
    }

    /**
     * Get conversation stats only
     */
    async getConversationStats(workspaceKey, dateRange = 'last30days') {
        const { startDate, endDate } = this.parseDateRange(dateRange);
        return analyticsRepo.getConversationStats(workspaceKey, startDate, endDate);
    }

    /**
     * Get message stats only
     */
    async getMessageStats(workspaceKey, dateRange = 'last30days') {
        const { startDate, endDate } = this.parseDateRange(dateRange);
        return analyticsRepo.getMessageStats(workspaceKey, startDate, endDate);
    }

    /**
     * Get chart data
     */
    async getChartData(workspaceKey, type = 'conversations', days = 30) {
        if (type === 'messages') {
            const data = await analyticsRepo.getMessagesByDay(workspaceKey, days);
            return this.fillMissingDays(data, days);
        }
        const data = await analyticsRepo.getConversationsByDay(workspaceKey, days);
        return this.fillMissingDays(data, days);
    }

    /**
     * Parse date range string to actual dates
     */
    parseDateRange(dateRange) {
        const now = new Date();
        let startDate, endDate = now, days;

        switch (dateRange) {
            case 'today':
                startDate = new Date(now.setHours(0, 0, 0, 0));
                days = 1;
                break;
            case 'yesterday':
                startDate = new Date(now);
                startDate.setDate(startDate.getDate() - 1);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(startDate);
                endDate.setHours(23, 59, 59, 999);
                days = 1;
                break;
            case 'last7days':
                startDate = new Date(now);
                startDate.setDate(startDate.getDate() - 7);
                days = 7;
                break;
            case 'last30days':
            default:
                startDate = new Date(now);
                startDate.setDate(startDate.getDate() - 30);
                days = 30;
                break;
            case 'last90days':
                startDate = new Date(now);
                startDate.setDate(startDate.getDate() - 90);
                days = 90;
                break;
            case 'thisMonth':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                days = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));
                break;
            case 'lastMonth':
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                endDate = new Date(now.getFullYear(), now.getMonth(), 0);
                days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
                break;
        }

        return { startDate, endDate: new Date(), days };
    }

    /**
     * Format seconds to human readable duration
     */
    formatDuration(seconds) {
        if (!seconds || seconds < 0) return 'N/A';

        if (seconds < 60) return `${Math.round(seconds)}s`;
        if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
        return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
    }

    /**
     * Fill missing days in chart data
     */
    fillMissingDays(data, days) {
        const result = [];
        const dataMap = new Map(data.map(d => [
            new Date(d.date).toISOString().split('T')[0],
            d
        ]));

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];

            if (dataMap.has(dateStr)) {
                result.push(dataMap.get(dateStr));
            } else {
                result.push({
                    date: dateStr,
                    count: 0,
                    visitorCount: 0,
                    agentCount: 0,
                    botCount: 0
                });
            }
        }

        return result;
    }

    /**
     * Format peak hours data for heatmap
     */
    formatPeakHours(data) {
        // Create 7x24 matrix (days x hours)
        const matrix = Array(7).fill(null).map(() => Array(24).fill(0));

        data.forEach(d => {
            const dayIndex = (d.dayOfWeek || 1) - 1; // SQL weekday is 1-7
            const hourIndex = d.hour || 0;
            if (dayIndex >= 0 && dayIndex < 7 && hourIndex >= 0 && hourIndex < 24) {
                matrix[dayIndex][hourIndex] = d.count;
            }
        });

        return {
            days: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'],
            hours: Array.from({ length: 24 }, (_, i) => `${i}:00`),
            data: matrix
        };
    }
}

module.exports = new AnalyticsService();
