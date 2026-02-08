import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useDemoContext, DeviceType, ChatMessage } from '@/contexts/DemoContext';

// Device dimensions for preview
const DEVICE_SIZES: Record<DeviceType, { width: string; height: string; label: string; icon: string }> = {
    desktop: { width: '100%', height: '100%', label: 'Desktop', icon: 'computer' },
    tablet: { width: '768px', height: '100%', label: 'Tablet', icon: 'tablet_mac' },
    mobile: { width: '375px', height: '100%', label: 'Mobile', icon: 'smartphone' },
};

export default function DemoPreview() {
    const { t } = useTranslation();
    const {
        previewUrl,
        isPreviewActive,
        isLoading,
        widgetConfig,
        deviceType,
        setDeviceType,
        chatMessages,
        isTyping,
        sendChatMessage
    } = useDemoContext();

    const [isChatOpen, setIsChatOpen] = useState(false);
    const [showTooltip, setShowTooltip] = useState(true);
    const [messageInput, setMessageInput] = useState('');
    const chatRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Hide tooltip after first interaction
    useEffect(() => {
        if (isChatOpen) {
            setShowTooltip(false);
        }
    }, [isChatOpen]);

    // Scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages, isTyping]);

    // Toggle chat popup
    const handleBubbleClick = useCallback(() => {
        setIsChatOpen(prev => !prev);
        setShowTooltip(false);
    }, []);

    // Handle send message
    const handleSendMessage = useCallback(() => {
        if (messageInput.trim()) {
            sendChatMessage(messageInput);
            setMessageInput('');
        }
    }, [messageInput, sendChatMessage]);

    // Handle Enter key
    const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    }, [handleSendMessage]);

    // Get theme-based styles
    const getThemeStyles = () => {
        switch (widgetConfig.theme) {
            case 'dark':
                return {
                    bg: 'bg-gray-900',
                    headerBg: 'bg-gray-800',
                    text: 'text-white',
                    subtext: 'text-gray-400',
                    messageBg: 'bg-gray-700',
                    inputBg: 'bg-gray-800',
                };
            case 'light':
            default:
                return {
                    bg: 'bg-white',
                    headerBg: '',
                    text: 'text-gray-900',
                    subtext: 'text-gray-500',
                    messageBg: 'bg-gray-100',
                    inputBg: 'bg-gray-100',
                };
        }
    };

    const theme = getThemeStyles();
    const isRightPosition = widgetConfig.position === 'bottom-right';

    // Render mock website content
    const renderMockWebsite = () => (
        <div className="absolute inset-0 p-6">
            {/* Mock Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-300"></div>
                    <div className="h-4 w-24 bg-gray-300 rounded"></div>
                </div>
                <div className="flex gap-4">
                    <div className="h-4 w-16 bg-gray-200 rounded"></div>
                    <div className="h-4 w-16 bg-gray-200 rounded"></div>
                    <div className="h-4 w-16 bg-gray-200 rounded"></div>
                </div>
            </div>

            {/* Mock Hero */}
            <div className="mb-8">
                <div className="h-8 w-2/3 bg-gray-300 rounded mb-4"></div>
                <div className="h-4 w-1/2 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 w-1/3 bg-gray-200 rounded mb-6"></div>
                <div className="flex gap-3">
                    <div className="h-10 w-28 rounded-lg" style={{ backgroundColor: widgetConfig.primaryColor + '40' }}></div>
                    <div className="h-10 w-28 bg-gray-200 rounded-lg"></div>
                </div>
            </div>

            {/* Mock Cards */}
            <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                        <div className="h-24 bg-gray-200 rounded-lg mb-3"></div>
                        <div className="h-4 w-3/4 bg-gray-200 rounded mb-2"></div>
                        <div className="h-3 w-1/2 bg-gray-100 rounded"></div>
                    </div>
                ))}
            </div>
        </div>
    );

    // Render chat widget
    const renderChatWidget = () => (
        <div
            className={`absolute bottom-6 z-20 ${isRightPosition ? 'right-6' : 'left-6'}`}
            ref={chatRef}
        >
            <div className="relative">
                {/* Tooltip */}
                {showTooltip && !isChatOpen && (
                    <div
                        className={`absolute bottom-16 ${isRightPosition ? 'right-0' : 'left-0'} 
                            bg-gray-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg whitespace-nowrap
                            animate-bounce`}
                    >
                        {t('demo.preview.tooltip', 'Nhấn để mở chat! 👋')}
                        <div
                            className={`absolute bottom-[-6px] ${isRightPosition ? 'right-6' : 'left-6'} 
                                w-3 h-3 bg-gray-900 rotate-45`}
                        ></div>
                    </div>
                )}

                {/* Chat Popup */}
                <div
                    className={`absolute bottom-20 ${isRightPosition ? 'right-0' : 'left-0'} 
                        w-[360px] ${theme.bg} shadow-2xl overflow-hidden 
                        origin-bottom transform transition-all duration-300 ${isChatOpen
                            ? 'scale-100 opacity-100 translate-y-0'
                            : 'scale-95 opacity-0 translate-y-4 pointer-events-none'
                        }`}
                    style={{ borderRadius: `${widgetConfig.borderRadius}px` }}
                >
                    {/* Header */}
                    <div
                        className="p-4 text-white relative overflow-hidden"
                        style={{ backgroundColor: widgetConfig.primaryColor }}
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
                        <div className="relative">
                            <div className="flex items-center justify-between mb-1">
                                <div className="font-bold text-lg">{widgetConfig.title}</div>
                                <button
                                    onClick={handleBubbleClick}
                                    className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-lg">close</span>
                                </button>
                            </div>
                            {widgetConfig.showStatus && (
                                <div className="text-sm opacity-90 flex items-center gap-2">
                                    <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                                    {widgetConfig.agentName} - {t('demo.preview.online', 'Đang hoạt động')}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Messages */}
                    <div className={`h-72 p-4 flex flex-col gap-3 overflow-y-auto ${widgetConfig.theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
                        }`}>
                        {/* Bot Welcome Message */}
                        <div className={`${theme.messageBg} self-start p-3 rounded-xl rounded-tl-none max-w-[85%]`}>
                            <div className={`text-sm ${theme.text}`}>
                                {widgetConfig.welcomeMessage}
                            </div>
                            <div className={`text-xs ${theme.subtext} mt-1`}>
                                {t('demo.preview.justNow', 'Vừa xong')}
                            </div>
                        </div>

                        {/* Dynamic Messages from Sandbox */}
                        {chatMessages.map((msg: ChatMessage) => (
                            <div
                                key={msg.id}
                                className={`p-3 rounded-xl max-w-[85%] text-sm ${msg.sender === 'user'
                                        ? 'self-end rounded-tr-none text-white'
                                        : `self-start rounded-tl-none ${theme.messageBg} ${theme.text}`
                                    }`}
                                style={msg.sender === 'user' ? { backgroundColor: widgetConfig.primaryColor } : {}}
                            >
                                {msg.content}
                            </div>
                        ))}

                        {/* Typing Indicator */}
                        {isTyping && (
                            <div className={`${theme.messageBg} self-start py-3 px-4 rounded-xl rounded-tl-none inline-flex gap-1`}>
                                <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className={`p-4 border-t ${widgetConfig.theme === 'dark' ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'
                        }`}>
                        <div className={`flex items-center gap-2 ${theme.inputBg} rounded-xl px-4 py-3`}>
                            <input
                                type="text"
                                value={messageInput}
                                onChange={(e) => setMessageInput(e.target.value)}
                                onKeyDown={handleKeyPress}
                                placeholder={t('demo.preview.inputPlaceholder', 'Nhập tin nhắn thử...')}
                                className={`flex-1 bg-transparent outline-none text-sm ${theme.text}`}
                            />
                            <button
                                onClick={handleSendMessage}
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white transition-transform hover:scale-105"
                                style={{ backgroundColor: widgetConfig.primaryColor }}
                            >
                                <span className="material-symbols-outlined text-lg">send</span>
                            </button>
                        </div>
                        <div className={`text-center text-xs ${theme.subtext} mt-3`}>
                            {t('demo.preview.poweredBy')}
                        </div>
                    </div>
                </div>

                {/* Chat Bubble */}
                <button
                    onClick={handleBubbleClick}
                    className={`w-16 h-16 rounded-full shadow-lg flex items-center justify-center text-white relative transition-all hover:scale-105 hover:shadow-xl ${widgetConfig.animation === 'bounce' && !isChatOpen ? 'animate-bounce' : ''
                        }`}
                    style={{ backgroundColor: widgetConfig.primaryColor }}
                >
                    {/* Pulse Animation */}
                    {widgetConfig.animation === 'pulse' && !isChatOpen && (
                        <div
                            className="absolute inset-0 rounded-full animate-ping opacity-30"
                            style={{ backgroundColor: widgetConfig.primaryColor }}
                        ></div>
                    )}

                    {/* Fade Animation */}
                    {widgetConfig.animation === 'fade' && !isChatOpen && (
                        <div
                            className="absolute inset-0 rounded-full animate-pulse opacity-50"
                            style={{ backgroundColor: widgetConfig.primaryColor }}
                        ></div>
                    )}

                    <span className={`material-symbols-outlined text-3xl transition-transform ${isChatOpen ? 'rotate-90' : ''}`}>
                        {isChatOpen ? 'close' : 'chat_bubble'}
                    </span>

                    {/* Notification Badge */}
                    {!isChatOpen && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold">
                            1
                        </div>
                    )}
                </button>
            </div>
        </div>
    );

    return (
        <div className="bg-white border border-gray-200 rounded-2xl flex flex-col relative group shadow-md hover:shadow-xl transition-shadow overflow-hidden">
            {/* Browser Bar */}
            <div className="h-12 border-b border-gray-200 bg-gray-50 flex items-center px-4 gap-4 select-none rounded-t-2xl">
                <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400 hover:bg-red-500 transition-colors cursor-pointer"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-400 hover:bg-yellow-500 transition-colors cursor-pointer"></div>
                    <div className="w-3 h-3 rounded-full bg-green-400 hover:bg-green-500 transition-colors cursor-pointer"></div>
                </div>
                <div className="flex-1 bg-white border border-gray-200 h-7 rounded-lg flex items-center px-3 text-xs text-gray-600 font-mono overflow-hidden shadow-inner">
                    <span className="material-symbols-outlined text-[12px] mr-2 text-green-500">lock</span>
                    <span className="truncate">
                        {previewUrl || t('demo.preview.browserUrl')}
                    </span>
                </div>

                {/* Device Switcher */}
                <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                    {(Object.keys(DEVICE_SIZES) as DeviceType[]).map((device) => (
                        <button
                            key={device}
                            onClick={() => setDeviceType(device)}
                            className={`p-1.5 rounded-md transition-all ${deviceType === device
                                ? 'bg-white shadow-sm text-electric-blue'
                                : 'text-gray-400 hover:text-gray-600'
                                }`}
                            title={DEVICE_SIZES[device].label}
                        >
                            <span className="material-symbols-outlined text-lg">
                                {DEVICE_SIZES[device].icon}
                            </span>
                        </button>
                    ))}
                </div>

                <div className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${isPreviewActive
                    ? 'bg-green-100 border border-green-300 text-green-600'
                    : 'bg-electric-blue/10 border border-electric-blue/30 text-electric-blue'
                    }`}>
                    {isPreviewActive
                        ? t('demo.preview.live', 'LIVE')
                        : t('demo.preview.previewMode')
                    }
                </div>
            </div>

            {/* Preview Content */}
            <div className={`flex-1 relative overflow-hidden min-h-[550px] rounded-b-2xl flex items-center justify-center ${widgetConfig.theme === 'dark' ? 'bg-gray-800' : 'bg-gradient-to-br from-gray-100 to-gray-50'
                }`}>
                {/* Loading State */}
                {isLoading && (
                    <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center z-50">
                        <div
                            className="w-16 h-16 border-4 border-gray-200 rounded-full animate-spin mb-4"
                            style={{ borderTopColor: widgetConfig.primaryColor }}
                        ></div>
                        <div className="font-mono text-sm" style={{ color: widgetConfig.primaryColor }}>
                            {t('demo.preview.loading')}
                        </div>
                        <div className="text-xs text-gray-400 mt-2">
                            {previewUrl}
                        </div>
                    </div>
                )}

                {/* Device Frame Container */}
                <div
                    className={`relative h-full transition-all duration-300 ease-out ${deviceType !== 'desktop' ? 'border-4 border-gray-300 rounded-2xl shadow-xl bg-white overflow-hidden' : ''
                        }`}
                    style={{
                        width: DEVICE_SIZES[deviceType].width,
                        maxWidth: '100%'
                    }}
                >
                    {/* Mock Website Background */}
                    {!isLoading && renderMockWebsite()}

                    {/* Chat Widget */}
                    {!isLoading && renderChatWidget()}
                </div>

                {/* Inactive Overlay */}
                {!isPreviewActive && !isLoading && (
                    <div className="absolute inset-0 bg-gray-900/5 flex items-center justify-center z-30">
                        <div className="text-center">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white shadow-lg flex items-center justify-center">
                                <span className="material-symbols-outlined text-4xl text-gray-400">
                                    preview
                                </span>
                            </div>
                            <div className="text-gray-600 font-medium">
                                {t('demo.preview.enterUrl', 'Nhập URL để xem preview')}
                            </div>
                            <div className="text-gray-400 text-sm mt-1">
                                {t('demo.preview.orSelectTemplate', 'Hoặc chọn template demo ở trên')}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

