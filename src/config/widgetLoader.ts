export const WIDGET_LOADER_VERSION =
    process.env.NEXT_PUBLIC_WIDGET_LOADER_VERSION || '20260731.2';

export const WIDGET_LOADER_PATH =
    `/widget/loader.js?v=${encodeURIComponent(WIDGET_LOADER_VERSION)}`;

export const getWidgetLoaderUrl = (origin: string) =>
    `${origin.replace(/\/+$/, '')}${WIDGET_LOADER_PATH}`;
