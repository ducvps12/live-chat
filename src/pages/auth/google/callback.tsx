import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';

export default function GoogleCallbackPage() {
    const router = useRouter();
    const { loginWithTokens } = useAuth();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handleCallback = async () => {
            const { accessToken, refreshToken, error: errorParam, message } = router.query;

            if (errorParam) {
                setError(message as string || 'Google authentication failed');
                setTimeout(() => {
                    router.push('/auth/login?error=google_auth_failed');
                }, 3000);
                return;
            }

            if (accessToken && refreshToken) {
                try {
                    // Store tokens and redirect
                    await loginWithTokens(accessToken as string, refreshToken as string);
                    router.push('/workspace/inbox');
                } catch (err: any) {
                    setError(err.message || 'Failed to complete login');
                    setTimeout(() => {
                        router.push('/auth/login?error=token_error');
                    }, 3000);
                }
            }
        };

        if (router.isReady) {
            handleCallback();
        }
    }, [router.isReady, router.query]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-50">
            <div className="text-center">
                {error ? (
                    <div className="space-y-4">
                        <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                            <span className="material-symbols-outlined text-red-600 text-3xl">error</span>
                        </div>
                        <h1 className="text-xl font-semibold text-neutral-900">Authentication Failed</h1>
                        <p className="text-neutral-500">{error}</p>
                        <p className="text-sm text-neutral-400">Redirecting to login...</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="w-16 h-16 mx-auto">
                            <svg className="animate-spin h-16 w-16 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        </div>
                        <h1 className="text-xl font-semibold text-neutral-900">Signing you in...</h1>
                        <p className="text-neutral-500">Please wait while we complete your login</p>
                    </div>
                )}
            </div>
        </div>
    );
}
