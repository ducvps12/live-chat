import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useResendVerification } from '@/hooks/useAuth';
import { Alert, Button } from 'antd';
import { MailOutlined } from '@ant-design/icons';

interface EmailVerificationBannerProps {
    user: {
        EmailVerified: boolean;
        Email: string;
    } | null;
}

export default function EmailVerificationBanner({ user }: EmailVerificationBannerProps) {
    const { mutate: resend, isPending } = useResendVerification();
    const [dismissed, setDismissed] = useState(false);
    const [canResend, setCanResend] = useState(true);
    const [countdown, setCountdown] = useState(0);
    const router = useRouter();

    // Reset dismissed state when user changes
    useEffect(() => {
        setDismissed(false);
    }, [user]);

    // Countdown timer
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => {
                setCountdown(countdown - 1);
            }, 1000);
            return () => clearTimeout(timer);
        } else if (countdown === 0 && !canResend) {
            setCanResend(true);
        }
    }, [countdown, canResend]);

    const handleResend = () => {
        if (!user) return;

        resend({ email: user.Email }, {
            onSuccess: () => {
                // Start 60s countdown
                setCanResend(false);
                setCountdown(60);
            }
        });
    };

    if (!user || user.EmailVerified || dismissed) {
        return null;
    }

    return (
        <div className="sticky top-0 z-50">
            <Alert
                message="⚠️ Email chưa được xác thực"
                description={
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <span>
                            Vui lòng xác thực email <strong>{user.Email}</strong> để sử dụng đầy đủ tính năng
                            (invite members, create widgets, etc.)
                        </span>
                        <div className="flex gap-2">
                            <Button
                                size="small"
                                icon={<MailOutlined />}
                                onClick={handleResend}
                                loading={isPending}
                                disabled={!canResend || isPending}
                            >
                                {isPending
                                    ? 'Đang gửi...'
                                    : canResend
                                        ? 'Gửi lại'
                                        : `Chờ ${countdown}s`}
                            </Button>
                        </div>
                    </div>
                }
                type="warning"
                closable
                onClose={() => setDismissed(true)}
                showIcon
                className="rounded-none border-x-0 border-t-0"
            />
        </div>
    );
}
