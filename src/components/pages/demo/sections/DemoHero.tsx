import { useTranslation } from 'react-i18next';
import { useState, useCallback } from 'react';
import { useDemoContext, DEMO_TEMPLATES } from '@/contexts/DemoContext';

export default function DemoHero() {
    const { t } = useTranslation();
    const {
        previewUrl,
        setPreviewUrl,
        startPreview,
        selectTemplate,
        selectedTemplate,
        isLoading,
        isPreviewActive
    } = useDemoContext();

    const [inputValue, setInputValue] = useState(previewUrl);
    const [isValidUrl, setIsValidUrl] = useState(false);

    // Validate URL as user types
    const handleUrlChange = useCallback((value: string) => {
        setInputValue(value);
        setPreviewUrl(value);

        // Simple URL validation
        try {
            if (value) {
                new URL(value.startsWith('http') ? value : `https://${value}`);
                setIsValidUrl(true);
            } else {
                setIsValidUrl(false);
            }
        } catch {
            setIsValidUrl(false);
        }
    }, [setPreviewUrl]);

    // Handle preview button click
    const handlePreview = useCallback(() => {
        let url = inputValue;
        if (url && !url.startsWith('http')) {
            url = `https://${url}`;
            setInputValue(url);
            setPreviewUrl(url);
        }
        startPreview(url);
    }, [inputValue, startPreview, setPreviewUrl]);

    // Handle template click
    const handleTemplateClick = useCallback((templateId: string) => {
        const template = DEMO_TEMPLATES.find(t => t.id === templateId);
        if (template) {
            setInputValue(template.url);
            selectTemplate(templateId);
        }
    }, [selectTemplate]);

    // Handle Enter key
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && isValidUrl) {
            handlePreview();
        }
    }, [handlePreview, isValidUrl]);

    return (
        <section className="max-w-4xl mx-auto text-center mb-16 px-4">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-electric-blue/30 bg-electric-blue/5 text-electric-blue mb-8 shadow-sm">
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-electric-blue opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-electric-blue"></span>
                </span>
                <span className="text-xs font-bold uppercase tracking-wider">
                    {t('demo.hero.badge')}
                </span>
            </div>

            {/* Title */}
            <h1 className="text-4xl lg:text-6xl font-bold leading-[1.1] tracking-tight mb-6 text-gray-900">
                {t('demo.hero.title')} <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-electric-blue via-electric-teal to-electric-blue">
                    {t('demo.hero.titleHighlight')}
                </span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
                {t('demo.hero.subtitle')}
            </p>

            {/* Input + Button */}
            <div className={`bg-white border p-2 rounded-2xl max-w-2xl mx-auto shadow-lg transition-all duration-300 relative group ${isValidUrl ? 'border-green-300 hover:border-green-400' : 'border-gray-200 hover:border-electric-blue/30'
                } hover:shadow-xl`}>
                <div className="flex flex-col sm:flex-row items-center gap-2">
                    <div className="flex-grow flex items-center w-full px-4 h-14 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                        <span className="material-symbols-outlined text-gray-400 mr-3">link</span>
                        <input
                            className="w-full bg-transparent border-none focus:ring-0 text-gray-900 placeholder-gray-400 font-medium outline-none"
                            placeholder={t('demo.hero.inputPlaceholder')}
                            type="url"
                            value={inputValue}
                            onChange={(e) => handleUrlChange(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isLoading}
                        />
                        {isValidUrl && (
                            <span className="material-symbols-outlined text-green-500 transition-opacity animate-pulse">
                                check_circle
                            </span>
                        )}
                    </div>
                    <button
                        onClick={handlePreview}
                        disabled={isLoading || !inputValue}
                        className={`w-full sm:w-auto h-14 px-8 text-white text-base font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 whitespace-nowrap ${isLoading
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-electric-blue hover:bg-electric-blue/90 hover:shadow-lg'
                            }`}
                    >
                        {isLoading ? (
                            <>
                                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                {t('demo.hero.loading', 'Đang tải...')}
                            </>
                        ) : isPreviewActive ? (
                            <>
                                {t('demo.hero.ctaUpdate', 'Cập nhật')}
                                <span className="material-symbols-outlined">refresh</span>
                            </>
                        ) : (
                            <>
                                {t('demo.hero.ctaPreview')}
                                <span className="material-symbols-outlined">play_arrow</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Demo Templates */}
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-gray-500">
                <span>{t('demo.hero.orText')}</span>
                <div className="flex gap-2">
                    {DEMO_TEMPLATES.map((template) => (
                        <button
                            key={template.id}
                            onClick={() => handleTemplateClick(template.id)}
                            disabled={isLoading}
                            className={`px-4 py-1.5 rounded-full border transition-all cursor-pointer font-medium ${selectedTemplate === template.id
                                    ? 'border-electric-blue bg-electric-blue/10 text-electric-blue'
                                    : 'border-gray-200 hover:border-electric-blue/50 hover:bg-electric-blue/10 hover:text-electric-blue text-gray-700'
                                } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {t(template.nameKey, template.name)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Security Notice */}
            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400">
                <span className="material-symbols-outlined text-base">lock</span>
                <p>{t('demo.hero.security')}</p>
            </div>
        </section>
    );
}
