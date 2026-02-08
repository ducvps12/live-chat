import React, { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';

interface AuthLayoutProps {
    children: ReactNode;
    rightContent?: ReactNode;
}

export default function AuthLayout({ children, rightContent }: AuthLayoutProps) {
    const { t } = useTranslation();

    return (
        <div className="w-full max-w-7xl mx-auto px-6 pt-24 pb-20 lg:pt-32 lg:pb-24 transition-colors">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">

                {/* Main Content (Left) */}
                <div className="lg:col-span-7 flex flex-col gap-8 animate-fade-in-up">
                    {children}
                </div>

                {/* Right Content (Visuals) */}
                <div className="hidden lg:block lg:col-span-5 sticky top-28">
                    {rightContent || <DefaultRightContent />}
                </div>

            </div>
        </div>
    );
}

function DefaultRightContent() {
    const { t } = useTranslation();
    return (
        <>
            <div className="relative w-full aspect-[4/3] bg-white/60 dark:bg-neutral-800/60 backdrop-blur-xl border border-white/20 dark:border-neutral-700/30 rounded-2xl mb-8 overflow-hidden flex flex-col items-center justify-center p-8 shadow-xl transition-colors">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-purple-50/50 opacity-50"></div>
                <div className="relative z-10 w-full flex items-center justify-between gap-2">

                    {/* Website Icon */}
                    <div className="flex flex-col items-center gap-3 relative z-10">
                        <div className="size-16 rounded-xl bg-white border border-gray-200 flex items-center justify-center shadow-lg">
                            <span className="material-symbols-outlined text-2xl text-gray-400">language</span>
                        </div>
                        <span className="text-xs font-bold text-gray-500">{t('auth.features.website')}</span>
                    </div>

                    {/* Connection Line 1 */}
                    <div className="flex-1 h-0.5 bg-gray-200 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary to-transparent w-1/2 animate-beam-flow-pause"></div>
                    </div>

                    {/* Inbox Icon (Central) */}
                    <div className="flex flex-col items-center gap-3 relative z-20 scale-110">
                        <div className="relative size-20 rounded-2xl bg-white border border-primary/20 flex items-center justify-center shadow-[0_8px_30px_rgba(13,166,242,0.15)]">
                            <span className="material-symbols-outlined text-4xl text-primary">chat_bubble</span>
                            <div className="absolute -top-1.5 -right-1.5 size-4 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>
                        </div>
                        <span className="text-sm font-bold text-primary">{t('auth.features.inbox')}</span>
                    </div>

                    {/* Connection Line 2 */}
                    <div className="flex-1 h-0.5 bg-gray-200 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary to-transparent w-1/2 animate-beam-flow-pause [animation-delay:0.9s]"></div>
                    </div>

                    {/* Lead Icon */}
                    <div className="flex flex-col items-center gap-3 relative z-10">
                        <div className="size-16 rounded-xl bg-white border border-gray-200 flex items-center justify-center shadow-lg">
                            <span className="material-symbols-outlined text-2xl text-gray-400">person_check</span>
                        </div>
                        <span className="text-xs font-bold text-gray-500">{t('auth.features.lead')}</span>
                    </div>
                </div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-primary/5 blur-[50px] rounded-full z-0"></div>
            </div>

            {/* Feature Highlights */}
            <div className="space-y-6 mb-8 px-2">
                <div className="flex gap-4 group">
                    <div className="mt-0.5 size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 group-hover:bg-primary/20 transition-colors">
                        <span className="material-symbols-outlined text-primary text-sm">bolt</span>
                    </div>
                    <div>
                        <h3 className="text-gray-900 font-bold text-sm">{t('auth.features.capture.title')}</h3>
                        <p className="text-gray-500 text-sm mt-0.5">{t('auth.features.capture.desc')}</p>
                    </div>
                </div>
                <div className="flex gap-4 group">
                    <div className="mt-0.5 size-8 rounded-full bg-accent-purple/10 flex items-center justify-center shrink-0 border border-accent-purple/20 group-hover:bg-accent-purple/20 transition-colors">
                        <span className="material-symbols-outlined text-accent-purple text-sm">inbox_customize</span>
                    </div>
                    <div>
                        <h3 className="text-gray-900 font-bold text-sm">{t('auth.features.missed.title')}</h3>
                        <p className="text-gray-500 text-sm mt-0.5">{t('auth.features.missed.desc')}</p>
                    </div>
                </div>
                <div className="flex gap-4 group">
                    <div className="mt-0.5 size-8 rounded-full bg-accent-teal/10 flex items-center justify-center shrink-0 border border-accent-teal/20 group-hover:bg-accent-teal/20 transition-colors">
                        <span className="material-symbols-outlined text-accent-teal text-sm">analytics</span>
                    </div>
                    <div>
                        <h3 className="text-gray-900 font-bold text-sm">{t('auth.features.sla.title')}</h3>
                        <p className="text-gray-500 text-sm mt-0.5">{t('auth.features.sla.desc')}</p>
                    </div>
                </div>
            </div>

            {/* Small Stats Footer */}
            <div className="border-t border-gray-200 pt-6">
                <div className="flex items-center justify-between text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                    <div className="flex flex-col items-center gap-2">
                        <span className="material-symbols-outlined text-xl text-gray-300">admin_panel_settings</span>
                        {t('auth.features.footer.rbac')}
                    </div>
                    <div className="h-8 w-px bg-gray-200"></div>
                    <div className="flex flex-col items-center gap-2">
                        <span className="material-symbols-outlined text-xl text-gray-300">history</span>
                        {t('auth.features.footer.audit')}
                    </div>
                    <div className="h-8 w-px bg-gray-200"></div>
                    <div className="flex flex-col items-center gap-2">
                        <span className="material-symbols-outlined text-xl text-gray-300">cloud_done</span>
                        {t('auth.features.footer.uptime')}
                    </div>
                </div>
            </div>
        </>
    );
}
