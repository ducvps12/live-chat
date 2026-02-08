import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useVerifyEmail } from '@/hooks/useAuth';
import { Spin, Result, Button } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons';

export default function VerifyEmailPage() {
    const router = useRouter();
    const { token } = router.query;
    const { mutate: verifyEmail, isPending, isSuccess, isError, error } = useVerifyEmail();
    const [verificationAttempted, setVerificationAttempted] = useState(false);

    useEffect(() => {
        if (token && !verificationAttempted && typeof token === 'string') {
            setVerificationAttempted(true);
            verifyEmail({ token });
        }
    }, [token, verifyEmail, verificationAttempted]);

    if (!token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="max-w-md w-full">
                    <Result
                        status="error"
                        title="Token không hợp lệ"
                        subTitle="Link xác thực không hợp lệ hoặc đã hết hạn."
                        extra={
                            <Button type="primary" onClick={() => router.push('/auth/login')}>
                                Về trang đăng nhập
                            </Button>
                        }
                    />
                </div>
            </div>
        );
    }

    if (isPending) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <Spin indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />
                    <p className="mt-4 text-gray-600 font-medium">Đang xác thực email...</p>
                </div>
            </div>
        );
    }

    if (isSuccess) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="max-w-md w-full">
                    <Result
                        icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                        title="Xác thực thành công!"
                        subTitle="Email của bạn đã được xác thực. Bạn có thể đăng nhập ngay bây giờ."
                        extra={
                            <Button type="primary" size="large" onClick={() => router.push('/auth/login')}>
                                Đăng nhập
                            </Button>
                        }
                    />
                </div>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="max-w-md w-full">
                    <Result
                        icon={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
                        title="Xác thực thất bại"
                        subTitle={(error as any)?.response?.data?.message || 'Link xác thực không hợp lệ hoặc đã hết hạn.'}
                        extra={[
                            <Button key="login" onClick={() => router.push('/auth/login')}>
                                Về trang đăng nhập
                            </Button>,
                            <Button key="resend" type="primary" onClick={() => router.push('/auth/resend-verification')}>
                                Gửi lại email xác thực
                            </Button>,
                        ]}
                    />
                </div>
            </div>
        );
    }

    return null;
}
