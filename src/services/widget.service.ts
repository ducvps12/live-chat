import api from '@/lib/http';
import { ApiResponse } from '@/types/api';
import {
  Widget,
  CreateWidgetRequest,
  UpdateWidgetRequest,
} from '@/types/widget';

// Backend returns widget data - AllowedDomains and Theme are JSON strings in response
interface CreateWidgetResponseData {
  WidgetId: string;
  WidgetKey: number;
  SiteKey: string;
  Name: string;
  AllowedDomains: string; // JSON string from DB
  Theme: string; // JSON string from DB
  scriptUrl?: string;
  embedScript?: string;
}

interface EmbedCodeResponseData {
  scriptUrl: string;
  embedScript: string;
}

export const WidgetService = {
  /**
   * Create a new widget
   * POST /api/widgets
   * Requires x-workspace-id header
   */
  create: async (workspaceId: string, data: CreateWidgetRequest) => {
    const response = await api.post<ApiResponse<CreateWidgetResponseData>>(
      '/widgets',
      data,
      {
        headers: {
          'x-workspace-id': workspaceId,
        },
      }
    );
    const result = response.data.data;
    
    // Parse JSON strings from backend
    const allowedDomains = typeof result.AllowedDomains === 'string' 
      ? JSON.parse(result.AllowedDomains) 
      : result.AllowedDomains;
    const theme = typeof result.Theme === 'string'
      ? JSON.parse(result.Theme)
      : result.Theme;

    return {
      widget: {
        widgetId: result.WidgetId,
        widgetKey: result.WidgetKey,
        siteKey: result.SiteKey,
        name: result.Name,
        allowedDomains,
        theme,
      },
      embedCode: result.embedScript || '',
    };
  },

  /**
   * Get a widget by ID
   * GET /api/widgets/{widgetId}
   */
  get: async (workspaceId: string, widgetId: string) => {
    const response = await api.get<ApiResponse<{ widget: Widget }>>(
      `/widgets/${widgetId}`,
      {
        headers: {
          'x-workspace-id': workspaceId,
        },
      }
    );
    return response.data.data.widget;
  },

  /**
   * Update a widget
   * PATCH /api/widgets/{widgetId}
   */
  update: async (
    workspaceId: string,
    widgetId: string,
    data: UpdateWidgetRequest
  ) => {
    const response = await api.patch<ApiResponse<{ widget: Widget }>>(
      `/widgets/${widgetId}`,
      data,
      {
        headers: {
          'x-workspace-id': workspaceId,
        },
      }
    );
    return response.data.data.widget;
  },

  /**
   * Get embed code for a widget
   * GET /api/widgets/{widgetId}/embed
   */
  getEmbedCode: async (workspaceId: string, widgetId: string) => {
    const response = await api.get<ApiResponse<EmbedCodeResponseData>>(
      `/widgets/${widgetId}/embed`,
      {
        headers: {
          'x-workspace-id': workspaceId,
        },
      }
    );
    return {
      embedCode: response.data.data.embedScript,
      scriptUrl: response.data.data.scriptUrl,
    };
  },

  /**
   * List widgets for workspace
   * GET /api/widgets
   */
  list: async (workspaceId: string) => {
    const response = await api.get<ApiResponse<{ widgets: Widget[] }>>(
      '/widgets',
      {
        headers: {
          'x-workspace-id': workspaceId,
        },
      }
    );
    return response.data.data.widgets;
  },
};
