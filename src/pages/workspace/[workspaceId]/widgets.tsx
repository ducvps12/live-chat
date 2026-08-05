import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import {
    Button, Modal, Form, Input, Select, Switch, ColorPicker, Tabs, message,
    Empty, Spin, Tag, Drawer, Divider, Typography, Card, Space, Upload
} from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { Plus, Copy, Code, Settings, Trash2, Eye, Globe, MessageSquare, Upload as UploadIcon, FlaskConical, Monitor, Tablet, Smartphone, Link as LinkIcon, CheckCircle2, AlertTriangle, Rocket, ClipboardCheck, Activity, ShieldCheck, ExternalLink } from 'lucide-react';
import { useGetMe } from '../../../domains/auth/auth.hooks';
import { useWorkspace } from '../../../domains/workspace/workspace.hooks';
import { useTotalUnreadCount } from '../../../domains/conversation';
import {
    useWidgetsByWorkspace, useCreateWidget, useUpdateWidget, useDeleteWidget
} from '../../../domains/workspace/widget.hooks';
import AppLayout from '../../../components/layout/AppLayout';
import { getWidgetLoaderUrl } from '../../../config/widgetLoader';
import { uploadService } from '../../../services/upload.service';

const { Text } = Typography;
const DEFAULT_MARKETING_CONSENT_TEXT = 'Tôi đồng ý nhận thông tin chăm sóc và ưu đãi qua email. Tôi có thể hủy đăng ký bất cứ lúc nào.';

type WidgetListItem = {
    id?: string;
    _id?: string;
    name: string;
    isActive?: boolean;
    config?: {
        primaryColor?: string;
        gradient?: string;
        greeting?: string;
        position?: string;
        language?: string;
        showBranding?: boolean;
        brandingMode?: 'nemark' | 'custom' | 'hidden';
        brandingName?: string;
        brandingUrl?: string;
        themePreset?: 'modern' | 'minimal' | 'glass' | 'compact';
        customCss?: string;
        entitlements?: { whiteLabel?: boolean; customCss?: boolean };
        preChatForm?: {
            enabled?: boolean;
        };
    };
    domainRules?: {
        mode?: string;
        domains?: string[];
    };
};

const getWidgetId = (widget: WidgetListItem) => widget.id || widget._id || '';

/**
 * Builds a live config object from flat form values for the preview.
 */
function buildLiveConfig(values: any) {
    let color = values?.primaryColor;
    if (typeof color === 'object' && color?.toHexString) color = color.toHexString();
    return {
        name: values?.name || '',
        primaryColor: color || '#6366f1',
        gradient: values?.gradient || '',
        launcherStyle: values?.launcherStyle || 'bubble',
        launcherText: values?.launcherText || '',
        launcherIcon: values?.launcherIcon || '',
        tooltipText: values?.tooltipText || '',
        greeting: values?.greeting || 'Xin chào!',
        placeholder: values?.placeholder || 'Nhập tin nhắn...',
        position: values?.position || 'bottom-right',
        language: values?.language || 'vi',
        offlineMessage: values?.offlineMessage || '',
        showBranding: values?.brandingMode ? values.brandingMode !== 'hidden' : (values?.showBranding ?? true),
        brandingMode: values?.brandingMode || 'nemark',
        brandingName: values?.brandingName || '',
        brandingUrl: values?.brandingUrl || '',
        themePreset: values?.themePreset || 'modern',
        customCss: values?.customCss || '',
        headerAvatar: values?.headerAvatar || '',
        preChatForm: {
            enabled: values?.preChatEnabled ?? true,
            title: values?.preChatTitle || 'Nhập thông tin',
            fields: [
                { key: 'name', label: 'Họ và tên', type: 'text', required: values?.fieldNameRequired ?? true, enabled: values?.fieldName ?? true },
                { key: 'email', label: 'Email', type: 'email', required: values?.fieldEmailRequired ?? false, enabled: values?.fieldEmail ?? true },
                { key: 'phone', label: 'Số điện thoại', type: 'tel', required: values?.fieldPhoneRequired ?? false, enabled: values?.fieldPhone ?? true },
                ...((values?.customFields || []).filter((cf: any) => cf?.label && cf?.key).map((cf: any) => ({
                    key: cf.key,
                    label: cf.label,
                    type: cf.type || 'text',
                    required: cf.required || false,
                    enabled: true,
                    options: cf.type === 'select' && typeof cf.options === 'string'
                        ? cf.options.split('\n').filter(Boolean)
                        : cf.options || [],
                }))),
            ],
            marketingConsent: {
                enabled: values?.marketingConsentEnabled ?? false,
                text: values?.marketingConsentText || DEFAULT_MARKETING_CONSENT_TEXT,
            },
        },
    };
}

/** Live preview wrapper that watches form values */
function LivePreview({ form }: { form: any }) {
    const allValues = Form.useWatch([], form);
    const config = buildLiveConfig(allValues);
    return <WidgetPreview config={config} />;
}

const DEVICE_PRESETS = [
    { key: 'desktop', label: 'PC', icon: Monitor, width: 1280, height: 800 },
    { key: 'tablet', label: 'Tablet', icon: Tablet, width: 768, height: 1024 },
    { key: 'mobile', label: 'Mobile', icon: Smartphone, width: 375, height: 812 },
] as const;
type DeviceKey = typeof DEVICE_PRESETS[number]['key'];

function DevicePreviewPanel({ form, widgetId }: { form: any; widgetId: string }) {
    const [device, setDevice] = useState<DeviceKey>('desktop');
    const [customUrl, setCustomUrl] = useState('');
    const [previewUrl, setPreviewUrl] = useState('');
    const [showLinkInput, setShowLinkInput] = useState(false);
    const allValues = Form.useWatch([], form);
    const config = buildLiveConfig(allValues);
    const preset = DEVICE_PRESETS.find(d => d.key === device)!;

    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3010';
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
    const backendBase = apiUrl ? apiUrl.replace(/\/api\/?$/, '') : origin;

    const handlePreviewUrl = () => {
        if (!customUrl.trim()) { setPreviewUrl(''); return; }
        let url = customUrl.trim();
        if (!/^https?:\/\//.test(url)) url = 'https://' + url;
        setPreviewUrl(url);
    };

    /* Scale to fit inside the panel */
    const containerW = device === 'desktop' ? 520 : device === 'tablet' ? 400 : 280;
    const scale = Math.min(containerW / preset.width, 1);
    const scaledH = Math.min(preset.height * scale, 600);

    const widgetScript = `<script>(function(w,d,s,o){w.NemarkChat=o;w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};var js=d.createElement(s);js.async=1;js.src='${getWidgetLoaderUrl(origin)}';js.setAttribute('data-widget-id','${widgetId}');js.setAttribute('data-api-base','${backendBase}');d.head.appendChild(js);})(window,document,'script','nchat');</script>`;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* ── Device Switcher Bar ── */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: '#f8f9fb', borderRadius: 10, padding: '6px 8px',
                border: '1px solid #e8eaed',
            }}>
                <div style={{ display: 'flex', gap: 2 }}>
                    {DEVICE_PRESETS.map(d => {
                        const Icon = d.icon;
                        const active = device === d.key;
                        return (
                            <button
                                key={d.key}
                                onClick={() => setDevice(d.key)}
                                title={`${d.label} (${d.width}×${d.height})`}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 5,
                                    padding: '6px 12px', borderRadius: 8, border: 'none',
                                    cursor: 'pointer', fontSize: 12, fontWeight: active ? 600 : 400,
                                    background: active ? '#fff' : 'transparent',
                                    color: active ? '#1a73e8' : '#5f6368',
                                    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                    transition: 'all 0.15s ease',
                                }}
                            >
                                <Icon size={14} />
                                <span>{d.label}</span>
                            </button>
                        );
                    })}
                </div>
                <button
                    onClick={() => setShowLinkInput(!showLinkInput)}
                    title="Xem trên URL tuỳ chỉnh"
                    style={{
                        display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px',
                        borderRadius: 8, border: '1px solid #dadce0', cursor: 'pointer',
                        fontSize: 11, fontWeight: 500, background: showLinkInput ? '#e8f0fe' : '#fff',
                        color: showLinkInput ? '#1a73e8' : '#5f6368',
                        transition: 'all 0.15s',
                    }}
                >
                    <LinkIcon size={12} />
                    URL
                </button>
            </div>

            {/* ── Custom URL Input ── */}
            {showLinkInput && (
                <div style={{
                    display: 'flex', gap: 6, padding: '8px 10px',
                    background: '#f0f7ff', borderRadius: 8, border: '1px solid #c2dbff',
                }}>
                    <input
                        value={customUrl}
                        onChange={e => setCustomUrl(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handlePreviewUrl()}
                        placeholder="Nhập URL website... (vd: example.com)"
                        style={{
                            flex: 1, height: 32, borderRadius: 6, border: '1px solid #d0d5dd',
                            padding: '0 10px', fontSize: 12, outline: 'none',
                            background: '#fff',
                        }}
                    />
                    <button
                        onClick={handlePreviewUrl}
                        style={{
                            height: 32, padding: '0 14px', borderRadius: 6,
                            background: '#1a73e8', color: '#fff', border: 'none',
                            fontSize: 12, fontWeight: 600, cursor: 'pointer',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        Xem
                    </button>
                    {previewUrl && (
                        <button
                            onClick={() => { setPreviewUrl(''); setCustomUrl(''); }}
                            style={{
                                height: 32, padding: '0 10px', borderRadius: 6,
                                background: '#f1f3f4', border: '1px solid #dadce0',
                                fontSize: 12, cursor: 'pointer', color: '#5f6368',
                            }}
                        >
                            ✕
                        </button>
                    )}
                </div>
            )}

            {/* ── Device Frame ── */}
            <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                background: '#f0f0f5', borderRadius: 12, padding: '16px 12px 12px',
                border: '1px solid #e0e0e5',
            }}>
                {/* Size badge */}
                <div style={{
                    fontSize: 10, color: '#9aa0a6', marginBottom: 8,
                    fontFamily: 'monospace', fontWeight: 500,
                }}>
                    {preset.width} × {preset.height}
                </div>

                {previewUrl ? (
                    /* ── Custom URL iframe preview ── */
                    <div style={{
                        width: preset.width * scale,
                        height: scaledH,
                        borderRadius: device === 'mobile' ? 24 : device === 'tablet' ? 16 : 8,
                        overflow: 'hidden',
                        boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
                        border: device === 'mobile' ? '3px solid #222' : device === 'tablet' ? '3px solid #333' : '1px solid #ccc',
                        background: '#fff',
                        position: 'relative',
                    }}>
                        {/* Browser chrome bar */}
                        <div style={{
                            height: 28, background: '#f5f5f5', borderBottom: '1px solid #e0e0e0',
                            display: 'flex', alignItems: 'center', padding: '0 10px', gap: 6,
                        }}>
                            <div style={{ display: 'flex', gap: 4 }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5f57' }} />
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ffbd2e' }} />
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#28c840' }} />
                            </div>
                            <div style={{
                                flex: 1, height: 18, background: '#fff', borderRadius: 4,
                                fontSize: 9, color: '#999', display: 'flex', alignItems: 'center',
                                padding: '0 8px', overflow: 'hidden', whiteSpace: 'nowrap',
                                border: '1px solid #e8e8e8',
                            }}>
                                🔒 {previewUrl.replace(/^https?:\/\//, '')}
                            </div>
                        </div>
                        <div style={{
                            width: preset.width, height: preset.height - 28,
                            transform: `scale(${scale})`, transformOrigin: 'top left',
                        }}>
                            <iframe
                                src={previewUrl}
                                style={{ width: '100%', height: '100%', border: 'none' }}
                                title={`Preview ${device}`}
                                sandbox="allow-scripts allow-same-origin allow-forms"
                            />
                        </div>
                        {/* Widget overlay hint */}
                        <div style={{
                            position: 'absolute', bottom: 8, right: 8, zIndex: 10,
                            background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 9,
                            padding: '4px 8px', borderRadius: 6, fontWeight: 500,
                        }}>
                            Widget sẽ hiển thị ở đây →
                        </div>
                    </div>
                ) : (
                    /* ── Default widget preview (no custom URL) ── */
                    <div style={{
                        width: preset.width * scale,
                        minHeight: device === 'mobile' ? 480 : device === 'tablet' ? 420 : 'auto',
                        borderRadius: device === 'mobile' ? 24 : device === 'tablet' ? 16 : 8,
                        overflow: 'hidden',
                        boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
                        border: device === 'mobile' ? '3px solid #222' : device === 'tablet' ? '3px solid #333' : '1px solid #ccc',
                        background: '#fff',
                        position: 'relative',
                        display: 'flex', flexDirection: 'column',
                    }}>
                        {/* Simulated page content */}
                        <div style={{
                            flex: 1, padding: device === 'mobile' ? 12 : 20,
                            background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
                            position: 'relative',
                            minHeight: device === 'mobile' ? 380 : device === 'tablet' ? 420 : 460,
                        }}>
                            {/* Fake browser bar */}
                            <div style={{
                                height: 24, background: '#e8eaed', borderRadius: 6,
                                display: 'flex', alignItems: 'center', padding: '0 8px', gap: 4,
                                marginBottom: 12,
                            }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff5f57' }} />
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ffbd2e' }} />
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#28c840' }} />
                                <div style={{ flex: 1, height: 14, background: '#fff', borderRadius: 3, marginLeft: 6 }} />
                            </div>
                            {/* Fake content placeholders */}
                            <div style={{ height: 14, width: '60%', background: '#dde1e6', borderRadius: 4, marginBottom: 8 }} />
                            <div style={{ height: 10, width: '80%', background: '#e8eaed', borderRadius: 3, marginBottom: 6 }} />
                            <div style={{ height: 10, width: '70%', background: '#e8eaed', borderRadius: 3, marginBottom: 16 }} />
                            <div style={{ height: 80, background: '#e8eaed', borderRadius: 8, marginBottom: 12 }} />
                            <div style={{ height: 10, width: '55%', background: '#e8eaed', borderRadius: 3, marginBottom: 6 }} />
                            <div style={{ height: 10, width: '45%', background: '#e8eaed', borderRadius: 3 }} />

                            {/* Widget positioned at bottom-right */}
                            <div style={{
                                position: 'absolute',
                                bottom: device === 'mobile' ? 12 : 16,
                                right: device === 'mobile' ? 12 : 16,
                                transform: device === 'mobile' ? 'scale(0.85)' : device === 'tablet' ? 'scale(0.9)' : 'scale(1)',
                                transformOrigin: 'bottom right',
                            }}>
                                <WidgetPreview config={config} compact={device === 'mobile'} device={device} />
                            </div>
                        </div>
                    </div>
                )}

                {/* Device label */}
                <div style={{
                    marginTop: 8, fontSize: 11, color: '#9aa0a6', fontWeight: 500,
                    display: 'flex', alignItems: 'center', gap: 4,
                }}>
                    {(() => { const Icon = preset.icon; return <Icon size={12} />; })()}
                    {preset.label} Preview
                </div>
            </div>

            {/* ── Standalone Widget Preview (always visible) ── */}
            <div style={{ borderTop: '1px solid #e8eaed', paddingTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#5f6368', marginBottom: 8 }}>
                    Widget Component
                </div>
                <WidgetPreview config={config} />
            </div>
        </div>
    );
}

function WidgetPreview({
    config,
    compact,
    device = 'desktop',
}: {
    config: any;
    compact?: boolean;
    device?: DeviceKey;
}) {
    const accent = config?.primaryColor || '#6366f1';
    const bgStyle = config?.gradient
        ? { background: config.gradient }
        : { background: accent };
    const launcherStyle = config?.launcherStyle || 'bubble';
    const resolvedDevice = compact ? 'mobile' : device;
    const isMobile = resolvedDevice === 'mobile';
    const isTablet = resolvedDevice === 'tablet';
    const windowWidth = isMobile ? 260 : isTablet ? 300 : 320;
    const windowHeight = isMobile ? 402 : isTablet ? 420 : 430;
    const brandName = String(config?.name || (config?.language === 'en' ? 'Live support' : 'NemarkChat Hỗ trợ'));
    const brandInitial = Array.from(brandName.trim())[0]?.toUpperCase() || 'N';
    const isEnglish = config?.language === 'en';
    const headerAvatar = config?.headerAvatar || '';
    const conversations = [
        {
            time: isEnglish ? '23:07' : '23:07',
            message: isEnglish
                ? 'Hello! How can our support team help you today?'
                : 'Chào bạn! Đội ngũ hỗ trợ có thể giúp gì cho bạn?',
        },
        {
            time: isEnglish ? '16 Jul' : '16-07',
            message: isEnglish
                ? 'Your previous support request is still available.'
                : 'Yêu cầu hỗ trợ trước của bạn vẫn đang được lưu.',
        },
    ];

    const renderLauncherIcon = () => {
        if (config?.launcherIcon) {
            if (config.launcherStyle !== 'image' && config.launcherIcon.includes('.svg')) {
                return (
                    <div style={{
                        width: 28, height: 28, backgroundColor: 'currentColor',
                        WebkitMaskImage: `url(${config.launcherIcon})`, WebkitMaskSize: 'contain',
                        WebkitMaskPosition: 'center', WebkitMaskRepeat: 'no-repeat',
                        maskImage: `url(${config.launcherIcon})`, maskSize: 'contain',
                        maskPosition: 'center', maskRepeat: 'no-repeat'
                    }} />
                );
            }
            return (
                <img
                    src={config.launcherIcon}
                    alt=""
                    style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
                />
            );
        }
        return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
        );
    };

    const renderBubble = () => {
        if (launcherStyle === 'tab') {
            return (
                <div style={{
                    ...bgStyle,
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 20px', borderRadius: '20px 20px 0 0',
                    color: 'white', fontWeight: 600, fontSize: 14,
                    boxShadow: '0 -4px 12px rgba(0,0,0,0.15)',
                    width: 'fit-content'
                }}>
                    {renderLauncherIcon()}
                    <span>{config?.launcherText || 'Chat'}</span>
                </div>
            );
        }
        if (launcherStyle === 'pill') {
            return (
                <div style={{
                    ...bgStyle,
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '12px 24px', borderRadius: 50,
                    color: 'white', fontWeight: 600, fontSize: 14,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
                    width: 'fit-content'
                }}>
                    {renderLauncherIcon()}
                    <span>{config?.launcherText || (isEnglish ? 'Support' : 'Hỗ trợ')}</span>
                </div>
            );
        }
        if (launcherStyle === 'image') {
            return (
                <div style={{
                    width: 60, height: 60, borderRadius: '50%', overflow: 'hidden',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                    ...bgStyle,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    {config?.launcherIcon ? (
                        <img
                            src={config.launcherIcon}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    ) : renderLauncherIcon()}
                </div>
            );
        }
        return (
            <div style={{
                width: 56, height: 56, borderRadius: '50%',
                ...bgStyle,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            }}>
                {renderLauncherIcon()}
            </div>
        );
    };

    return (
        <div style={{ width: '100%', maxWidth: windowWidth }}>
            <div
                aria-label={isEnglish ? 'Chat widget preview' : 'Bản xem trước widget chat'}
                style={{
                    width: '100%',
                    height: windowHeight,
                    borderRadius: isMobile ? 14 : 18,
                    overflow: 'hidden',
                    boxShadow: '0 18px 48px rgba(15,23,42,0.16), 0 4px 14px rgba(15,23,42,0.08)',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    border: '1px solid rgba(15,23,42,0.10)',
                    background: '#fff',
                    display: 'flex',
                    flexDirection: 'column',
                    color: '#172033',
                }}
            >
                <div style={{
                    ...bgStyle,
                    padding: isMobile ? '14px 48px 14px 14px' : '16px 50px 15px 16px',
                    color: '#fff',
                    position: 'relative',
                    flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                        <div style={{
                            width: 40,
                            height: 40,
                            borderRadius: 12,
                            background: 'rgba(255,255,255,0.96)',
                            display: 'grid',
                            placeItems: 'center',
                            color: accent,
                            overflow: 'hidden',
                            flexShrink: 0,
                            boxShadow: '0 4px 14px rgba(15,23,42,0.13)',
                        }}>
                            {headerAvatar ? (
                                <img src={headerAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <svg width="23" height="23" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                    <path d="M20 2H4a2 2 0 00-2 2v18l4-4h14a2 2 0 002-2V4a2 2 0 00-2-2zm0 14H5.2L4 17.2V4h16v12z" />
                                </svg>
                            )}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{
                                fontWeight: 720,
                                fontSize: 14,
                                lineHeight: 1.25,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                            }}>
                                {brandName}
                            </div>
                            <div style={{
                                marginTop: 2,
                                fontSize: 11,
                                lineHeight: 1.35,
                                color: 'rgba(255,255,255,0.82)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                            }}>
                                {isEnglish ? 'Usually replies in a few minutes' : 'Thường phản hồi trong vài phút'}
                            </div>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 5, fontSize: 10, fontWeight: 650 }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#5ee89a', boxShadow: '0 0 0 2px rgba(94,232,154,0.18)' }} />
                                {isEnglish ? 'Online' : 'Trực tuyến'}
                            </div>
                        </div>
                    </div>
                    <div style={{
                        position: 'absolute',
                        top: 15,
                        right: 15,
                        width: 30,
                        height: 30,
                        borderRadius: 9,
                        border: '1px solid rgba(255,255,255,0.22)',
                        background: 'rgba(255,255,255,0.14)',
                        display: 'grid',
                        placeItems: 'center',
                    }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                        </svg>
                    </div>
                </div>

                <div style={{
                    flex: 1,
                    minHeight: 0,
                    overflow: 'hidden',
                    padding: '18px 14px 14px',
                    background: '#f6f8fb',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                }}>
                    <div style={{ padding: '0 2px 4px' }}>
                        <div style={{
                            fontSize: 14,
                            lineHeight: '18px',
                            fontWeight: 720,
                            color: '#172033',
                            letterSpacing: '-0.1px',
                            marginBottom: 5,
                        }}>
                            {isEnglish ? 'Your conversations' : 'Các cuộc trò chuyện của bạn'}
                        </div>
                        <div style={{ fontSize: 12, lineHeight: '17px', color: '#7a8699' }}>
                            {isEnglish
                                ? 'Continue a previous chat or start a new support request.'
                                : 'Tiếp tục hội thoại cũ hoặc bắt đầu một yêu cầu hỗ trợ mới.'}
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {conversations.map((conversation) => (
                            <div
                                key={conversation.time}
                                style={{
                                    minHeight: 66,
                                    padding: 12,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 11,
                                    borderRadius: 15,
                                    background: '#fff',
                                    border: '1px solid #e1e6ee',
                                    boxShadow: '0 3px 10px rgba(15,23,42,0.045)',
                                }}
                            >
                                <div style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 12,
                                    background: '#eef2ff',
                                    color: accent,
                                    display: 'grid',
                                    placeItems: 'center',
                                    fontWeight: 750,
                                    fontSize: 13,
                                    flexShrink: 0,
                                }}>
                                    {brandInitial}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        fontSize: isMobile ? 12 : 13,
                                        lineHeight: 1.3,
                                        fontWeight: 700,
                                        color: '#172033',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}>
                                        {brandName}
                                    </div>
                                    <div style={{
                                        marginTop: 5,
                                        fontSize: isMobile ? 10 : 11,
                                        lineHeight: 1.35,
                                        color: '#7a8699',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}>
                                        {conversation.message}
                                    </div>
                                </div>
                                <div style={{ alignSelf: 'stretch', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', flexShrink: 0 }}>
                                    <div style={{ fontSize: 9.5, lineHeight: 1.2, color: '#94a3b8', fontWeight: 650 }}>
                                        {conversation.time}
                                    </div>
                                    <div style={{
                                        fontSize: 8.5,
                                        lineHeight: 1.2,
                                        color: '#087a55',
                                        background: '#eaf8f2',
                                        borderRadius: 999,
                                        padding: '3px 6px',
                                        fontWeight: 700,
                                    }}>
                                        {isEnglish ? 'Open' : 'Đang mở'}
                                    </div>
                                </div>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="#cbd5e1" aria-hidden="true" style={{ flexShrink: 0, marginLeft: 1 }}>
                                    <path d="M9.29 15.88L13.17 12 9.29 8.12a1 1 0 011.41-1.41l4.59 4.59a1 1 0 010 1.41l-4.59 4.59a1 1 0 01-1.41-1.41z" />
                                </svg>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ padding: '11px 14px 9px', background: '#fff', borderTop: '1px solid #e8ebf0', flexShrink: 0 }}>
                    <div style={{
                        minHeight: 42,
                        borderRadius: 11,
                        ...bgStyle,
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        fontSize: isMobile ? 11 : 12,
                        lineHeight: 1.2,
                        fontWeight: 700,
                        boxShadow: `0 5px 14px ${accent}28`,
                    }}>
                        {isEnglish ? 'Start a new request' : 'Tạo yêu cầu hỗ trợ mới'}
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                        </svg>
                    </div>
                    <div style={{ textAlign: 'center', color: '#8b96a8', fontSize: 9, lineHeight: 1.35, marginTop: 6 }}>
                        {isEnglish ? 'Your messages are private' : 'Tin nhắn của bạn được bảo mật'}
                    </div>
                </div>
                {config?.showBranding !== false && (
                    <div style={{
                        height: 22,
                        borderTop: '1px solid #f0f2f5',
                        background: '#fff',
                        color: '#7a8699',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        fontSize: 9,
                        flexShrink: 0,
                    }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M20 2H4a2 2 0 00-2 2v18l4-4h14a2 2 0 002-2V4a2 2 0 00-2-2z" />
                        </svg>
                        {config?.brandingName || 'NemarkChat'}
                    </div>
                )}
            </div>

            <div style={{
                marginTop: 16,
                padding: 16,
                background: '#f0f0f5',
                borderRadius: 12,
                border: '1px solid var(--color-border)'
            }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 12 }}>
                    {isEnglish ? 'Launcher button' : 'Nút bấm (Launcher)'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
                    {renderBubble()}
                    {config?.tooltipText && (
                        <div style={{
                            background: '#333',
                            color: '#fff',
                            padding: '6px 12px',
                            borderRadius: 8,
                            fontSize: 12,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                        }}>
                            {config.tooltipText}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function EmbedSnippet({ widgetId }: { widgetId: string }) {
    const snippet = `<!-- NemarkChat Widget -->
<script>
  (function(w,d,s,o){
    w.NemarkChat=o;w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
    var js=d.createElement(s);js.async=1;
    js.src='${getWidgetLoaderUrl(typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com')}';
    js.setAttribute('data-widget-id','${widgetId}');
    d.head.appendChild(js);
  })(window,document,'script','nchat');
</script>`;

    const handleCopy = () => {
        navigator.clipboard.writeText(snippet);
        message.success('Đã copy snippet!');
    };

    return (
        <div>
            <div style={{
                background: '#1e1e2e', borderRadius: 12, padding: 16,
                fontFamily: 'monospace', fontSize: 12, color: '#a6e3a1',
                whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                position: 'relative', lineHeight: 1.6
            }}>
                {snippet}
                <Button
                    type="text" size="small"
                    icon={<Copy size={14} />}
                    onClick={handleCopy}
                    style={{
                        position: 'absolute', top: 8, right: 8,
                        color: '#cdd6f4', background: 'rgba(255,255,255,0.1)',
                        borderRadius: 6
                    }}
                />
            </div>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8 }}>
                Dán đoạn mã trên vào trước thẻ <code>&lt;/head&gt;</code> của website bạn.
            </p>
        </div>
    );
}

export default function WorkspaceDetailPage() {
    const router = useRouter();
    const { workspaceId } = router.query;
    const wsId = workspaceId as string;

    const [ready, setReady] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [editingWidget, setEditingWidget] = useState<any>(null);
    const [configDrawer, setConfigDrawer] = useState(false);
    const [configSection, setConfigSection] = useState('general');
    const [configPreviewOpen, setConfigPreviewOpen] = useState(true);
    const [snippetModal, setSnippetModal] = useState<string | null>(null);
    const [testModal, setTestModal] = useState<string | null>(null);
    const [createForm] = Form.useForm();
    const [configForm] = Form.useForm();

    useEffect(() => {
        const t = localStorage.getItem('nemark_token');
        setReady(true);
        if (!t) router.replace('/auth/login');
    }, [router]);

    const { data: meData, isLoading: meLoading } = useGetMe(ready);
    const { data: wsRes } = useWorkspace(wsId, ready && !!wsId);
    const { data: totalUnreadCount = 0 } = useTotalUnreadCount(wsId, ready && !!wsId && !!meData);
    const { data: widgetsRes, isLoading: wLoading } = useWidgetsByWorkspace(wsId);
    const { mutateAsync: createWidget, isPending: creating } = useCreateWidget(wsId);
    const { mutateAsync: updateWidget, isPending: updating } = useUpdateWidget(wsId);
    const { mutateAsync: deleteWidget } = useDeleteWidget(wsId);

    const workspace = wsRes?.data;
    const paidWidgetCustomization = ['starter', 'pro', 'enterprise'].includes(String(workspace?.plan || '').toLowerCase());
    const widgets = (widgetsRes?.data || []) as WidgetListItem[];
    const unreadTotal = typeof totalUnreadCount === 'number' ? totalUnreadCount : (totalUnreadCount?.totalUnread || 0);
    const activeWidgets = widgets.filter((w) => w.isActive !== false).length;
    const protectedWidgets = widgets.filter((w) => (w.domainRules?.domains || []).length > 0).length;
    const preChatWidgets = widgets.filter((w) => w.config?.preChatForm?.enabled).length;

    const getWidgetReadiness = (widget: WidgetListItem) => {
        const widgetId = getWidgetId(widget);
        const checks = [
            { label: 'Có lời chào', ok: Boolean(widget.config?.greeting) },
            { label: 'Có màu và vị trí', ok: Boolean(widget.config?.primaryColor && widget.config?.position) },
            { label: 'Domain bảo vệ', ok: (widget.domainRules?.domains || []).length > 0 || widget.domainRules?.mode === 'allow_all' },
            { label: 'Form trước chat', ok: widget.config?.preChatForm?.enabled !== false },
            { label: 'Sẵn mã nhúng', ok: Boolean(widgetId) },
        ];
        const done = checks.filter((item) => item.ok).length;
        return { checks, done, percent: Math.round((done / checks.length) * 100) };
    };

    const copyWidgetSnippet = async (widgetId: string) => {
        const origin = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com';
        const snippet = `<!-- NemarkChat Widget -->
<script>
  (function(w,d,s,o){
    w.NemarkChat=o;w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
    var js=d.createElement(s);js.async=1;
    js.src='${getWidgetLoaderUrl(origin)}';
    js.setAttribute('data-widget-id','${widgetId}');
    d.head.appendChild(js);
  })(window,document,'script','nchat');
</script>`;
        await navigator.clipboard.writeText(snippet);
        message.success('Đã copy mã nhúng widget');
    };

    const handleCreate = async (values: any) => {
        try {
            const res = await createWidget({ name: values.name });
            if (res.success) {
                message.success('Tạo widget thành công!');
                setShowCreate(false);
                createForm.resetFields();
            }
        } catch (err: any) {
            message.error(err.response?.data?.error?.message || 'Có lỗi xảy ra');
        }
    };

    const openConfig = (widget: any) => {
        setEditingWidget(widget);
        setConfigSection('general');
        setConfigPreviewOpen(typeof window === 'undefined' || window.innerWidth >= 1280);
        const color = widget.config?.primaryColor || '#6366f1';
        configForm.setFieldsValue({
            name: widget.name,
            primaryColor: color,
            gradient: widget.config?.gradient || '',
            launcherStyle: widget.config?.launcherStyle || 'bubble',
            launcherText: widget.config?.launcherText || '',
            launcherIcon: widget.config?.launcherIcon || '',
            tooltipText: widget.config?.tooltipText || '',
            greeting: widget.config?.greeting,
            placeholder: widget.config?.placeholder,
            position: widget.config?.position || 'bottom-right',
            language: widget.config?.language || 'vi',
            offlineMessage: widget.config?.offlineMessage,
            autoReply: widget.config?.autoReply || '',
            brandingMode: paidWidgetCustomization
                ? (widget.config?.brandingMode || (widget.config?.brandingName ? 'custom' : 'hidden'))
                : 'nemark',
            showBranding: paidWidgetCustomization ? (widget.config?.showBranding ?? false) : true,
            brandingName: widget.config?.brandingName || '',
            brandingUrl: widget.config?.brandingUrl || '',
            themePreset: widget.config?.themePreset || 'modern',
            customCss: widget.config?.customCss || '',
            preChatEnabled: widget.config?.preChatForm?.enabled ?? true,
            preChatTitle: widget.config?.preChatForm?.title || '',
            marketingConsentEnabled: widget.config?.preChatForm?.marketingConsent?.enabled
                ?? widget.config?.preChatForm?.fields?.some((f: any) => f.key === 'marketingConsent' && f.enabled)
                ?? false,
            marketingConsentText: widget.config?.preChatForm?.marketingConsent?.text
                || widget.config?.preChatForm?.fields?.find((f: any) => f.key === 'marketingConsent')?.label
                || DEFAULT_MARKETING_CONSENT_TEXT,
            fieldName: widget.config?.preChatForm?.fields?.find((f: any) => f.key === 'name')?.enabled ?? true,
            fieldNameRequired: widget.config?.preChatForm?.fields?.find((f: any) => f.key === 'name')?.required ?? true,
            fieldEmail: widget.config?.preChatForm?.fields?.find((f: any) => f.key === 'email')?.enabled ?? true,
            fieldEmailRequired: widget.config?.preChatForm?.fields?.find((f: any) => f.key === 'email')?.required ?? false,
            fieldPhone: widget.config?.preChatForm?.fields?.find((f: any) => f.key === 'phone')?.enabled ?? true,
            fieldPhoneRequired: widget.config?.preChatForm?.fields?.find((f: any) => f.key === 'phone')?.required ?? false,
            // Load custom fields (non-builtin)
            customFields: (widget.config?.preChatForm?.fields || [])
                .filter((f: any) => !['name', 'email', 'phone', 'marketingConsent'].includes(f.key))
                .map((f: any) => ({
                    key: f.key,
                    label: f.label,
                    type: f.type || 'text',
                    required: f.required || false,
                    options: f.type === 'select' ? (f.options || []).join('\n') : undefined,
                })),
            domainMode: widget.domainRules?.mode || 'allowlist',
            domains: widget.domainRules?.domains?.length ? widget.domainRules.domains.map((d: string) => ({ value: d })) : [],
            // Subiz-inspired fields
            headerAvatar: widget.config?.headerAvatar || '',
            profileDisplay: widget.config?.profileDisplay || 'company',
            showTypingIndicator: widget.config?.showTypingIndicator ?? true,
            requestRating: widget.config?.requestRating ?? false,
            autoOpenMode: widget.config?.autoOpen?.mode || 'none',
            autoOpenCustom: widget.config?.autoOpen?.customSeconds || 0,
            greetingPopupEnabled: widget.config?.greetingPopup?.enabled ?? true,
            greetingPopupMessage: widget.config?.greetingPopup?.message || '',
            greetingPopupCta: widget.config?.greetingPopup?.ctaText || 'Gửi tin nhắn',
            greetingPopupDelay: widget.config?.greetingPopup?.delay || 3,
            urlDomainRules: widget.config?.urlRules?.domains || [],
            urlPathRules: widget.config?.urlRules?.paths || [],
        });
        setConfigDrawer(true);
    };

    const handleSaveConfig = async (values: any) => {
        try {
            let colorVal = values.primaryColor;
            if (typeof colorVal === 'object' && colorVal?.toHexString) colorVal = colorVal.toHexString();

            const domainList = (values.domains || []).map((d: any) => d.value).filter(Boolean);
            // Handle gradient: if user selected __custom__ but didn't pick colors, apply default gradient
            let gradientVal = values.gradient || '';
            if (gradientVal === '__custom__') {
                gradientVal = 'linear-gradient(135deg, #6366f1, #a855f7)';
            }
            const payload = {
                widgetId: editingWidget.id || editingWidget._id,
                name: values.name,
                config: {
                    primaryColor: colorVal,
                    gradient: gradientVal,
                    launcherStyle: values.launcherStyle,
                    launcherText: values.launcherText,
                    launcherIcon: values.launcherIcon,
                    tooltipText: values.tooltipText,
                    greeting: values.greeting,
                    placeholder: values.placeholder,
                    position: values.position,
                    language: values.language,
                    offlineMessage: values.offlineMessage,
                    autoReply: values.autoReply,
                    showBranding: values.showBranding,
                    brandingMode: values.brandingMode || (paidWidgetCustomization ? 'hidden' : 'nemark'),
                    brandingName: values.brandingName || '',
                    brandingUrl: values.brandingUrl || '',
                    themePreset: values.themePreset || 'modern',
                    customCss: values.customCss || '',
                    preChatForm: {
                        enabled: values.preChatEnabled,
                        title: values.preChatTitle,
                        fields: [
                            { key: 'name', label: 'Họ và tên', type: 'text', required: values.fieldNameRequired, enabled: values.fieldName },
                            { key: 'email', label: 'Email', type: 'email', required: values.fieldEmailRequired, enabled: values.fieldEmail },
                            { key: 'phone', label: 'Số điện thoại', type: 'tel', required: values.fieldPhoneRequired, enabled: values.fieldPhone },
                            // Merge custom fields
                            ...((values.customFields || []).filter((cf: any) => cf?.label && cf?.key).map((cf: any) => ({
                                key: cf.key,
                                label: cf.label,
                                type: cf.type || 'text',
                                required: cf.required || false,
                                enabled: true,
                                options: cf.type === 'select' && typeof cf.options === 'string'
                                    ? cf.options.split('\n').filter(Boolean)
                                    : cf.options || [],
                            }))),
                        ],
                        marketingConsent: {
                            enabled: values.marketingConsentEnabled ?? false,
                            text: values.marketingConsentText || DEFAULT_MARKETING_CONSENT_TEXT,
                        },
                    },
                    // Subiz-inspired features
                    headerAvatar: values.headerAvatar || '',
                    profileDisplay: values.profileDisplay || 'company',
                    showTypingIndicator: values.showTypingIndicator ?? true,
                    requestRating: values.requestRating ?? false,
                    autoOpen: {
                        mode: values.autoOpenMode || 'none',
                        customSeconds: values.autoOpenCustom || 0,
                    },
                    greetingPopup: {
                        enabled: values.greetingPopupEnabled ?? true,
                        message: values.greetingPopupMessage || '',
                        ctaText: values.greetingPopupCta || 'Gửi tin nhắn',
                        delay: values.greetingPopupDelay || 3,
                    },
                    urlRules: {
                        domains: (values.urlDomainRules || []).filter((r: any) => r?.value),
                        paths: (values.urlPathRules || []).filter((r: any) => r?.value),
                    },
                },
                domainRules: {
                    mode: values.domainMode || 'allowlist',
                    domains: domainList,
                },
            };
            const res = await updateWidget(payload);
            if (res.success) {
                message.success('Đã lưu cấu hình!');
                setConfigDrawer(false);
                setEditingWidget(null);
            }
        } catch (err: any) {
            message.error(err.response?.data?.error?.message || 'Có lỗi xảy ra');
        }
    };

    const handleDelete = async (widgetId: string) => {
        Modal.confirm({
            title: 'Xoá widget này?',
            content: 'Widget sẽ bị vô hiệu hoá và không thể khôi phục.',
            okText: 'Xoá',
            cancelText: 'Huỷ',
            okButtonProps: { danger: true },
            onOk: async () => {
                await deleteWidget(widgetId);
                message.success('Đã xoá widget');
            },
        });
    };

    if (!ready || meLoading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-soft)' }}>
                <Spin size="large" />
            </div>
        );
    }

    return (
        <AppLayout headerTitle="Chat Widgets">
            <Head><title>{workspace?.name || 'Workspace'} | NemarkChat</title></Head>

            <style>{`
                .widgets-page {
                    max-width: 1180px;
                    margin: 0 auto;
                    padding: 32px 24px 60px;
                }
                .widgets-hero {
                    background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 52%, #0f766e 100%);
                    border-radius: 24px;
                    padding: 28px;
                    color: #fff;
                    position: relative;
                    overflow: hidden;
                    margin-bottom: 18px;
                    box-shadow: 0 20px 50px rgba(15, 23, 42, 0.18);
                }
                .widgets-hero::after {
                    content: '';
                    position: absolute;
                    right: -70px;
                    top: -70px;
                    width: 260px;
                    height: 260px;
                    border-radius: 50%;
                    background: rgba(255,255,255,0.08);
                }
                .widgets-hero-content {
                    position: relative;
                    z-index: 1;
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: 22px;
                    flex-wrap: wrap;
                }
                .widgets-hero-kicker {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 6px 10px;
                    border-radius: 999px;
                    background: rgba(255,255,255,0.14);
                    border: 1px solid rgba(255,255,255,0.18);
                    font-size: 12px;
                    font-weight: 800;
                    margin-bottom: 12px;
                }
                .widgets-hero h1 {
                    margin: 0;
                    font-size: 30px;
                    line-height: 1.12;
                    font-weight: 900;
                    letter-spacing: 0;
                }
                .widgets-hero p {
                    margin: 10px 0 0;
                    color: rgba(255,255,255,0.78);
                    max-width: 620px;
                    line-height: 1.6;
                    font-size: 14px;
                }
                .widgets-stat-grid {
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 12px;
                    margin-bottom: 26px;
                }
                .widgets-stat-card {
                    background: #fff;
                    border: 1px solid #e2e8f0;
                    border-radius: 18px;
                    padding: 16px;
                    box-shadow: 0 12px 30px rgba(15, 23, 42, 0.045);
                    min-height: 118px;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                }
                .widgets-stat-top {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 10px;
                }
                .widgets-stat-label {
                    color: #64748b;
                    font-size: 11px;
                    font-weight: 850;
                    text-transform: uppercase;
                    letter-spacing: 0;
                }
                .widgets-stat-icon {
                    width: 34px;
                    height: 34px;
                    border-radius: 12px;
                    display: grid;
                    place-items: center;
                    background: #eef2ff;
                    color: #4f46e5;
                }
                .widgets-stat-value {
                    color: #0f172a;
                    font-size: 25px;
                    line-height: 1;
                    font-weight: 900;
                    margin-top: 12px;
                }
                .widgets-stat-hint {
                    color: #64748b;
                    font-size: 12px;
                    margin-top: 4px;
                }
                .widget-section-head {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 16px;
                    margin: 30px 0 16px;
                }
                .widget-section-title {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    color: #0f172a;
                    font-size: 18px;
                    font-weight: 900;
                }
                .widget-section-icon {
                    width: 36px;
                    height: 36px;
                    border-radius: 12px;
                    display: grid;
                    place-items: center;
                    background: #ecfdf5;
                    color: #059669;
                }
                .widget-flow {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 14px;
                    margin-bottom: 28px;
                }
                .widget-flow-card {
                    background: #fff;
                    border: 1px solid #e2e8f0;
                    border-radius: 18px;
                    padding: 18px;
                    box-shadow: 0 10px 26px rgba(15, 23, 42, 0.04);
                }
                .widget-flow-card strong {
                    display: block;
                    color: #0f172a;
                    font-size: 14px;
                    margin: 10px 0 5px;
                }
                .widget-flow-card span {
                    color: #64748b;
                    font-size: 12px;
                    line-height: 1.55;
                }
                .widget-card-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
                    gap: 18px;
                }
                .widget-card {
                    background: #fff;
                    border: 1px solid #e2e8f0;
                    border-radius: 20px;
                    padding: 18px;
                    box-shadow: 0 14px 34px rgba(15, 23, 42, 0.05);
                    transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
                }
                .widget-card:hover {
                    transform: translateY(-2px);
                    border-color: #c7d2fe;
                    box-shadow: 0 18px 42px rgba(99, 102, 241, 0.11);
                }
                .widget-readiness-bar {
                    height: 7px;
                    border-radius: 999px;
                    background: #e2e8f0;
                    overflow: hidden;
                    margin: 12px 0 10px;
                }
                .widget-readiness-fill {
                    height: 100%;
                    border-radius: 999px;
                    background: linear-gradient(135deg, #22c55e 0%, #2563eb 100%);
                }
                .widget-mini-checks {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 7px;
                    margin-top: 12px;
                }
                .widget-mini-check {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    min-width: 0;
                    color: #475569;
                    font-size: 11px;
                    font-weight: 700;
                    padding: 7px 8px;
                    border-radius: 10px;
                    background: #f8fafc;
                    border: 1px solid #edf2f7;
                }
                .widget-actions {
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 7px;
                    margin-top: 16px;
                    padding-top: 14px;
                    border-top: 1px solid #edf2f7;
                }
                .widget-test-modal-root .ant-modal {
                    max-width: calc(100vw - 24px);
                    padding-bottom: 0;
                }
                .widget-test-modal-root .ant-modal-content {
                    overflow: hidden;
                    border-radius: 10px;
                }
                .widget-test-modal-root .ant-modal-footer {
                    margin-top: 0;
                }
                @media (max-width: 860px) {
                    .widgets-page { padding: 20px 14px 40px; }
                    .widgets-stat-grid, .widget-flow { grid-template-columns: 1fr; }
                    .widget-card-grid { grid-template-columns: 1fr; }
                    .widgets-hero h1 { font-size: 24px; }
                }
                @media (max-width: 600px) {
                    .widget-test-modal-root .ant-modal {
                        top: 8px;
                        width: calc(100vw - 12px) !important;
                        max-width: none;
                        margin: 0 auto;
                    }
                    .widget-test-modal-root .ant-modal-header { margin-bottom: 10px; }
                    .widget-test-modal-root .ant-modal-title { font-size: 14px; }
                    .widget-test-modal-root .ant-modal-body {
                        height: calc(100dvh - 178px) !important;
                        min-height: 360px;
                    }
                    .widget-test-modal-root .ant-modal-footer { padding: 8px 0 0 !important; }
                    .widget-test-modal-root .ant-modal-footer > div > span { display: none; }
                    .widget-test-modal-root .ant-modal-footer .ant-space {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        width: 100%;
                    }
                    .widget-test-modal-root .ant-modal-footer .ant-space-item,
                    .widget-test-modal-root .ant-modal-footer .ant-btn { width: 100%; }
                    .widget-test-modal-root .ant-modal-footer .ant-space-item:last-child { grid-column: 1 / -1; }
                }
            `}</style>

            {/* Content */}
            <main className="widgets-page">
                <div className="widgets-hero">
                    <div className="widgets-hero-content">
                        <div>
                            <div className="widgets-hero-kicker">
                                <Activity size={14} /> Web chat deployment
                            </div>
                            <h1>Quản lý widget chat cho website</h1>
                            <p>
                                Tạo widget, cấu hình giao diện, giới hạn domain, test local và lấy mã nhúng để đưa Web chat vào website thật.
                            </p>
                        </div>
                        <Button type="primary" icon={<Plus size={16} />}
                            onClick={() => setShowCreate(true)}
                            style={{
                                height: 42, borderRadius: 999,
                                background: '#fff', border: 'none', fontWeight: 850,
                                color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: 6,
                                boxShadow: '0 12px 28px rgba(15,23,42,0.22)'
                            }}
                        >
                            Tạo Widget
                        </Button>
                    </div>
                </div>

                <div className="widgets-stat-grid">
                    {[
                        { label: 'Widget đang bật', value: activeWidgets, hint: `${widgets.length} widget trong workspace`, icon: MessageSquare, tone: '#4f46e5' },
                        { label: 'Domain bảo vệ', value: protectedWidgets, hint: 'Đã cấu hình allowlist', icon: ShieldCheck, tone: '#059669' },
                        { label: 'Form thu lead', value: preChatWidgets, hint: 'Pre-chat đang bật', icon: ClipboardCheck, tone: '#d97706' },
                        { label: 'Tin chưa đọc', value: unreadTotal, hint: 'Đi tới Inbox để xử lý', icon: AlertTriangle, tone: '#dc2626' },
                    ].map((item) => {
                        const Icon = item.icon;
                        return (
                            <div key={item.label} className="widgets-stat-card">
                                <div className="widgets-stat-top">
                                    <div className="widgets-stat-label">{item.label}</div>
                                    <span className="widgets-stat-icon" style={{ color: item.tone }}>
                                        <Icon size={18} />
                                    </span>
                                </div>
                                <div>
                                    <div className="widgets-stat-value">{item.value}</div>
                                    <div className="widgets-stat-hint">{item.hint}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="widget-section-head">
                    <div className="widget-section-title">
                        <span className="widget-section-icon"><Rocket size={18} /></span>
                        Luồng triển khai Web chat
                    </div>
                </div>

                <div className="widget-flow">
                    {[
                        { icon: Settings, title: '1. Cấu hình widget', text: 'Chọn màu, vị trí, lời chào, form pre-chat và điều kiện domain được phép tải widget.' },
                        { icon: FlaskConical, title: '2. Test local', text: 'Mở môi trường giả lập để kiểm tra bubble, form, gửi tin nhắn và khả năng đẩy hội thoại về Inbox.' },
                        { icon: Code, title: '3. Nhúng website', text: 'Copy script vào trước thẻ </head>, sau đó theo dõi trạng thái và tin nhắn realtime trong Inbox CSKH.' },
                    ].map((step) => {
                        const Icon = step.icon;
                        return (
                            <div key={step.title} className="widget-flow-card">
                                <span className="widgets-stat-icon"><Icon size={17} /></span>
                                <strong>{step.title}</strong>
                                <span>{step.text}</span>
                            </div>
                        );
                    })}
                </div>

                {wLoading ? (
                    <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
                ) : widgets.length === 0 ? (
                    <div className="card" style={{ padding: '60px 40px', textAlign: 'center' }}>
                        <Empty description={<span style={{ color: 'var(--color-text-secondary)' }}>Chưa có widget nào.</span>} />
                        <Button type="primary" onClick={() => setShowCreate(true)} style={{
                            marginTop: 24, height: 40, borderRadius: 'var(--radius-full)',
                            background: 'var(--gradient-hero)', border: 'none', fontWeight: 600
                        }}>Tạo Widget đầu tiên</Button>
                    </div>
                ) : (
                    <div className="widget-card-grid">
                        {widgets.map((w) => {
                            const widgetId = getWidgetId(w);
                            const readiness = getWidgetReadiness(w);
                            const domains = w.domainRules?.domains || [];
                            const color = w.config?.primaryColor || '#6366f1';
                            return (
                                <div key={widgetId} className="widget-card">
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                                            <div style={{
                                                width: 44, height: 44, borderRadius: 14,
                                                background: w.config?.gradient || color,
                                                display: 'grid', placeItems: 'center',
                                                color: 'white', fontWeight: 900, fontSize: 18,
                                                boxShadow: '0 10px 24px rgba(99,102,241,0.18)',
                                                flexShrink: 0,
                                            }}>{w.name.charAt(0).toUpperCase()}</div>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontWeight: 900, color: '#0f172a', fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name}</div>
                                                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                                                    {w.config?.position || 'bottom-right'} · {w.config?.language || 'vi'} · ID {String(widgetId).slice(0, 8)}
                                                </div>
                                            </div>
                                        </div>
                                        <Tag style={{ margin: 0, borderRadius: 999, border: 'none', fontWeight: 800, background: readiness.percent >= 80 ? '#ecfdf5' : '#fffbeb', color: readiness.percent >= 80 ? '#059669' : '#d97706' }}>
                                            {readiness.percent}% sẵn sàng
                                        </Tag>
                                    </div>

                                    <div className="widget-readiness-bar">
                                        <div className="widget-readiness-fill" style={{ width: `${readiness.percent}%` }} />
                                    </div>

                                    <div style={{ color: '#475569', fontSize: 13, lineHeight: 1.5, minHeight: 40 }}>
                                        {w.config?.greeting?.slice(0, 96) || 'Chưa cấu hình lời chào cho khách truy cập.'}
                                        {(w.config?.greeting?.length ?? 0) > 96 ? '...' : ''}
                                    </div>

                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                                        <Tag color={w.config?.preChatForm?.enabled ? 'green' : 'default'} style={{ borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                                            Pre-chat {w.config?.preChatForm?.enabled ? 'bật' : 'tắt'}
                                        </Tag>
                                        <Tag style={{ borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                                            {domains.length ? `${domains.length} domain` : 'Chưa giới hạn domain'}
                                        </Tag>
                                        <Tag style={{ borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                                            {w.config?.showBranding === false ? 'Ẩn branding' : 'Có branding'}
                                        </Tag>
                                    </div>

                                    <div className="widget-mini-checks">
                                        {readiness.checks.map((check) => (
                                            <span key={check.label} className="widget-mini-check">
                                                {check.ok ? <CheckCircle2 size={13} color="#059669" /> : <AlertTriangle size={13} color="#d97706" />}
                                                {check.label}
                                            </span>
                                        ))}
                                    </div>

                                    <div className="widget-actions">
                                        <Button type="text" size="small" icon={<Settings size={14} />}
                                            onClick={(e) => { e.stopPropagation(); openConfig(w); }}
                                            style={{ fontSize: 12, fontWeight: 700 }}
                                        >Cấu hình</Button>
                                        <Button type="text" size="small" icon={<FlaskConical size={14} />}
                                            onClick={(e) => { e.stopPropagation(); setTestModal(widgetId); }}
                                            style={{ fontSize: 12, color: '#059669', fontWeight: 700 }}
                                        >Test</Button>
                                        <Button type="text" size="small" icon={<Code size={14} />}
                                            onClick={(e) => { e.stopPropagation(); setSnippetModal(widgetId); }}
                                            style={{ fontSize: 12, fontWeight: 700 }}
                                        >Nhúng</Button>
                                        <Button type="text" size="small" danger icon={<Trash2 size={14} />}
                                            onClick={(e) => { e.stopPropagation(); handleDelete(widgetId); }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* ─── Create Widget Modal ─── */}
            <Modal title="Tạo Widget mới" open={showCreate}
                onCancel={() => { setShowCreate(false); createForm.resetFields(); }} footer={null} destroyOnClose>
                <Form form={createForm} layout="vertical" onFinish={handleCreate} requiredMark={false} style={{ marginTop: 16 }}>
                    <Form.Item label="Tên widget" name="name"
                        rules={[{ required: true, message: 'Vui lòng nhập tên!' }]}>
                        <Input placeholder="VD: Widget hỗ trợ khách hàng" />
                    </Form.Item>
                    <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                        <Button onClick={() => { setShowCreate(false); createForm.resetFields(); }} style={{ marginRight: 8 }}>Huỷ</Button>
                        <Button type="primary" htmlType="submit" loading={creating}
                            style={{ background: 'var(--gradient-hero)', border: 'none', fontWeight: 600, borderRadius: 'var(--radius-md)' }}>
                            Tạo widget
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>

            {/* ─── Embed Snippet Modal ─── */}
            <Modal title="Mã nhúng widget" open={!!snippetModal} onCancel={() => setSnippetModal(null)} footer={null} width={600}>
                {snippetModal && <EmbedSnippet widgetId={snippetModal} />}
            </Modal>

            {/* ─── Local Test Modal ─── */}
            <Modal
                rootClassName="widget-test-modal-root"
                title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FlaskConical size={18} style={{ color: '#10b981' }} /> Test Widget tại Local</div>}
                open={!!testModal}
                onCancel={() => setTestModal(null)}
                footer={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, width: '100%', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                            Widget đang chạy trên môi trường local — test trước khi xuất bản.
                        </span>
                        <Space size={8} wrap>
                            {testModal && (
                                <Button icon={<Copy size={14} />} onClick={() => copyWidgetSnippet(testModal)}>
                                    Copy mã nhúng
                                </Button>
                            )}
                            <Button icon={<ExternalLink size={14} />} onClick={() => router.push(`/workspace/${wsId}/inbox?channel=widget`)}>
                                Mở Inbox
                            </Button>
                            <Button onClick={() => setTestModal(null)}>Đóng</Button>
                        </Space>
                    </div>
                }
                width={960}
                centered
                styles={{
                    body: {
                        padding: 0,
                        height: 'min(78vh, 860px)',
                        overflow: 'hidden',
                        borderTop: '1px solid var(--color-border)'
                    },
                    footer: {
                        marginTop: 0,
                        borderTop: '1px solid var(--color-border)',
                        paddingTop: 12
                    }
                }}
                destroyOnClose
            >
                <div style={{ height: '100%', background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)' }}>
                    <div style={{
                        height: 44,
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 14px',
                        fontSize: 12,
                        color: 'var(--color-text-secondary)',
                        borderBottom: '1px solid var(--color-border)',
                        background: '#fff'
                    }}>
                        Mô phỏng website local có nhúng widget
                    </div>
                    <div style={{ height: 'calc(100% - 44px)' }}>
                        {testModal ? (() => {
                            const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3010';
                            const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
                            const backendBase = apiUrl ? apiUrl.replace(/\/api\/?$/, '') : origin;
                            const testHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Widget Test - NemarkChat</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: radial-gradient(circle at top left, #eef2ff 0, transparent 32%), linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            min-height: 100vh;
            color: #0f172a;
        }
        .test-page {
            max-width: 920px;
            margin: 0 auto;
            padding: 46px 36px 120px;
        }
        .test-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: #ecfdf5;
            color: #059669;
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 800;
            margin-bottom: 20px;
            border: 1px solid #a7f3d0;
        }
        .test-badge::before {
            content: '';
            width: 8px;
            height: 8px;
            border-radius: 999px;
            background: #10b981;
            box-shadow: 0 0 0 4px rgba(16,185,129,.12);
        }
        h1 {
            font-size: 34px;
            font-weight: 900;
            letter-spacing: 0;
            color: #0f172a;
            margin-bottom: 12px;
        }
        p {
            color: #64748b;
            font-size: 15px;
            line-height: 1.6;
            margin-bottom: 0;
            max-width: 680px;
        }
        .hero {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 28px;
            margin-bottom: 24px;
        }
        .hero-panel {
            min-width: 210px;
            background: #fff;
            border: 1px solid #dbeafe;
            border-radius: 18px;
            padding: 16px;
            box-shadow: 0 16px 35px rgba(15,23,42,.06);
        }
        .hero-panel strong {
            display: block;
            font-size: 13px;
            margin-bottom: 8px;
        }
        .hero-panel span {
            display: block;
            font-size: 12px;
            color: #64748b;
            line-height: 1.5;
            word-break: break-all;
        }
        .status-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
            margin: 22px 0;
        }
        .status-card {
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 14px;
            padding: 14px;
            box-shadow: 0 12px 26px rgba(15,23,42,.04);
        }
        .status-card label {
            display: block;
            color: #64748b;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            margin-bottom: 8px;
        }
        .status-card strong {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            color: #0f172a;
            word-break: break-all;
        }
        .dot {
            width: 8px;
            height: 8px;
            flex: 0 0 8px;
            border-radius: 999px;
            background: #22c55e;
        }
        .scenario-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
            margin-bottom: 24px;
        }
        .scenario {
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            padding: 18px;
            box-shadow: 0 14px 30px rgba(15,23,42,.045);
        }
        .scenario small {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 26px;
            height: 26px;
            border-radius: 10px;
            background: #eef2ff;
            color: #4f46e5;
            font-weight: 900;
            margin-bottom: 10px;
        }
        .scenario strong {
            display: block;
            font-size: 14px;
            margin-bottom: 6px;
        }
        .scenario span {
            display: block;
            font-size: 12px;
            color: #64748b;
            line-height: 1.55;
        }
        .test-card {
            background: white;
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 4px 24px rgba(0,0,0,0.06);
            border: 1px solid #e2e8f0;
            text-align: left;
            margin-bottom: 24px;
        }
        .test-card h3 {
            font-size: 14px;
            font-weight: 600;
            color: #334155;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .checklist {
            list-style: none;
            padding: 0;
        }
        .checklist li {
            padding: 8px 0;
            font-size: 13px;
            color: #475569;
            display: flex;
            align-items: center;
            gap: 8px;
            border-bottom: 1px solid #f1f5f9;
        }
        .checklist li:last-child { border-bottom: none; }
        .checklist li::before {
            content: '□';
            font-size: 16px;
            color: #94a3b8;
        }
        .note {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            border-radius: 10px;
            padding: 12px 16px;
            font-size: 12px;
            text-align: left;
            transition: background .2s ease, border-color .2s ease, color .2s ease;
        }
        .note-pending {
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            color: #1d4ed8;
        }
        .note-success {
            background: #ecfdf5;
            border: 1px solid #a7f3d0;
            color: #047857;
        }
        .note-error {
            background: #fff1f2;
            border: 1px solid #fecdd3;
            color: #be123c;
        }
        .note::before {
            content: '…';
            font-size: 16px;
            font-weight: 900;
            flex-shrink: 0;
        }
        .note-success::before { content: '✓'; }
        .note-error::before { content: '!'; }
        @media (max-width: 720px) {
            .test-page { padding: 28px 18px 110px; }
            .hero, .status-grid, .scenario-grid { grid-template-columns: 1fr; display: grid; }
            h1 { font-size: 26px; }
        }
    </style>
</head>
<body>
    <div class="test-page">
        <div class="test-badge">Môi trường Test Local</div>
        <div class="hero">
            <div>
                <h1>Phòng kiểm thử Web chat</h1>
                <p>
                    Kiểm tra widget như trên website thật: loader, domain, giao diện bubble, form pre-chat và luồng gửi tin về Inbox CSKH.
                </p>
            </div>
            <div class="hero-panel">
                <strong>Widget ID</strong>
                <span>${testModal}</span>
            </div>
        </div>

        <div class="status-grid">
            <div class="status-card">
                <label>Script loader</label>
                <strong><i class="dot"></i> Đã nhúng</strong>
            </div>
            <div class="status-card">
                <label>API base</label>
                <strong><i class="dot"></i> ${backendBase}</strong>
            </div>
            <div class="status-card">
                <label>Hướng kiểm tra</label>
                <strong><i class="dot"></i> Mở bubble bên dưới</strong>
            </div>
        </div>

        <div class="scenario-grid">
            <div class="scenario">
                <small>1</small>
                <strong>Hiển thị launcher</strong>
                <span>Bubble cần đúng màu, vị trí, bo góc và không che nội dung quan trọng của website.</span>
            </div>
            <div class="scenario">
                <small>2</small>
                <strong>Mở cửa sổ chat</strong>
                <span>Kiểm tra greeting, placeholder, avatar, branding và trạng thái online/offline.</span>
            </div>
            <div class="scenario">
                <small>3</small>
                <strong>Thu thông tin khách</strong>
                <span>Nếu bật pre-chat, form phải validate tên, email, số điện thoại và field tuỳ chỉnh.</span>
            </div>
            <div class="scenario">
                <small>4</small>
                <strong>Đẩy hội thoại về Inbox</strong>
                <span>Gửi tin nhắn test, sau đó mở Inbox để xác nhận hội thoại mới xuất hiện realtime.</span>
            </div>
        </div>

        <div class="test-card">
            <h3>Checklist nghiệm thu trước khi xuất bản</h3>
            <ul class="checklist">
                <li>Widget bubble hiển thị đúng vị trí và màu sắc</li>
                <li>Click mở widget → hiện cửa sổ chat</li>
                <li>Form pre-chat hiển thị (nếu đã bật)</li>
                <li>Gửi tin nhắn test → nhận được trong Inbox</li>
                <li>Lời chào và placeholder đúng</li>
                <li>Branding NemarkChat hiển thị (nếu bật)</li>
            </ul>
        </div>

        <div id="connection-note" class="note note-pending" role="status" aria-live="polite">
            Đang kiểm tra kết nối API và cấu hình widget…
        </div>
    </div>

    <!-- NemarkChat Widget -->
    <script>
        (function(w,d,s,o){
            w.NemarkChat=o;w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
            var js=d.createElement(s);js.async=1;
            js.src='${getWidgetLoaderUrl(origin)}';
            js.setAttribute('data-widget-id','${testModal}');
            js.setAttribute('data-api-base','${backendBase}');
            d.head.appendChild(js);
        })(window,document,'script','nchat');

        (function(){
            var note = document.getElementById('connection-note');
            var controller = new AbortController();
            var timeout = window.setTimeout(function(){ controller.abort(); }, 8000);
            fetch('${backendBase}/api/workspaces/public/widgets/${testModal}/config', {
                headers: { 'Accept': 'application/json' },
                signal: controller.signal
            })
                .then(function(response){
                    if (!response.ok) throw new Error('HTTP ' + response.status);
                    return response.json();
                })
                .then(function(payload){
                    if (!payload || payload.success === false) throw new Error('Cấu hình không hợp lệ');
                    note.className = 'note note-success';
                    note.textContent = 'API đã kết nối và tải cấu hình widget thành công.';
                })
                .catch(function(error){
                    note.className = 'note note-error';
                    note.textContent = 'Không tải được cấu hình widget. Kiểm tra API, domain cho phép hoặc trạng thái kích hoạt.';
                    console.warn('[NemarkChat Test] Widget config check failed:', error);
                })
                .finally(function(){
                    window.clearTimeout(timeout);
                });
        })();
    </script>
</body>
</html>`;

                            return (
                                <iframe
                                    srcDoc={testHtml}
                                    style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                                    title="Widget Local Test"
                                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                                />
                            );
                        })() : null}
                    </div>
                </div>
            </Modal>

            {/* ─── Config Drawer ─── */}
            <Drawer
                title="Cấu hình Widget"
                open={configDrawer}
                onClose={() => { setConfigDrawer(false); setEditingWidget(null); }}
                width={typeof window !== 'undefined' && window.innerWidth > 1200 ? Math.min(window.innerWidth - 80, 1400) : '100%'}
                destroyOnClose
                extra={
                    <Space size={8}>
                        <Button icon={<Eye size={15} />} onClick={() => setConfigPreviewOpen(value => !value)}>
                            {configPreviewOpen ? 'Ẩn xem trước' : 'Xem trước'}
                        </Button>
                        <Button type="primary" loading={updating} onClick={() => configForm.submit()}
                            style={{ background: 'var(--gradient-hero)', border: 'none', fontWeight: 600, borderRadius: 8 }}>
                            Lưu cấu hình
                        </Button>
                    </Space>
                }
                styles={{ body: { padding: 0, overflow: 'hidden' } }}
            >
                {editingWidget && (
                    <div className="widget-config-layout">
                        {/* Form */}
                        <div className="widget-config-form-pane">
                            <style>{`
                                .widget-config-layout { display: flex; height: calc(100vh - 56px); min-height: 0; background: #f8fafc; }
                                .widget-config-form-pane { flex: 1; min-width: 0; background: #fff; }
                                .widget-config-form-pane > form { height: 100%; }
                                .widget-config-mobile-nav { display: none; padding: 12px 16px; border-bottom: 1px solid #e8edf3; background: #fff; }
                                .widget-config-tabs { height: 100%; }
                                .widget-config-tabs > .ant-tabs-nav { width: 208px; margin: 0 !important; padding: 16px 10px; background: #f8fafc; border-right: 1px solid #e8edf3; }
                                .widget-config-tabs > .ant-tabs-nav .ant-tabs-nav-list { gap: 4px !important; }
                                .widget-config-tabs > .ant-tabs-nav .ant-tabs-tab { margin: 0 !important; padding: 10px 12px !important; border-radius: 8px; white-space: normal !important; font-size: 13px !important; }
                                .widget-config-tabs > .ant-tabs-nav .ant-tabs-tab:hover { background: #eef2ff; }
                                .widget-config-tabs > .ant-tabs-nav .ant-tabs-tab-active { background: #e9edff; }
                                .widget-config-tabs .ant-tabs-tab-active .ant-tabs-tab-btn { font-weight: 600 !important; }
                                .widget-config-tabs > .ant-tabs-content-holder { min-width: 0; overflow-y: auto; }
                                .widget-config-tabs .ant-tabs-content { max-width: 820px; margin: 0 auto; padding: 24px 28px 80px; }
                                .widget-config-preview { width: min(420px, 34vw); flex-shrink: 0; overflow-y: auto; overflow-x: hidden; padding: 16px; border-left: 1px solid #e8edf3; background: #f8fafc; }
                                .widget-config-preview-header { position: sticky; top: -16px; z-index: 2; display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: -16px -16px 12px; padding: 14px 16px 10px; background: rgba(248,250,252,.96); backdrop-filter: blur(8px); }
                                @media (max-width: 900px) {
                                    .widget-config-layout { display: block; overflow-y: auto; }
                                    .widget-config-mobile-nav { display: block; position: sticky; top: 0; z-index: 4; }
                                    .widget-config-tabs { height: auto; }
                                    .widget-config-tabs > .ant-tabs-nav { display: none; }
                                    .widget-config-tabs > .ant-tabs-content-holder { overflow: visible; }
                                    .widget-config-tabs .ant-tabs-content { padding: 18px 16px 80px; }
                                    .widget-config-preview { width: 100%; border-left: 0; border-top: 1px solid #e8edf3; }
                                }
                            `}</style>
                            <Form form={configForm} layout="vertical" onFinish={handleSaveConfig} requiredMark={false}>
                                <div className="widget-config-mobile-nav">
                                    <Select
                                        value={configSection}
                                        onChange={setConfigSection}
                                        style={{ width: '100%' }}
                                        options={[
                                            { value: 'general', label: 'Chung' },
                                            { value: 'appearance', label: 'Giao diện' },
                                            { value: 'custom-ui', label: 'Code giao diện' },
                                            { value: 'prechat', label: 'Form Pre-chat' },
                                            { value: 'domains', label: 'Domains' },
                                            { value: 'timing', label: 'Thời gian & Mục tiêu' },
                                            { value: 'greeting', label: 'Lời mời chat' },
                                            { value: 'profile', label: 'Hồ sơ & Đánh giá' },
                                        ]}
                                    />
                                </div>
                                <Tabs activeKey={configSection} onChange={setConfigSection} tabPosition="left" className="widget-config-tabs" items={[
                                    {
                                        key: 'general', label: 'Chung',
                                        children: (
                                            <>
                                                <Form.Item label="Tên widget" name="name">
                                                    <Input />
                                                </Form.Item>
                                                <Form.Item label="Màu chủ đạo" name="primaryColor">
                                                    <ColorPicker showText />
                                                </Form.Item>
                                                <Form.Item label="Lời chào" name="greeting">
                                                    <Input.TextArea rows={2} />
                                                </Form.Item>
                                                <Form.Item label="Placeholder" name="placeholder">
                                                    <Input />
                                                </Form.Item>
                                                <Form.Item label="Vị trí hiển thị" name="position">
                                                    <Select options={[
                                                        { value: 'bottom-right', label: 'Dưới phải (Mặc định)' },
                                                        { value: 'bottom-left', label: 'Dưới trái' },
                                                        { value: 'side-right', label: 'Gắn cạnh phải (Middle Right)' },
                                                        { value: 'side-left', label: 'Gắn cạnh trái (Middle Left)' },
                                                    ]} />
                                                </Form.Item>
                                                <Form.Item label="Ngôn ngữ" name="language">
                                                    <Select options={[
                                                        { value: 'vi', label: 'Tiếng Việt' },
                                                        { value: 'en', label: 'English' },
                                                    ]} />
                                                </Form.Item>
                                                <Form.Item label="Tin nhắn offline" name="offlineMessage">
                                                    <Input.TextArea rows={2} />
                                                </Form.Item>
                                                <Form.Item label="Tự động trả lời" name="autoReply">
                                                    <Input placeholder="Để trống nếu không cần" />
                                                </Form.Item>
                                                <Card size="small" style={{ background: '#f8fafc' }}>
                                                    <Form.Item label="Thương hiệu dưới widget" name="brandingMode" extra={paidWidgetCustomization ? 'Gói hiện tại được phép white-label.' : 'Gói dùng thử bắt buộc hiển thị NemarkChat.'}>
                                                        <Select disabled={!paidWidgetCustomization} options={[
                                                            { value: 'hidden', label: 'Ẩn hoàn toàn (khuyên dùng)' },
                                                            { value: 'custom', label: 'Dùng thương hiệu riêng' },
                                                            { value: 'nemark', label: 'Hiện NemarkChat' },
                                                        ]} />
                                                    </Form.Item>
                                                    <Form.Item noStyle shouldUpdate={(prev, cur) => prev.brandingMode !== cur.brandingMode}>
                                                        {({ getFieldValue }) => paidWidgetCustomization && getFieldValue('brandingMode') === 'custom' ? <>
                                                            <Form.Item label="Tên thương hiệu riêng" name="brandingName">
                                                                <Input maxLength={80} placeholder="Ví dụ: ACME Support" />
                                                            </Form.Item>
                                                            <Form.Item label="Liên kết thương hiệu" name="brandingUrl">
                                                                <Input type="url" placeholder="https://example.com" />
                                                            </Form.Item>
                                                        </> : null}
                                                    </Form.Item>
                                                </Card>
                                            </>
                                        ),
                                    },
                                    {
                                        key: 'appearance', label: 'Giao diện',
                                        children: (
                                            <>
                                                <Form.Item label="Kiểu nút bấm (Style)" name="launcherStyle">
                                                    <Select options={[
                                                        { value: 'bubble', label: 'Bong bóng tròn (Bubble)' },
                                                        { value: 'tab', label: 'Thẻ cạnh viền (Tab)' },
                                                        { value: 'pill', label: 'Hình viên thuốc (Pill)' },
                                                        { value: 'image', label: 'Ảnh tùy chỉnh (Image)' },
                                                    ]} />
                                                </Form.Item>
                                                
                                                <Form.Item noStyle shouldUpdate={(prev, cur) => prev.launcherStyle !== cur.launcherStyle}>
                                                    {({ getFieldValue }) => {
                                                        const style = getFieldValue('launcherStyle') || 'bubble';
                                                        if (style === 'tab' || style === 'pill') {
                                                            return (
                                                                <Form.Item label="Văn bản trên nút" name="launcherText" extra="VD: Hỗ trợ, Text us...">
                                                                    <Input placeholder="Nhập chữ..." />
                                                                </Form.Item>
                                                            );
                                                        }
                                                        return null;
                                                    }}
                                                </Form.Item>

                                                <Form.Item label="Icon / Ảnh đại diện nút" extra="Nhập URL ảnh hoặc tải ảnh lên để thay thế icon SVG mặc định.">
                                                    <Space.Compact style={{ width: '100%' }}>
                                                        <Form.Item name="launcherIcon" noStyle>
                                                            <Input placeholder="https://..." style={{ flex: 1 }} />
                                                        </Form.Item>
                                                        <Upload
                                                            showUploadList={false}
                                                            accept="image/*"
                                                            customRequest={async (options) => {
                                                                try {
                                                                    const res = await uploadService.uploadImage(options.file as File);
                                                                    if (res && res.url) {
                                                                        // The uploaded file is served from the backend (port 4010)
                                                                        const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4010';
                                                                        const fullUrl = apiBase + res.url;
                                                                        configForm.setFieldValue('launcherIcon', fullUrl);
                                                                        message.success('Tải ảnh thành công!');
                                                                        options.onSuccess?.(res);
                                                                    }
                                                                } catch (error) {
                                                                    message.error('Tải ảnh thất bại');
                                                                    options.onError?.(error as any);
                                                                }
                                                            }}
                                                        >
                                                            <Button icon={<UploadIcon size={16} />} title="Tải ảnh lên" />
                                                        </Upload>
                                                    </Space.Compact>
                                                    {configForm.getFieldValue('launcherIcon') && (
                                                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <img src={configForm.getFieldValue('launcherIcon')} alt="preview" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', border: '1px solid #eee' }} />
                                                            <Button size="small" danger type="text" onClick={() => configForm.setFieldValue('launcherIcon', '')}>Xoá icon</Button>
                                                        </div>
                                                    )}
                                                </Form.Item>

                                                <Form.Item label="Tooltip (Trỏ chuột)" name="tooltipText" extra="VD: Liên hệ với chúng tôi">
                                                    <Input placeholder="Nhập chữ hiển thị khi hover..." />
                                                </Form.Item>

                                                <Form.Item label="Dải màu nền (Gradient)" extra="Ghi đè màu chủ đạo. Chọn mẫu có sẵn hoặc tự chọn 2 màu.">
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                        {/* Preset gradient selector */}
                                                        <Form.Item name="gradient" noStyle>
                                                            <Select allowClear placeholder="Chọn dải màu có sẵn..." onChange={(val) => {
                                                                if (val) configForm.setFieldValue('gradient', val);
                                                            }} options={[
                                                                { value: 'linear-gradient(135deg, #6366f1, #a855f7)', label: '💜 Indigo Purple' },
                                                                { value: 'linear-gradient(135deg, #3b82f6, #06b6d4)', label: '🌊 Ocean Blue' },
                                                                { value: 'linear-gradient(135deg, #ec4899, #f43f5e)', label: '💖 Love Pink' },
                                                                { value: 'linear-gradient(135deg, #f59e0b, #ed8936)', label: '🌅 Sunset Orange' },
                                                                { value: 'linear-gradient(135deg, #10b981, #3b82f6)', label: '🌿 Emerald Sea' },
                                                                { value: 'linear-gradient(135deg, #111827, #374151)', label: '🌑 Midnight Dark' },
                                                                { value: '__custom__', label: '🎨 Tuỳ chỉnh (chọn 2 màu)' },
                                                            ]} />
                                                        </Form.Item>
                                                        {/* Custom dual-color picker */}
                                                        <Form.Item noStyle shouldUpdate={(prev, cur) => prev.gradient !== cur.gradient}>
                                                            {({ getFieldValue }) => {
                                                                const g = getFieldValue('gradient') || '';
                                                                if (g === '__custom__' || (g && !g.startsWith('linear-gradient(135deg, #') || g === '__custom__')) {
                                                                    return null; // show below
                                                                }
                                                                return null;
                                                            }}
                                                        </Form.Item>
                                                        <Form.Item noStyle shouldUpdate>
                                                            {({ getFieldValue, setFieldValue }) => {
                                                                const g = getFieldValue('gradient') || '';
                                                                const isCustom = g === '__custom__' || (g && g.startsWith('linear-gradient') && ![
                                                                    'linear-gradient(135deg, #6366f1, #a855f7)',
                                                                    'linear-gradient(135deg, #3b82f6, #06b6d4)',
                                                                    'linear-gradient(135deg, #ec4899, #f43f5e)',
                                                                    'linear-gradient(135deg, #f59e0b, #ed8936)',
                                                                    'linear-gradient(135deg, #10b981, #3b82f6)',
                                                                    'linear-gradient(135deg, #111827, #374151)',
                                                                ].includes(g));
                                                                if (!isCustom && g !== '__custom__') return null;

                                                                // Parse existing gradient colors or use defaults
                                                                let c1 = '#6366f1', c2 = '#a855f7';
                                                                if (g && g !== '__custom__') {
                                                                    const match = g.match(/#[0-9a-fA-F]{6}/g);
                                                                    if (match && match.length >= 2) { c1 = match[0]; c2 = match[1]; }
                                                                }

                                                                return (
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#fafafa', borderRadius: 10, border: '1px solid #f0f0f0' }}>
                                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                                                            <span style={{ fontSize: 11, color: '#888' }}>Màu 1</span>
                                                                            <ColorPicker value={c1} showText size="small" onChange={(color) => {
                                                                                const hex1 = color.toHexString();
                                                                                setFieldValue('gradient', `linear-gradient(135deg, ${hex1}, ${c2})`);
                                                                            }} />
                                                                        </div>
                                                                        <div style={{ flex: 1, height: 32, borderRadius: 8, background: `linear-gradient(90deg, ${c1}, ${c2})` }} />
                                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                                                            <span style={{ fontSize: 11, color: '#888' }}>Màu 2</span>
                                                                            <ColorPicker value={c2} showText size="small" onChange={(color) => {
                                                                                const hex2 = color.toHexString();
                                                                                setFieldValue('gradient', `linear-gradient(135deg, ${c1}, ${hex2})`);
                                                                            }} />
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }}
                                                        </Form.Item>
                                                        {/* Preview swatch */}
                                                        <Form.Item noStyle shouldUpdate>
                                                            {({ getFieldValue }) => {
                                                                const g = getFieldValue('gradient');
                                                                if (!g || g === '__custom__') return null;
                                                                return (
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                        <div style={{ width: 120, height: 28, borderRadius: 6, background: g, border: '1px solid #e0e0e0' }} />
                                                                        <span style={{ fontSize: 11, color: '#999' }}>Xem trước</span>
                                                                    </div>
                                                                );
                                                            }}
                                                        </Form.Item>
                                                    </div>
                                                </Form.Item>
                                            </>
                                        ),
                                    },
                                    {
                                        key: 'custom-ui', label: 'Code giao diện',
                                        children: (
                                            <>
                                                <Card size="small" style={{ marginBottom: 16, background: paidWidgetCustomization ? '#f0fdf4' : '#fff7ed' }}>
                                                    <strong>{paidWidgetCustomization ? '✓ Đã mở khóa theo gói hiện tại' : 'Tính năng dành cho gói Khởi đầu trở lên'}</strong>
                                                    <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 12 }}>
                                                        CSS chạy sau giao diện mặc định. Dùng selector <code>#nchat-window</code>, <code>#nchat-hdr</code>, <code>#nchat-body</code>, <code>#nchat-ftr</code> hoặc <code>#nchat-bubble</code>. Không hỗ trợ JavaScript để bảo vệ website nhúng.
                                                    </p>
                                                </Card>
                                                <Form.Item label="Mẫu giao diện" name="themePreset">
                                                    <Select disabled={!paidWidgetCustomization} options={[
                                                        { value: 'modern', label: 'Modern — Mặc định' },
                                                        { value: 'minimal', label: 'Minimal — Tối giản' },
                                                        { value: 'glass', label: 'Glass — Kính mờ' },
                                                        { value: 'compact', label: 'Compact — Nhỏ gọn' },
                                                    ]} />
                                                </Form.Item>
                                                <Form.Item label="CSS tùy chỉnh" name="customCss" extra="Tối đa 12.000 ký tự. URL, @import và các cú pháp có thể chạy mã bị chặn.">
                                                    <Input.TextArea disabled={!paidWidgetCustomization} rows={14} maxLength={12000} showCount spellCheck={false}
                                                        style={{ fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: 12 }}
                                                        placeholder={'#nchat-window {\n  border-radius: 28px;\n}\n\n#nchat-hdr {\n  min-height: 88px;\n}\n\n#nchat-send {\n  border-radius: 999px;\n}'} />
                                                </Form.Item>
                                            </>
                                        ),
                                    },
                                    {
                                        key: 'prechat', label: 'Form Pre-chat',
                                        children: (
                                            <>
                                                <Form.Item label="Bật form pre-chat" name="preChatEnabled" valuePropName="checked">
                                                    <Switch />
                                                </Form.Item>
                                                <Form.Item label="Tiêu đề form" name="preChatTitle">
                                                    <Input />
                                                </Form.Item>
                                                <Divider style={{ fontSize: 13 }}>Trường mặc định</Divider>
                                                {/* Built-in fields: name/email/phone */}
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                                    <Text strong style={{ fontSize: 13 }}>Họ và tên</Text>
                                                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                                        <Form.Item name="fieldNameRequired" valuePropName="checked" noStyle>
                                                            <Switch size="small" checkedChildren="Bắt buộc" unCheckedChildren="Tuỳ chọn" />
                                                        </Form.Item>
                                                        <Form.Item name="fieldName" valuePropName="checked" noStyle>
                                                            <Switch size="small" checkedChildren="Bật" unCheckedChildren="Tắt" />
                                                        </Form.Item>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                                    <Text strong style={{ fontSize: 13 }}>Email</Text>
                                                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                                        <Form.Item name="fieldEmailRequired" valuePropName="checked" noStyle>
                                                            <Switch size="small" checkedChildren="Bắt buộc" unCheckedChildren="Tuỳ chọn" />
                                                        </Form.Item>
                                                        <Form.Item name="fieldEmail" valuePropName="checked" noStyle>
                                                            <Switch size="small" checkedChildren="Bật" unCheckedChildren="Tắt" />
                                                        </Form.Item>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                                    <Text strong style={{ fontSize: 13 }}>Số điện thoại</Text>
                                                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                                        <Form.Item name="fieldPhoneRequired" valuePropName="checked" noStyle>
                                                            <Switch size="small" checkedChildren="Bắt buộc" unCheckedChildren="Tuỳ chọn" />
                                                        </Form.Item>
                                                        <Form.Item name="fieldPhone" valuePropName="checked" noStyle>
                                                            <Switch size="small" checkedChildren="Bật" unCheckedChildren="Tắt" />
                                                        </Form.Item>
                                                    </div>
                                                </div>
                                                <Card size="small" style={{ marginTop: 14, marginBottom: 14, background: '#f8fafc', borderColor: '#dbeafe' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                                        <div>
                                                            <Text strong style={{ fontSize: 13 }}>Đồng ý nhận email marketing</Text>
                                                            <div style={{ color: '#64748b', fontSize: 11, marginTop: 3 }}>
                                                                Checkbox luôn để trống; khách vẫn chat được khi không đồng ý.
                                                            </div>
                                                        </div>
                                                        <Form.Item name="marketingConsentEnabled" valuePropName="checked" noStyle>
                                                            <Switch size="small" />
                                                        </Form.Item>
                                                    </div>
                                                    <Form.Item noStyle shouldUpdate={(prev, cur) => prev.marketingConsentEnabled !== cur.marketingConsentEnabled}>
                                                        {({ getFieldValue }) => getFieldValue('marketingConsentEnabled') ? (
                                                            <Form.Item
                                                                name="marketingConsentText"
                                                                label="Nội dung xin đồng ý"
                                                                rules={[{ required: true, message: 'Nhập nội dung xin đồng ý' }]}
                                                                style={{ marginTop: 12, marginBottom: 0 }}
                                                            >
                                                                <Input.TextArea rows={3} maxLength={1000} showCount />
                                                            </Form.Item>
                                                        ) : null}
                                                    </Form.Item>
                                                </Card>
                                                {/* Custom fields */}
                                                <Divider style={{ fontSize: 13 }}>Trường tuỳ chỉnh</Divider>
                                                <Form.List name="customFields">
                                                    {(fields, { add, remove }) => (
                                                        <>
                                                            {fields.map(({ key, name, ...restField }) => (
                                                                <Card key={key} size="small" style={{ marginBottom: 8 }}
                                                                    extra={<MinusCircleOutlined onClick={() => remove(name)} style={{ color: '#ff4d4f' }} />}>
                                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                                                        <Form.Item {...restField} name={[name, 'label']} label="Nhãn" rules={[{ required: true }]} style={{ marginBottom: 4 }}>
                                                                            <Input placeholder="Ví dụ: Công ty" size="small" />
                                                                        </Form.Item>
                                                                        <Form.Item {...restField} name={[name, 'key']} label="Key" rules={[{ required: true }]} style={{ marginBottom: 4 }}>
                                                                            <Input placeholder="vd: company" size="small" />
                                                                        </Form.Item>
                                                                        <Form.Item {...restField} name={[name, 'type']} label="Loại" initialValue="text" style={{ marginBottom: 4 }}>
                                                                            <Select size="small" options={[
                                                                                { value: 'text', label: 'Text' },
                                                                                { value: 'email', label: 'Email' },
                                                                                { value: 'tel', label: 'Điện thoại' },
                                                                                { value: 'textarea', label: 'Textarea' },
                                                                                { value: 'select', label: 'Select (dropdown)' },
                                                                                { value: 'checkbox', label: 'Checkbox đồng ý' },
                                                                            ]} />
                                                                        </Form.Item>
                                                                        <Form.Item {...restField} name={[name, 'required']} label="Bắt buộc" valuePropName="checked" style={{ marginBottom: 4 }}>
                                                                            <Switch size="small" />
                                                                        </Form.Item>
                                                                    </div>
                                                                    <Form.Item noStyle shouldUpdate={(prev, cur) => prev?.customFields?.[name]?.type !== cur?.customFields?.[name]?.type}>
                                                                        {({ getFieldValue }) => {
                                                                            const type = getFieldValue(['customFields', name, 'type']);
                                                                            if (type === 'select') {
                                                                                return (
                                                                                    <Form.Item {...restField} name={[name, 'options']} label="Lựa chọn (mỗi dòng 1)" style={{ marginBottom: 0, marginTop: 4 }}>
                                                                                        <Input.TextArea rows={2} placeholder={'Tùy chọn 1\nTùy chọn 2\nTùy chọn 3'} />
                                                                                    </Form.Item>
                                                                                );
                                                                            }
                                                                            return null;
                                                                        }}
                                                                    </Form.Item>
                                                                </Card>
                                                            ))}
                                                            <Button type="dashed" onClick={() => add({ type: 'text', required: false, enabled: true })} block icon={<PlusOutlined />} style={{ marginTop: 4 }}>
                                                                Thêm trường tuỳ chỉnh
                                                            </Button>
                                                        </>
                                                    )}
                                                </Form.List>
                                            </>
                                        ),
                                    },
                                    {
                                        key: 'domains', label: <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Globe size={13} /> Domains</span>,
                                        children: (
                                            <>
                                                <Form.Item label="Chế độ" name="domainMode">
                                                    <Select options={[
                                                        { value: 'allowlist', label: 'Allowlist — Chỉ cho phép các domain dưới đây' },
                                                        { value: 'blocklist', label: 'Blocklist — Chặn các domain dưới đây' },
                                                    ]} />
                                                </Form.Item>
                                                <Divider style={{ fontSize: 13 }}>Danh sách domain</Divider>
                                                <Form.List name="domains">
                                                    {(fields, { add, remove }) => (
                                                        <>
                                                            {fields.map(({ key, name, ...restField }) => (
                                                                <Space key={key} style={{ display: 'flex', marginBottom: 8, width: '100%' }} align="baseline">
                                                                    <Form.Item
                                                                        {...restField}
                                                                        name={[name, 'value']}
                                                                        style={{ flex: 1, marginBottom: 0, width: 260 }}
                                                                        rules={[{ required: true, message: 'Nhập domain' }]}
                                                                    >
                                                                        <Input placeholder="example.com hoặc *.example.com" />
                                                                    </Form.Item>
                                                                    <MinusCircleOutlined onClick={() => remove(name)} style={{ color: '#ff4d4f' }} />
                                                                </Space>
                                                            ))}
                                                            <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} style={{ marginTop: 4 }}>
                                                                Thêm domain
                                                            </Button>
                                                        </>
                                                    )}
                                                </Form.List>
                                                <div style={{ marginTop: 16, padding: 12, background: '#f6f6f6', borderRadius: 8, fontSize: 12, color: '#666' }}>
                                                    <strong>Hướng dẫn:</strong><br />
                                                    • <code>example.com</code> — chỉ domain chính xác<br />
                                                    • <code>*.example.com</code> — tất cả subdomain<br />
                                                    • Nếu allowlist trống → widget hiển thị mọi nơi
                                                </div>
                                            </>
                                        ),
                                    },
                                    {
                                        key: 'timing', label: '⏱ Thời gian & Mục tiêu',
                                        children: (
                                            <>
                                                <Divider style={{ fontSize: 14, fontWeight: 600 }}>Tự mở widget</Divider>
                                                <Form.Item label="Sau khi khách vào website" name="autoOpenMode">
                                                    <Select options={[
                                                        { value: 'none', label: 'Không tự mở' },
                                                        { value: 'immediate', label: 'Ngay lập tức' },
                                                        { value: '20s', label: 'Sau 20 giây' },
                                                        { value: '5min', label: 'Sau 5 phút' },
                                                        { value: 'custom', label: 'Tùy chỉnh (giây)' },
                                                    ]} />
                                                </Form.Item>
                                                <Form.Item noStyle shouldUpdate={(prev, cur) => prev.autoOpenMode !== cur.autoOpenMode}>
                                                    {({ getFieldValue }) => (
                                                        getFieldValue('autoOpenMode') === 'custom' && (
                                                            <Form.Item label="Số giây" name="autoOpenCustom">
                                                                <Input type="number" min={0} placeholder="VD: 30" suffix="giây" />
                                                            </Form.Item>
                                                        )
                                                    )}
                                                </Form.Item>

                                                <Divider style={{ fontSize: 14, fontWeight: 600 }}>Đối tượng mục tiêu — URL</Divider>
                                                <div style={{ marginBottom: 8, fontSize: 12, color: '#666' }}>Cài đặt widget chỉ hiển thị khi gặp điều kiện URL</div>
                                                <Form.List name="urlDomainRules">
                                                    {(fields, { add, remove }) => (
                                                        <>
                                                            <Text strong style={{ fontSize: 12 }}>URL Website (domain)</Text>
                                                            {fields.map(({ key, name, ...rest }) => (
                                                                <Space key={key} style={{ display: 'flex', marginBottom: 6, width: '100%' }} align="baseline">
                                                                    <Form.Item {...rest} name={[name, 'type']} noStyle initialValue="include">
                                                                        <Select style={{ width: 100 }} options={[
                                                                            { value: 'include', label: 'Bao gồm' },
                                                                            { value: 'exclude', label: 'Ngoại trừ' },
                                                                        ]} />
                                                                    </Form.Item>
                                                                    <Form.Item {...rest} name={[name, 'value']} style={{ flex: 1, marginBottom: 0, width: 200 }}>
                                                                        <Input placeholder="example.com" />
                                                                    </Form.Item>
                                                                    <MinusCircleOutlined onClick={() => remove(name)} style={{ color: '#ff4d4f' }} />
                                                                </Space>
                                                            ))}
                                                            <Button type="dashed" onClick={() => add({ type: 'include', value: '' })} block icon={<PlusOutlined />} size="small" style={{ marginBottom: 16 }}>
                                                                + Thêm điều kiện domain
                                                            </Button>
                                                        </>
                                                    )}
                                                </Form.List>
                                                <Form.List name="urlPathRules">
                                                    {(fields, { add, remove }) => (
                                                        <>
                                                            <Text strong style={{ fontSize: 12 }}>Website URL path</Text>
                                                            {fields.map(({ key, name, ...rest }) => (
                                                                <Space key={key} style={{ display: 'flex', marginBottom: 6, width: '100%' }} align="baseline">
                                                                    <Form.Item {...rest} name={[name, 'type']} noStyle initialValue="include">
                                                                        <Select style={{ width: 100 }} options={[
                                                                            { value: 'include', label: 'Bao gồm' },
                                                                            { value: 'exclude', label: 'Ngoại trừ' },
                                                                        ]} />
                                                                    </Form.Item>
                                                                    <Form.Item {...rest} name={[name, 'value']} style={{ flex: 1, marginBottom: 0, width: 200 }}>
                                                                        <Input placeholder="/products/*" />
                                                                    </Form.Item>
                                                                    <MinusCircleOutlined onClick={() => remove(name)} style={{ color: '#ff4d4f' }} />
                                                                </Space>
                                                            ))}
                                                            <Button type="dashed" onClick={() => add({ type: 'include', value: '' })} block icon={<PlusOutlined />} size="small">
                                                                + Thêm điều kiện path
                                                            </Button>
                                                        </>
                                                    )}
                                                </Form.List>
                                            </>
                                        ),
                                    },
                                    {
                                        key: 'greeting', label: '💬 Lời mời chat',
                                        children: (
                                            <>
                                                <div style={{ marginBottom: 16, padding: 12, background: '#f0f7ff', borderRadius: 8, fontSize: 12, color: '#1e40af' }}>
                                                    💡 Popup thông báo nổi xuất hiện bên cạnh nút chat, giúp mời gọi khách hàng nhắn tin.
                                                </div>
                                                <Form.Item label="Bật lời mời chat" name="greetingPopupEnabled" valuePropName="checked">
                                                    <Switch />
                                                </Form.Item>
                                                <Form.Item label="Nội dung lời mời" name="greetingPopupMessage">
                                                    <Input.TextArea rows={2} placeholder="Chào mừng bạn đến với website của chúng tôi!" />
                                                </Form.Item>
                                                <Form.Item label="Văn bản nút CTA" name="greetingPopupCta">
                                                    <Input placeholder="Gửi tin nhắn" />
                                                </Form.Item>
                                                <Form.Item label="Hiển thị sau (giây)" name="greetingPopupDelay">
                                                    <Input type="number" min={0} placeholder="3" suffix="giây" />
                                                </Form.Item>
                                            </>
                                        ),
                                    },
                                    {
                                        key: 'profile', label: '👤 Hồ sơ & Đánh giá',
                                        children: (
                                            <>
                                                <Divider style={{ fontSize: 14, fontWeight: 600 }}>Hiển thị hồ sơ người chat</Divider>
                                                <Form.Item label="Kiểu hiển thị" name="profileDisplay">
                                                    <Select options={[
                                                        { value: 'company', label: '🏢 Doanh nghiệp — Hiện tên workspace' },
                                                        { value: 'agent', label: '👤 Agent — Hiện tên nhân viên đang trả lời' },
                                                    ]} />
                                                </Form.Item>
                                                <Form.Item label="Avatar header (URL ảnh)" name="headerAvatar" extra="Ảnh đại diện hiển thị trên đầu widget">
                                                    <Input placeholder="https://example.com/avatar.jpg" />
                                                </Form.Item>

                                                <Divider style={{ fontSize: 14, fontWeight: 600 }}>Tính năng nâng cao</Divider>
                                                <Form.Item label="Hiện đang gõ" name="showTypingIndicator" valuePropName="checked"
                                                    extra="Hiển thị thông báo đang gõ phím trên cửa sổ chat khi agent soạn tin nhắn">
                                                    <Switch />
                                                </Form.Item>
                                                <Form.Item label="Gửi yêu cầu đánh giá" name="requestRating" valuePropName="checked"
                                                    extra="Tự động xin đánh giá (⭐ 1-5 sao) khi hoàn thành hội thoại">
                                                    <Switch />
                                                </Form.Item>
                                            </>
                                        ),
                                    },
                                ]} />
                            </Form>
                        </div>
                        {/* Live preview — updates in real-time */}
                        {configPreviewOpen && (
                            <div className="widget-config-preview">
                                <div className="widget-config-preview-header">
                                    <span style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Eye size={14} /> Xem trước realtime
                                    </span>
                                    <Button type="text" size="small" onClick={() => setConfigPreviewOpen(false)}>Ẩn</Button>
                                </div>
                                <DevicePreviewPanel form={configForm} widgetId={editingWidget?.id || editingWidget?._id || ''} />
                            </div>
                        )}
                    </div>
                )}
            </Drawer>
        </AppLayout>
    );
}
