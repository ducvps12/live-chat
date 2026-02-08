'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useMemo } from 'react';

// Widget configuration types
export interface WidgetConfig {
    theme: 'auto' | 'light' | 'dark';
    primaryColor: string;
    position: 'bottom-right' | 'bottom-left';
    title: string;
    welcomeMessage: string;
    // New fields for Phase 1
    avatar: string | null;
    agentName: string;
    showStatus: boolean;
    borderRadius: number;
    animation: 'bounce' | 'pulse' | 'fade' | 'none';
    bubbleStyle: 'icon' | 'text' | 'icon-text';
    autoOpenDelay: number; // 0 = disabled, else seconds
    soundEnabled: boolean;
}

// Device types for preview
export type DeviceType = 'desktop' | 'tablet' | 'mobile';


// Demo templates
export interface DemoTemplate {
    id: string;
    name: string;
    nameKey: string;
    url: string;
    description: string;
}

export const DEMO_TEMPLATES: DemoTemplate[] = [
    {
        id: 'ecommerce',
        name: 'E-Commerce',
        nameKey: 'demo.hero.templates.ecommerce',
        url: 'https://demo-store.nemark.com',
        description: 'Trang bán hàng với giỏ hàng, sản phẩm'
    },
    {
        id: 'saas',
        name: 'SaaS',
        nameKey: 'demo.hero.templates.saas',
        url: 'https://demo-saas.nemark.com',
        description: 'Trang dịch vụ SaaS với pricing, features'
    },
    {
        id: 'landing',
        name: 'Landing Page',
        nameKey: 'demo.hero.templates.landing',
        url: 'https://demo-landing.nemark.com',
        description: 'Landing page marketing đơn giản'
    }
];

// Color presets
export const COLOR_PRESETS = [
    { id: 'blue', value: '#0da6f2', name: 'Electric Blue' },
    { id: 'purple', value: '#a855f7', name: 'Purple' },
    { id: 'teal', value: '#14b8a6', name: 'Teal' },
    { id: 'orange', value: '#f59e0b', name: 'Orange' },
    { id: 'red', value: '#ef4444', name: 'Red' },
    { id: 'green', value: '#22c55e', name: 'Green' },
];

// Animation presets
export const ANIMATION_PRESETS = [
    { id: 'bounce', name: 'Bounce', icon: 'trending_up' },
    { id: 'pulse', name: 'Pulse', icon: 'radio_button_checked' },
    { id: 'fade', name: 'Fade', icon: 'blur_on' },
    { id: 'none', name: 'None', icon: 'block' },
];

// Bubble style presets
export const BUBBLE_STYLE_PRESETS = [
    { id: 'icon', name: 'Icon Only', example: '💬' },
    { id: 'text', name: 'Text Only', example: 'Chat' },
    { id: 'icon-text', name: 'Icon + Text', example: '💬 Chat' },
];

// Chat message for sandbox
export interface ChatMessage {
    id: string;
    content: string;
    sender: 'user' | 'bot';
    timestamp: Date;
}

// Mock AI responses
const MOCK_RESPONSES = [
    'Cảm ơn bạn đã liên hệ! Tôi có thể giúp gì cho bạn?',
    'Vâng, tôi hiểu rồi. Để tôi kiểm tra thông tin cho bạn nhé!',
    'Đây là demo thử nghiệm. Trong ứng dụng thực, bạn sẽ được kết nối với nhân viên hỗ trợ.',
    'Bạn có thể cho tôi biết thêm chi tiết không?',
    'Tuyệt vời! Tôi sẽ hỗ trợ bạn ngay.',
];

// Default widget config
const DEFAULT_WIDGET_CONFIG: WidgetConfig = {
    theme: 'light',
    primaryColor: '#0da6f2',
    position: 'bottom-right',
    title: 'Hỗ trợ khách hàng',
    welcomeMessage: 'Xin chào! Chúng tôi có thể giúp gì cho bạn?',
    // New fields
    avatar: null,
    agentName: 'Hỗ Trợ Viên',
    showStatus: true,
    borderRadius: 16,
    animation: 'pulse',
    bubbleStyle: 'icon',
    autoOpenDelay: 0,
    soundEnabled: true,
};

// Context state
interface DemoContextState {
    // Preview state
    previewUrl: string;
    isPreviewActive: boolean;
    isLoading: boolean;
    selectedTemplate: string | null;

    // Device state
    deviceType: DeviceType;

    // Widget config
    widgetConfig: WidgetConfig;

    // Sandbox chat state
    chatMessages: ChatMessage[];
    isTyping: boolean;

    // Actions
    setPreviewUrl: (url: string) => void;
    startPreview: (url?: string) => void;
    stopPreview: () => void;
    selectTemplate: (templateId: string) => void;
    updateWidgetConfig: (config: Partial<WidgetConfig>) => void;
    resetWidgetConfig: () => void;
    setDeviceType: (device: DeviceType) => void;
    sendChatMessage: (content: string) => void;
    resetChat: () => void;
}

const DemoContext = createContext<DemoContextState | undefined>(undefined);

interface DemoProviderProps {
    children: ReactNode;
}

export function DemoProvider({ children }: DemoProviderProps) {
    // State
    const [previewUrl, setPreviewUrl] = useState('');
    const [isPreviewActive, setIsPreviewActive] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
    const [widgetConfig, setWidgetConfig] = useState<WidgetConfig>(DEFAULT_WIDGET_CONFIG);
    const [deviceType, setDeviceType] = useState<DeviceType>('desktop');
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [isTyping, setIsTyping] = useState(false);

    // Start preview with optional URL
    const startPreview = useCallback((url?: string) => {
        const targetUrl = url || previewUrl;
        if (!targetUrl) return;

        setIsLoading(true);
        setPreviewUrl(targetUrl);

        // Simulate loading time
        setTimeout(() => {
            setIsPreviewActive(true);
            setIsLoading(false);
        }, 800);
    }, [previewUrl]);

    // Stop preview
    const stopPreview = useCallback(() => {
        setIsPreviewActive(false);
        setIsLoading(false);
    }, []);

    // Select template
    const selectTemplate = useCallback((templateId: string) => {
        const template = DEMO_TEMPLATES.find(t => t.id === templateId);
        if (template) {
            setSelectedTemplate(templateId);
            setPreviewUrl(template.url);
            startPreview(template.url);
        }
    }, [startPreview]);

    // Update widget config
    const updateWidgetConfig = useCallback((config: Partial<WidgetConfig>) => {
        setWidgetConfig(prev => ({ ...prev, ...config }));
    }, []);

    // Reset widget config
    const resetWidgetConfig = useCallback(() => {
        setWidgetConfig(DEFAULT_WIDGET_CONFIG);
    }, []);

    // Send chat message (sandbox mode)
    const sendChatMessage = useCallback((content: string) => {
        if (!content.trim()) return;

        // Add user message
        const userMessage: ChatMessage = {
            id: `msg-${Date.now()}`,
            content: content.trim(),
            sender: 'user',
            timestamp: new Date()
        };
        setChatMessages(prev => [...prev, userMessage]);

        // Simulate bot typing
        setIsTyping(true);
        setTimeout(() => {
            const randomResponse = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];
            const botMessage: ChatMessage = {
                id: `msg-${Date.now()}-bot`,
                content: randomResponse,
                sender: 'bot',
                timestamp: new Date()
            };
            setChatMessages(prev => [...prev, botMessage]);
            setIsTyping(false);
        }, 1000 + Math.random() * 1500);
    }, []);

    // Reset chat
    const resetChat = useCallback(() => {
        setChatMessages([]);
        setIsTyping(false);
    }, []);

    // Context value
    const value = useMemo(() => ({
        previewUrl,
        isPreviewActive,
        isLoading,
        selectedTemplate,
        widgetConfig,
        deviceType,
        chatMessages,
        isTyping,
        setPreviewUrl,
        startPreview,
        stopPreview,
        selectTemplate,
        updateWidgetConfig,
        resetWidgetConfig,
        setDeviceType,
        sendChatMessage,
        resetChat
    }), [
        previewUrl,
        isPreviewActive,
        isLoading,
        selectedTemplate,
        widgetConfig,
        deviceType,
        chatMessages,
        isTyping,
        startPreview,
        stopPreview,
        selectTemplate,
        updateWidgetConfig,
        resetWidgetConfig,
        sendChatMessage,
        resetChat
    ]);

    return (
        <DemoContext.Provider value={value}>
            {children}
        </DemoContext.Provider>
    );
}

// Custom hook
export function useDemoContext() {
    const context = useContext(DemoContext);
    if (context === undefined) {
        throw new Error('useDemoContext must be used within a DemoProvider');
    }
    return context;
}

export default DemoContext;
