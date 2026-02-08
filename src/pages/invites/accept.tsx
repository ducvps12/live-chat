import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Button, Card, Result, Spin, message } from 'antd';
import api from '@/lib/http';
import { useMyStore } from '@/contexts/MyStoreContext';

interface InviteInfo {
    email: string;
    workspaceName: string;
    role: string;
    expiresAt: string;
    userExists: boolean;
    requiresLogin: boolean;
    requiresRegistration: boolean;
}

const AcceptInvitePage = () => {
    const router = useRouter();
    const { token } = router.query;
    const { user, isStoreReady } = useMyStore();

    const [status, setStatus] = useState<'validating' | 'redirecting' | 'processing' | 'success' | 'error'>('validating');
    const [errorMsg, setErrorMsg] = useState('');
    const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
    const [hasAttemptedRedirect, setHasAttemptedRedirect] = useState(false);

    // Step 1: Validate token when page loads
    useEffect(() => {
        if (!router.isReady) return;

        if (!token) {
            setStatus('error');
            setErrorMsg('Invalid invite link (missing token)');
            return;
        }

        validateInvite(token as string);
    }, [router.isReady, token]);

    // Step 2: After validation, check auth status and handle flow
    useEffect(() => {
        if (!inviteInfo || status !== 'validating') return;

        console.log('[AcceptInvite] Checking auth state:', { isStoreReady, user: user?.Email, hasAttemptedRedirect });

        // Wait for store to be ready (user auth state loaded)
        if (!isStoreReady) return;

        // Skip if we've already attempted redirect (prevents infinite loop)
        const fromLogin = router.query.from_login === 'true';
        if (hasAttemptedRedirect || fromLogin) {
            console.log('[AcceptInvite] Redirect already attempted (state or query). User is logged in:', !!user);
            if (!user && isStoreReady) {
                // Loop detected!
                setStatus('error');
                setErrorMsg('Authentication seems to be stuck. Please try refreshing the page or login manually.');
                return;
            }
            if (fromLogin && user) {
                // We came from login and have user, so we can proceed to auth flow (which handles user case)
            } else {
                // If hasAttemptedRedirect is true, we stop.
                if (hasAttemptedRedirect) return;
            }
        }

        handleAuthFlow();
    }, [inviteInfo, user, hasAttemptedRedirect, isStoreReady, router.query]);

    const validateInvite = async (inviteToken: string) => {
        try {
            const res = await api.get(`/workspaces/invites/validate/${inviteToken}`);
            const info = res.data?.data as InviteInfo;

            setInviteInfo(info);
        } catch (error: any) {
            setStatus('error');
            setErrorMsg(error.response?.data?.message || 'Invalid or expired invite');
        }
    };

    const handleAuthFlow = () => {
        if (!inviteInfo) return;

        // Case 1: User is logged in
        if (user) {
            // Check if email matches
            if (user.Email?.toLowerCase() !== inviteInfo.email.toLowerCase()) {
                setStatus('error');
                setErrorMsg(`This invite is for ${inviteInfo.email}. Please logout and login with the correct account.`);
                return;
            }

            // Email matches, accept invite automatically
            acceptInvite();
            return;
        }

        // Case 2: User not logged in - redirect to auth (only once)
        setHasAttemptedRedirect(true);
        setStatus('redirecting');

        if (inviteInfo.requiresLogin) {
            // User exists but not logged in -> redirect to login
            message.info('Please login to accept the invite');
            setTimeout(() => {
                router.push(`/auth/login?redirect=${encodeURIComponent(router.asPath)}`);
            }, 1500);
        } else {
            // User doesn't exist -> redirect to register
            message.info('Please create an account to join the workspace');
            setTimeout(() => {
                router.push(`/auth/register?invite_token=${token}&email=${encodeURIComponent(inviteInfo.email)}`);
            }, 1500);
        }
    };

    const acceptInvite = async () => {
        setStatus('processing');
        try {
            const res = await api.post('/workspaces/invites/accept', { token });

            const result = res.data?.data;
            message.success(`Joined ${result?.workspaceName || 'workspace'} successfully!`);
            setStatus('success');

            // Redirect to dashboard
            setTimeout(() => {
                router.push('/workspace/dashboard');
            }, 2000);
        } catch (error: any) {
            // Check for 409 (Already Member)
            if (error.response?.status === 409 && error.response?.data?.message?.includes('already a member')) {
                message.success("You are already a member of this workspace.");
                setStatus('success'); // Show success UI
                setTimeout(() => {
                    router.push('/workspace/dashboard');
                }, 2000);
                return;
            }

            setStatus('error');
            setErrorMsg(error.response?.data?.message || 'Failed to accept invite');
        }
    };

    // UI States
    if (status === 'validating') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <Spin size="large" />
                    <p className="mt-4 text-gray-500">Verifying invite...</p>
                </div>
            </div>
        );
    }

    if (status === 'redirecting') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <Card className="w-full max-w-md shadow-lg rounded-xl">
                    <div className="text-center py-8">
                        <Spin size="large" />
                        <h3 className="mt-4 text-lg font-semibold text-gray-900">
                            {inviteInfo?.requiresLogin ? 'Redirecting to Login...' : 'Redirecting to Registration...'}
                        </h3>
                        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                            <p className="text-sm text-blue-700">
                                <span className="font-medium">Workspace:</span> {inviteInfo?.workspaceName}
                            </p>
                            <p className="text-sm text-blue-700 mt-1">
                                <span className="font-medium">Role:</span> {inviteInfo?.role}
                            </p>
                            <p className="text-sm text-blue-700 mt-1">
                                <span className="font-medium">Email:</span> {inviteInfo?.email}
                            </p>
                        </div>
                    </div>
                </Card>
            </div>
        );
    }

    if (status === 'processing') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <Spin size="large" />
                    <p className="mt-4 text-gray-500">Joining workspace...</p>
                </div>
            </div>
        );
    }

    if (status === 'success') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <Card className="w-full max-w-md shadow-lg rounded-xl">
                    <Result
                        status="success"
                        title="Welcome to the Workspace!"
                        subTitle={`You have successfully joined ${inviteInfo?.workspaceName || 'the workspace'} as ${inviteInfo?.role}. Redirecting to dashboard...`}
                        extra={[
                            <Button type="primary" key="dashboard" onClick={() => router.push('/workspace/dashboard')}>
                                Go to Dashboard Now
                            </Button>,
                        ]}
                    />
                </Card>
            </div>
        );
    }

    // Error state
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <Card className="w-full max-w-md shadow-lg rounded-xl">
                <Result
                    status="error"
                    title="Invitation Failed"
                    subTitle={errorMsg || "The invite link may be invalid or expired."}
                    extra={[
                        <Button type="primary" key="login" onClick={() => router.push('/auth/login')}>
                            Go to Login
                        </Button>,
                        <Button key="home" onClick={() => router.push('/')}>
                            Back Home
                        </Button>
                    ]}
                />
            </Card>
        </div>
    );
};

export default AcceptInvitePage;
