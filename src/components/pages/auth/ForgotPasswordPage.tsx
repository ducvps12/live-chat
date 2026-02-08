import React, { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { AuthService } from '@/services/auth.service';
import { Alert, message } from 'antd';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  
  const forgotPasswordMutation = useMutation({
    mutationFn: (email: string) => AuthService.forgotPassword({ email }),
    onSuccess: () => {
        message.success('Liên kết đặt lại mật khẩu đã được gửi đến email của bạn.');
        // Optionally redirect or show success state
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    forgotPasswordMutation.mutate(email);
  };

  return (
    <>
      <div className="space-y-3">
        <h1 className="text-3xl lg:text-4xl font-bold leading-tight tracking-tight text-gray-900">
            {t('auth.login.forgotPassword')}
        </h1>
        <p className="text-lg text-gray-600">
             Nhập email của bạn để nhận liên kết đặt lại mật khẩu.
        </p>
      </div>

      <div className="bg-white border border-gray-100 shadow-xl rounded-2xl p-6 lg:p-8">
        <form onSubmit={handleSubmit} className="space-y-8">
            {forgotPasswordMutation.isError && (
                <Alert 
                    message="Error" 
                    description={(forgotPasswordMutation.error as Error)?.message || t('message.server_error')} 
                    type="error" 
                    showIcon 
                />
            )}
            <div className="space-y-5">
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-600 mb-1.5">
                        {t('auth.login.email')}
                    </label>
                    <input 
                        type="email" 
                        id="email" 
                        required 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="bg-gray-50 border border-gray-200 text-gray-900 w-full rounded-lg px-4 py-2.5 text-base focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all placeholder:text-gray-400"
                        placeholder={t('auth.register.emailPlaceholder')}
                        disabled={forgotPasswordMutation.isPending}
                    />
                </div>
            </div>

            <div className="pt-4 space-y-4">
                <button 
                    type="submit" 
                    disabled={forgotPasswordMutation.isPending}
                    className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-base font-bold rounded-lg shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:active:scale-100 disabled:cursor-not-allowed"
                >
                    {forgotPasswordMutation.isPending ? (
                        <span>Loading...</span>
                    ) : (
                        <>
                            <span>Gửi liên kết</span>
                            <span className="material-symbols-outlined">send</span>
                        </>
                    )}
                </button>
            </div>

            <div className="text-center text-sm text-gray-500">
                <Link href="/auth/login" className="flex items-center justify-center gap-2 text-gray-500 hover:text-blue-600 transition-colors">
                    <span className="material-symbols-outlined text-sm">arrow_back</span>
                    Quay lại đăng nhập
                </Link>
            </div>
        </form>
      </div>
    </>
  );
}
