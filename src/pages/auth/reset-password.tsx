import { ReactElement } from 'react';
import Head from 'next/head';
import AuthLayout from '@/components/layout/AuthLayout';
import PublicLayout from '@/components/layout/PublicLayout';
import ResetPasswordPageContent from '@/components/pages/auth/ResetPasswordPage';

const ResetPassword = () => {
  return (
    <>
      <Head>
        <title>Đặt lại mật khẩu - Nemark Inbox</title>
      </Head>
      <ResetPasswordPageContent />
    </>
  );
};

ResetPassword.getLayout = function getLayout(page: ReactElement) {
  return (
    <PublicLayout>
        <AuthLayout>{page}</AuthLayout>
    </PublicLayout>
  );
};

export default ResetPassword;
