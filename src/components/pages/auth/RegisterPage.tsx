import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { useRegister } from '@/hooks/useAuth';
import { Alert, message } from 'antd';

export default function RegisterPage() {
    const { t } = useTranslation();
    const router = useRouter();
    const { invite_token, email: inviteEmail } = router.query;
    const registerMutation = useRegister();

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: (inviteEmail as string) || '', // Pre-fill email from invite
        password: '',
        confirmPassword: '',
        terms: false
    });

    const [fullname, setFullname] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value, type, checked } = e.target;
        if (id === 'fullname') {
            setFullname(value);
            const parts = value.trim().split(' ');
            const last = parts.length > 1 ? parts.pop() : '';
            const first = parts.join(' ');
            setFormData(prev => ({ ...prev, firstName: first, lastName: last || '' }));
        } else {
            setFormData(prev => ({
                ...prev,
                [id]: type === 'checkbox' ? checked : value
            }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.password !== formData.confirmPassword) {
            return;
        }
        if (!formData.terms) return;

        try {
            await registerMutation.mutateAsync({
                email: formData.email,
                password: formData.password,
                firstName: formData.firstName || fullname,
                lastName: formData.lastName
            });

            // After successful registration, redirect based on context
            if (invite_token) {
                message.success('Account created! Joining workspace...');
                setTimeout(() => {
                    router.push(`/invites/accept?token=${invite_token}`);
                }, 1000);
            } else {
                // Normal registration flow
                router.push('/onboarding');
            }
        } catch (error) {
            // Error handled by mutation
        }
    };

    return (
        <>
            {invite_token && (
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-blue-600 text-xl">mail</span>
                        <div>
                            <p className="text-sm font-medium text-blue-900">You're creating an account for a workspace invite</p>
                            <p className="text-xs text-blue-700 mt-1">Email cannot be changed as it's tied to the invitation.</p>
                        </div>
                    </div>
                </div>
            )}
            <div className="space-y-3">
                <h1 className="text-3xl lg:text-4xl font-bold leading-tight tracking-tight text-gray-900">
                    {t('auth.register.title')}
                </h1>
                <p className="text-lg text-gray-600">
                    {t('auth.register.subtitle')} <span className="text-blue-600 font-medium">{t('auth.register.subtitleHighlight')}</span>
                </p>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span className="material-symbols-outlined text-base">group_add</span>
                    {t('auth.register.inviteNote')}
                </div>
            </div>

            <div className="bg-white border border-gray-100 shadow-xl rounded-2xl p-6 lg:p-8">
                <form onSubmit={handleSubmit} className="space-y-8">
                    {registerMutation.isError && (
                        <Alert
                            message="Error"
                            description={(registerMutation.error as any)?.message || t('message.server_error')}
                            type="error"
                            showIcon
                        />
                    )}
                    <div className="space-y-5">
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                            <span className="bg-blue-50 text-blue-600 w-5 h-5 rounded flex items-center justify-center text-[10px] border border-blue-100">1</span>
                            {t('auth.register.step1')}
                        </div>

                        <div className="grid grid-cols-1 gap-5">
                            <div>
                                <label htmlFor="fullname" className="block text-sm font-medium text-gray-600 mb-1.5">
                                    {t('auth.register.fullname')} <span className="text-gray-400 font-normal">(Optional)</span>
                                </label>
                                <input
                                    type="text"
                                    id="fullname"
                                    value={fullname}
                                    onChange={handleChange}
                                    className="bg-gray-50 border border-gray-200 text-gray-900 w-full rounded-lg px-4 py-2.5 text-base focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all placeholder:text-gray-400"
                                    placeholder={t('auth.register.fullnamePlaceholder')}
                                    disabled={registerMutation.isPending}
                                />
                            </div>
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-600 mb-1.5">
                                    {t('auth.register.email')} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    required
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="bg-gray-50 border border-gray-200 text-gray-900 w-full rounded-lg px-4 py-2.5 text-base focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all placeholder:text-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    placeholder={t('auth.register.emailPlaceholder')}
                                    disabled={!!invite_token || registerMutation.isPending}
                                />
                                <p className="mt-1.5 text-xs text-gray-500">{t('auth.register.emailNote')}</p>
                            </div>
                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-gray-600 mb-1.5">
                                    {t('auth.register.password')} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="password"
                                    id="password"
                                    required
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="bg-gray-50 border border-gray-200 text-gray-900 w-full rounded-lg px-4 py-2.5 text-base focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all placeholder:text-gray-400"
                                    placeholder={t('auth.register.passwordPlaceholder')}
                                    disabled={registerMutation.isPending}
                                />
                                {/* Password Strength Indicator */}
                                <div className="flex gap-1 mt-2 h-1">
                                    {/* Simple strength indicator based on length for now */}
                                    <div className={`flex-1 rounded-full ${formData.password.length > 0 ? 'bg-red-500/80' : 'bg-gray-200'}`}></div>
                                    <div className={`flex-1 rounded-full ${formData.password.length > 6 ? 'bg-yellow-500/80' : 'bg-gray-200'}`}></div>
                                    <div className={`flex-1 rounded-full ${formData.password.length > 8 ? 'bg-green-500/80' : 'bg-gray-200'}`}></div>
                                    <div className={`flex-1 rounded-full ${formData.password.length > 10 ? 'bg-blue-500/80' : 'bg-gray-200'}`}></div>
                                </div>
                                <p className="mt-1 text-xs text-gray-500">{t('auth.register.strength')} <span className={formData.password.length > 8 ? "text-green-500" : "text-red-500"}>{formData.password.length > 8 ? "Strong" : t('auth.register.strengthWeak')}</span></p>

                                <label htmlFor="passwordConfirm" className="block text-sm font-medium text-gray-600 mb-1.5 mt-4">
                                    {t('auth.register.passwordConfirm')} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="password"
                                    id="confirmPassword" // Changed ID to match state key
                                    required
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    className={`bg-gray-50 border ${formData.confirmPassword && formData.password !== formData.confirmPassword ? 'border-red-500' : 'border-gray-200'} text-gray-900 w-full rounded-lg px-4 py-2.5 text-base focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all placeholder:text-gray-400`}
                                    placeholder={t('auth.register.passwordConfirmPlaceholder')}
                                    disabled={registerMutation.isPending}
                                />
                                {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                                    <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                                )}
                            </div>
                        </div>

                        <div className="flex items-start gap-3 pt-2">
                            <input
                                type="checkbox"
                                id="terms"
                                required
                                checked={formData.terms}
                                onChange={handleChange}
                                className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                disabled={registerMutation.isPending}
                            />
                            <label htmlFor="terms" className="text-sm text-gray-500 cursor-pointer select-none leading-tight">
                                {t('auth.register.terms')} <Link href="#" className="text-blue-600 hover:text-blue-700 hover:underline">{t('auth.register.termsLink')}</Link> {t('common.and', { defaultValue: 'và' })} <Link href="#" className="text-blue-600 hover:text-blue-700 hover:underline">{t('auth.register.privacyLink')}</Link>
                            </label>
                        </div>
                    </div>

                    <div className="h-px bg-gray-100 w-full"></div>

                    <div className="pt-4 space-y-4">
                        <button
                            type="submit"
                            disabled={registerMutation.isPending || !formData.terms || formData.password !== formData.confirmPassword}
                            className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-base font-bold rounded-lg shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:active:scale-100 disabled:cursor-not-allowed"
                        >
                            {registerMutation.isPending ? (
                                <span>Loading...</span>
                            ) : (
                                <>
                                    <span>{t('auth.register.submit')}</span>
                                    <span className="material-symbols-outlined">arrow_forward</span>
                                </>
                            )}
                        </button>

                        <div className="relative flex py-1 items-center">
                            <div className="flex-grow border-t border-gray-100"></div>
                            <span className="flex-shrink-0 mx-4 text-xs text-gray-400">{t('auth.register.or')}</span>
                            <div className="flex-grow border-t border-gray-100"></div>
                        </div>

                        <button
                            type="button"
                            className="w-full h-12 bg-white hover:bg-gray-50 border border-gray-200 text-gray-600 font-medium rounded-lg flex items-center justify-center gap-3 transition-colors"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26-.19-.58z" fill="#FBBC05"></path>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
                            </svg>
                            {t('auth.register.google')}
                        </button>

                        <div className="text-center">
                            <p className="text-[11px] text-gray-400 flex items-center justify-center gap-1.5">
                                <span className="material-symbols-outlined text-sm">lock</span>
                                {t('auth.register.secure')}
                            </p>
                        </div>
                    </div>

                    <div className="text-center text-sm text-gray-500">
                        {t('auth.login.noAccount', { defaultValue: 'Already have an account?' })} <Link href="/auth/login" className="text-blue-600 hover:text-blue-700 hover:underline">{t('auth.login.submit')}</Link>
                    </div>
                </form>
            </div>
        </>
    );
}
