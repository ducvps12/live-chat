import { useState, useEffect } from 'react';
import { Button } from 'antd';

interface ResendVerificationButtonProps {
    email: string;
    resendVerification: (data: { email: string }) => void;
    resending: boolean;
}

const COOLDOWN_SECONDS = 60; // 1 minute cooldown

export const ResendVerificationButton: React.FC<ResendVerificationButtonProps> = ({
    email,
    resendVerification,
    resending,
}) => {
    const [cooldown, setCooldown] = useState(0);
    const [lastSentTime, setLastSentTime] = useState<number | null>(null);

    // Load last sent time from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem('email_verification_last_sent');
        if (stored) {
            const timestamp = parseInt(stored, 10);
            const elapsed = Math.floor((Date.now() - timestamp) / 1000);
            const remaining = COOLDOWN_SECONDS - elapsed;

            if (remaining > 0) {
                setCooldown(remaining);
                setLastSentTime(timestamp);
            }
        }
    }, []);

    // Countdown timer
    useEffect(() => {
        if (cooldown > 0) {
            const timer = setTimeout(() => {
                setCooldown(cooldown - 1);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [cooldown]);

    const handleClick = () => {
        if (cooldown > 0 || resending) return;

        // Send verification email
        resendVerification({ email });

        // Set cooldown
        const now = Date.now();
        setLastSentTime(now);
        setCooldown(COOLDOWN_SECONDS);
        localStorage.setItem('email_verification_last_sent', now.toString());
    };

    const isDisabled = cooldown > 0 || resending;

    return (
        <Button
            type="link"
            size="small"
            onClick={handleClick}
            loading={resending}
            disabled={isDisabled}
            className="px-0"
        >
            {cooldown > 0 ? (
                <>⏳ Vui lòng đợi {cooldown}s</>
            ) : (
                <>Gửi lại email xác thực</>
            )}
        </Button>
    );
};
