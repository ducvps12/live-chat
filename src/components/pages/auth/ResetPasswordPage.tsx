import React, { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/router';
import { useResetPassword } from '@/hooks/useAuth';
import { Alert } from 'antd';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token } = router.query;
  const resetPassword = useResetPassword();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) return; // Add error state logic
    
    resetPassword.mutate({
        token: token as string,
        newPassword: password,
        confirmPassword: confirmPassword
    });
  };

  return (
    <>
      <div className="space-y-3">
        <h1 className="text-3xl lg:text-4xl font-bold leading-tight tracking-tight text-gray-900">
            Đặt lại mật khẩu
        </h1>
        <p className="text-lg text-gray-600">
             Nhập mật khẩu mới của bạn.
        </p>
      </div>

      <div className="bg-white border border-gray-100 shadow-xl rounded-2xl p-6 lg:p-8">
        <form onSubmit={handleSubmit} className="space-y-8">
            {resetPassword.isError && (
                <Alert 
                    message="Error" 
                    description={(resetPassword.error as any)?.message || t('message.server_error')} 
                    type="error" 
                    showIcon 
                />
            )}
            <div className="space-y-5">
                <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-600 mb-1.5">
                        Mật khẩu mới
                    </label>
                    <input 
                        type="password" 
                        id="password" 
                        required 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="bg-gray-50 border border-gray-200 text-gray-900 w-full rounded-lg px-4 py-2.5 text-base focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all placeholder:text-gray-400"
                        placeholder="••••••••"
                        disabled={resetPassword.isPending}
                    />
                </div>
                <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-600 mb-1.5">
                        Xác nhận mật khẩu
                    </label>
                    <input 
                        type="password" 
                        id="confirmPassword" 
                        required 
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="bg-gray-50 border border-gray-200 text-gray-900 w-full rounded-lg px-4 py-2.5 text-base focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all placeholder:text-gray-400"
                        placeholder="••••••••"
                        disabled={resetPassword.isPending}
                    />
                </div>
            </div>

            <div className="pt-4 space-y-4">
                <button 
                    type="submit" 
                    disabled={resetPassword.isPending || password !== confirmPassword}
                    className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-base font-bold rounded-lg shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:active:scale-100 disabled:cursor-not-allowed"
                >
                    {resetPassword.isPending ? (
                        <span>Loading...</span>
                    ) : (
                        <>
                            <span>Đặt lại mật khẩu</span>
                            <span className="material-symbols-outlined">check_circle</span>
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
