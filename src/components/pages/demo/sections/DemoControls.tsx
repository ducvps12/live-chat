import { useTranslation } from 'react-i18next';
import { useCallback, useState } from 'react';
import { useDemoContext, COLOR_PRESETS, ANIMATION_PRESETS } from '@/contexts/DemoContext';

export default function DemoControls() {
    const { t } = useTranslation();
    const {
        widgetConfig,
        updateWidgetConfig,
        isPreviewActive,
        previewUrl
    } = useDemoContext();

    const [copied, setCopied] = useState(false);

    // Handle theme change
    const handleThemeChange = useCallback((theme: 'auto' | 'light' | 'dark') => {
        updateWidgetConfig({ theme });
    }, [updateWidgetConfig]);

    // Handle color change
    const handleColorChange = useCallback((color: string) => {
        updateWidgetConfig({ primaryColor: color });
    }, [updateWidgetConfig]);

    // Handle position change
    const handlePositionChange = useCallback((checked: boolean) => {
        updateWidgetConfig({ position: checked ? 'bottom-right' : 'bottom-left' });
    }, [updateWidgetConfig]);

    // Generate embed code
    const generateEmbedCode = useCallback(() => {
        return `<script 
  src="https://cdn.nemark.com/widget.js"
  data-site-key="YOUR_SITE_KEY"
  data-primary-color="${widgetConfig.primaryColor}"
  data-position="${widgetConfig.position}"
  data-title="${widgetConfig.title}"
></script>`;
    }, [widgetConfig]);

    // Copy embed code
    const handleCopyCode = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(generateEmbedCode());
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }, [generateEmbedCode]);

    const isPositionRight = widgetConfig.position === 'bottom-right';
    const selectedColorId = COLOR_PRESETS.find(c => c.value === widgetConfig.primaryColor)?.id || 'blue';

    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 flex flex-col shadow-md hover:shadow-xl transition-shadow h-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4">
                <h3 className="font-bold text-lg flex items-center gap-2 text-gray-900">
                    <span className="material-symbols-outlined text-electric-blue">tune</span>
                    {t('demo.controls.title')}
                </h3>
                <div className={`text-xs px-2 py-1 rounded font-medium ${isPreviewActive
                    ? 'text-green-600 bg-green-100'
                    : 'text-gray-500 bg-gray-100'
                    }`}>
                    {isPreviewActive ? (
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            {t('demo.controls.livePreview')}
                        </span>
                    ) : (
                        t('demo.controls.inactive', 'Chưa kích hoạt')
                    )}
                </div>
            </div>

            {/* Controls */}
            <div className="space-y-6 overflow-y-auto pr-2 flex-1 custom-scrollbar">
                {/* Theme Selector */}
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase mb-3 block tracking-wider">
                        {t('demo.controls.theme.label')}
                    </label>
                    <div className="grid grid-cols-3 gap-2 bg-gray-100 p-1 rounded-lg">
                        {(['auto', 'light', 'dark'] as const).map((theme) => (
                            <button
                                key={theme}
                                onClick={() => handleThemeChange(theme)}
                                className={`py-2.5 text-xs rounded-md font-medium transition-all flex items-center justify-center gap-1.5 ${widgetConfig.theme === theme
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                                    }`}
                            >
                                <span className="material-symbols-outlined text-sm">
                                    {theme === 'auto' ? 'contrast' : theme === 'light' ? 'light_mode' : 'dark_mode'}
                                </span>
                                {t(`demo.controls.theme.${theme}`)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Color Picker */}
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase mb-3 block tracking-wider">
                        {t('demo.controls.color.label')}
                    </label>
                    <div className="flex gap-3 flex-wrap">
                        {COLOR_PRESETS.map((color) => (
                            <button
                                key={color.id}
                                onClick={() => handleColorChange(color.value)}
                                title={color.name}
                                className={`w-10 h-10 rounded-full transition-all relative ${selectedColorId === color.id
                                    ? 'ring-2 ring-offset-2 ring-gray-400 scale-110'
                                    : 'hover:scale-110 hover:shadow-lg'
                                    }`}
                                style={{ backgroundColor: color.value }}
                            >
                                {selectedColorId === color.id && (
                                    <span className="absolute inset-0 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-white text-lg drop-shadow-lg">
                                            check
                                        </span>
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Position Toggle */}
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase mb-3 block tracking-wider">
                        {t('demo.controls.position.label')}
                    </label>
                    <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-gray-500 text-lg">
                                {isPositionRight ? 'align_horizontal_right' : 'align_horizontal_left'}
                            </span>
                            <span className="text-sm text-gray-700 font-medium">
                                {isPositionRight
                                    ? t('demo.controls.position.bottomRight')
                                    : t('demo.controls.position.bottomLeft', 'Góc trái dưới')
                                }
                            </span>
                        </div>
                        <button
                            onClick={() => handlePositionChange(!isPositionRight)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isPositionRight ? 'bg-electric-blue' : 'bg-gray-300'
                                }`}
                        >
                            <span
                                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${isPositionRight ? 'translate-x-5' : 'translate-x-0.5'
                                    }`}
                            />
                        </button>
                    </div>
                </div>

                {/* Widget Title */}
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase mb-3 block tracking-wider">
                        {t('demo.controls.title.label', 'Tiêu đề Widget')}
                    </label>
                    <input
                        type="text"
                        value={widgetConfig.title}
                        onChange={(e) => updateWidgetConfig({ title: e.target.value })}
                        placeholder="Hỗ trợ khách hàng"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all"
                    />
                </div>

                {/* Welcome Message */}
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase mb-3 block tracking-wider">
                        {t('demo.controls.welcomeMessage.label', 'Lời chào')}
                    </label>
                    <textarea
                        value={widgetConfig.welcomeMessage}
                        onChange={(e) => updateWidgetConfig({ welcomeMessage: e.target.value })}
                        placeholder="Xin chào! Chúng tôi có thể giúp gì cho bạn?"
                        rows={2}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all resize-none"
                    />
                </div>

                {/* Divider - Advanced Settings */}
                <div className="border-t border-gray-100 pt-4">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">settings</span>
                        {t('demo.controls.advanced', 'Tùy chỉnh nâng cao')}
                    </div>
                </div>

                {/* Agent Name */}
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase mb-3 block tracking-wider">
                        {t('demo.controls.agentName.label', 'Tên hỗ trợ viên')}
                    </label>
                    <input
                        type="text"
                        value={widgetConfig.agentName}
                        onChange={(e) => updateWidgetConfig({ agentName: e.target.value })}
                        placeholder="Hỗ Trợ Viên"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all"
                    />
                </div>

                {/* Border Radius Slider */}
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase mb-3 block tracking-wider">
                        {t('demo.controls.borderRadius.label', 'Bo góc')}
                        <span className="ml-2 text-electric-blue">{widgetConfig.borderRadius}px</span>
                    </label>
                    <input
                        type="range"
                        min="0"
                        max="24"
                        value={widgetConfig.borderRadius}
                        onChange={(e) => updateWidgetConfig({ borderRadius: parseInt(e.target.value) })}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-electric-blue"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>0px</span>
                        <span>24px</span>
                    </div>
                </div>

                {/* Animation Selector */}
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase mb-3 block tracking-wider">
                        {t('demo.controls.animation.label', 'Hiệu ứng')}
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                        {ANIMATION_PRESETS.map((anim) => (
                            <button
                                key={anim.id}
                                onClick={() => updateWidgetConfig({ animation: anim.id as 'bounce' | 'pulse' | 'fade' | 'none' })}
                                className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-1 ${widgetConfig.animation === anim.id
                                    ? 'border-electric-blue bg-electric-blue/10 text-electric-blue'
                                    : 'border-gray-200 hover:border-gray-300 text-gray-500'
                                    }`}
                                title={anim.name}
                            >
                                <span className="material-symbols-outlined text-lg">{anim.icon}</span>
                                <span className="text-[10px] font-medium">{anim.name}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Sound Toggle */}
                <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-gray-500 text-lg">
                            {widgetConfig.soundEnabled ? 'volume_up' : 'volume_off'}
                        </span>
                        <span className="text-sm text-gray-700 font-medium">
                            {t('demo.controls.sound.label', 'Âm thanh thông báo')}
                        </span>
                    </div>
                    <button
                        onClick={() => updateWidgetConfig({ soundEnabled: !widgetConfig.soundEnabled })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${widgetConfig.soundEnabled ? 'bg-electric-blue' : 'bg-gray-300'
                            }`}
                    >
                        <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${widgetConfig.soundEnabled ? 'translate-x-5' : 'translate-x-0.5'
                                }`}
                        />
                    </button>
                </div>

                {/* Online Status Toggle */}
                <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${widgetConfig.showStatus ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                        <span className="text-sm text-gray-700 font-medium">
                            {t('demo.controls.showStatus.label', 'Hiển thị trạng thái online')}
                        </span>
                    </div>
                    <button
                        onClick={() => updateWidgetConfig({ showStatus: !widgetConfig.showStatus })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${widgetConfig.showStatus ? 'bg-electric-blue' : 'bg-gray-300'
                            }`}
                    >
                        <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${widgetConfig.showStatus ? 'translate-x-5' : 'translate-x-0.5'
                                }`}
                        />
                    </button>
                </div>

                {/* Avatar URL */}
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase mb-3 block tracking-wider">
                        {t('demo.controls.avatar.label', 'Avatar URL')}
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={widgetConfig.avatar || ''}
                            onChange={(e) => updateWidgetConfig({ avatar: e.target.value || null })}
                            placeholder="https://example.com/avatar.png"
                            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all"
                        />
                        {widgetConfig.avatar && (
                            <div
                                className="w-12 h-12 rounded-full bg-cover bg-center border-2 border-gray-200"
                                style={{ backgroundImage: `url(${widgetConfig.avatar})` }}
                            />
                        )}
                    </div>
                </div>

                {/* Auto-open Delay */}
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase mb-3 block tracking-wider">
                        {t('demo.controls.autoOpen.label', 'Tự động mở sau')}
                        <span className="ml-2 text-electric-blue">
                            {widgetConfig.autoOpenDelay === 0 ? 'Tắt' : `${widgetConfig.autoOpenDelay}s`}
                        </span>
                    </label>
                    <input
                        type="range"
                        min="0"
                        max="10"
                        value={widgetConfig.autoOpenDelay}
                        onChange={(e) => updateWidgetConfig({ autoOpenDelay: parseInt(e.target.value) })}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-electric-blue"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>Tắt</span>
                        <span>10s</span>
                    </div>
                </div>
            </div>

            {/* CTAs */}
            <div className="mt-6 pt-6 border-t border-gray-100 flex flex-col gap-3">
                <button
                    onClick={handleCopyCode}
                    className={`w-full py-3 font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-md ${copied
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-900 hover:bg-gray-800 text-white'
                        }`}
                >
                    <span className="material-symbols-outlined text-lg">
                        {copied ? 'check' : 'code'}
                    </span>
                    {copied ? t('demo.controls.copied', 'Đã sao chép!') : t('demo.controls.ctaCopy')}
                </button>
                <button className="w-full py-3 bg-transparent border border-gray-300 hover:border-electric-blue hover:bg-electric-blue/5 text-gray-700 hover:text-electric-blue font-bold rounded-xl transition-all flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-lg">rocket_launch</span>
                    {t('demo.controls.ctaTry')}
                </button>
            </div>
        </div>
    );
}
