// Types for Widget API

export interface WidgetTheme {
  title?: string;
  subtitle?: string;
  color: string;
  position: 'br' | 'bl';
  autoOpen?: boolean;
}

export interface Widget {
  widgetKey: number;
  widgetId: string;
  workspaceKey: number;
  name: string;
  siteKey: string;
  status: number;
  allowedDomains: string[];
  theme: WidgetTheme;
  createdAt: string;
  updatedAt?: string;
}

// Create Widget
export interface CreateWidgetRequest {
  name: string;
  allowedDomains: string[];
  theme: WidgetTheme;
}

export interface CreateWidgetResponse {
  widget: Widget;
}

// Update Widget
export interface UpdateWidgetRequest {
  name?: string;
  status?: number;
  allowedDomains?: string[];
  theme?: Partial<WidgetTheme>;
}

// Get Embed Code
export interface EmbedCodeResponse {
  embedCode: string;
  siteKey: string;
  apiBase: string;
}

// Public Widget Config
export interface PublicWidgetConfig {
  widgetId: string;
  theme: WidgetTheme;
  status: number;
}
