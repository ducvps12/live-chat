import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { useLogin } from '@/hooks/useAuth';
import { Alert } from 'antd';

export default function LoginPage() {
    const { t } = useTranslation();
    const router = useRouter();
    const { redirect } = router.query;
    const loginMutation = useLogin();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [focusedField, setFocusedField] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            await loginMutation.mutateAsync({ email, password });

            if (redirect) {
                router.push(decodeURIComponent(redirect as string));
            } else {
                router.push('/workspace/dashboard');
            }
        } catch (error) {
            // Error handled by mutation
        }
    };

    return (
        <>
            {redirect && redirect.toString().includes('invites/accept') && (
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl animate-fade-in-up">
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                            <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-lg">mail</span>
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">Login to accept your workspace invite</p>
                            <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">After login, you'll be automatically redirected to join the workspace.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="space-y-3 animate-fade-in-up">
                <h1 className="text-3xl lg:text-4xl font-bold leading-tight tracking-tight text-gray-900 dark:text-white">
                    {t('auth.login.title')}
                </h1>
                <p className="text-lg text-gray-500 dark:text-gray-400">
                    {t('auth.login.subtitle')}
                </p>
            </div>

            {/* Login Card */}
            <div className="bg-white dark:bg-neutral-800 border border-gray-100 dark:border-neutral-700 shadow-xl dark:shadow-2xl dark:shadow-black/20 rounded-2xl p-6 lg:p-8 animate-fade-in-up-delay-1 transition-colors">
                <form onSubmit={handleSubmit} className="space-y-7">
                    {loginMutation.isError && (
                        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl animate-fade-scale">
                            <span className="material-symbols-outlined text-red-500 text-xl mt-0.5">error</span>
                            <div>
                                <p className="text-sm font-medium text-red-800 dark:text-red-300">Đăng nhập thất bại</p>
                                <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                                    {(loginMutation.error as any)?.message || t('message.server_error')}
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="space-y-5">
                        {/* Email Field */}
                        <div className="space-y-1.5">
                            <label htmlFor="email" className={`block text-sm font-medium transition-colors duration-200 ${focusedField === 'email' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                {t('auth.login.email')}
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <span className={`material-symbols-outlined text-[18px] transition-colors duration-200 ${focusedField === 'email' ? 'text-blue-500' : 'text-gray-400'}`}>
                                        mail
                                    </span>
                                </div>
                                <input
                                    type="email"
                                    id="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    onFocus={() => setFocusedField('email')}
                                    onBlur={() => setFocusedField(null)}
                                    className="bg-gray-50 dark:bg-neutral-700/50 border border-gray-200 dark:border-neutral-600 text-gray-900 dark:text-white w-full rounded-xl pl-10 pr-4 py-3 text-base focus:bg-white dark:focus:bg-neutral-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all duration-200 placeholder:text-gray-400 dark:placeholder:text-neutral-500"
                                    placeholder={t('auth.register.emailPlaceholder')}
                                    disabled={loginMutation.isPending}
                                />
                            </div>
                        </div>

                        {/* Password Field */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label htmlFor="password" className={`block text-sm font-medium transition-colors duration-200 ${focusedField === 'password' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                    {t('auth.login.password')}
                                </label>
                                <Link href="/auth/forgot-password" className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:underline transition-colors font-medium">
                                    {t('auth.login.forgotPassword')}
                                </Link>
                            </div>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <span className={`material-symbols-outlined text-[18px] transition-colors duration-200 ${focusedField === 'password' ? 'text-blue-500' : 'text-gray-400'}`}>
                                        lock
                                    </span>
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    id="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    onFocus={() => setFocusedField('password')}
                                    onBlur={() => setFocusedField(null)}
                                    className="bg-gray-50 dark:bg-neutral-700/50 border border-gray-200 dark:border-neutral-600 text-gray-900 dark:text-white w-full rounded-xl pl-10 pr-12 py-3 text-base focus:bg-white dark:focus:bg-neutral-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all duration-200 placeholder:text-gray-400 dark:placeholder:text-neutral-500"
                                    placeholder="••••••••"
                                    disabled={loginMutation.isPending}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-neutral-600"
                                    tabIndex={-1}
                                >
                                    <span className="material-symbols-outlined text-lg">
                                        {showPassword ? 'visibility_off' : 'visibility'}
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="pt-2 space-y-4">
                        {/* Submit Button — gradient with shimmer */}
                        <button
                            type="submit"
                            disabled={loginMutation.isPending}
                            className="relative w-full h-12 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 disabled:from-blue-400 disabled:to-blue-300 text-white text-base font-bold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 flex items-center justify-center gap-2 transition-all duration-300 active:scale-[0.98] disabled:active:scale-100 disabled:cursor-not-allowed overflow-hidden group"
                        >
                            {/* Shimmer effect */}
                            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                            {loginMutation.isPending ? (
                                <div className="flex items-center gap-2">
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    <span>Đang đăng nhập...</span>
                                </div>
                            ) : (
                                <>
                                    <span className="relative z-10">{t('auth.login.submit')}</span>
                                    <span className="material-symbols-outlined relative z-10 text-xl group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
                                </>
                            )}
                        </button>

                        {/* Divider */}
                        <div className="relative flex py-1 items-center">
                            <div className="flex-grow border-t border-gray-200 dark:border-neutral-700"></div>
                            <span className="flex-shrink-0 mx-4 text-xs text-gray-400 dark:text-neutral-500 font-medium">{t('auth.register.or')}</span>
                            <div className="flex-grow border-t border-gray-200 dark:border-neutral-700"></div>
                        </div>

                        {/* Google Login */}
                        <button
                            type="button"
                            onClick={() => {
                                const apiBase = process.env.NEXT_PUBLIC_API_URL_BASE || 'http://localhost:4000';
                                window.location.href = `${apiBase}/api/auth/google`;
                            }}
                            className="w-full h-12 bg-white dark:bg-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-600 border border-gray-200 dark:border-neutral-600 text-gray-700 dark:text-neutral-200 font-medium rounded-xl flex items-center justify-center gap-3 transition-all duration-200 hover:shadow-md hover:scale-[1.01] active:scale-[0.99]"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26-.19-.58z" fill="#FBBC05"></path>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
                            </svg>
                            {t('auth.register.google')}
                        </button>
                    </div>

                    <div className="text-center text-sm text-gray-500 dark:text-neutral-400">
                        {t('auth.login.noAccount')} <Link href="/auth/register" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 font-semibold hover:underline transition-colors">{t('auth.login.registerLink')}</Link>
                    </div>
                </form>
            </div>
        </>
    );
}
