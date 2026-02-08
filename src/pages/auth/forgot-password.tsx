import { ReactElement } from 'react';
import Head from 'next/head';
import AuthLayout from '@/components/layout/AuthLayout';
import ForgotPasswordPageContent from '@/components/pages/auth/ForgotPasswordPage';
import PublicLayout from '@/components/layout/PublicLayout';

const ForgotPassword = () => {
  return (
    <>
      <Head>
        <title>Quên mật khẩu - Nemark Inbox</title>
      </Head>
      <ForgotPasswordPageContent />
    </>
  );
};

ForgotPassword.getLayout = function getLayout(page: ReactElement) {
  return (
    <PublicLayout>
        <AuthLayout>{page}</AuthLayout>
    </PublicLayout>
  );
};

export default ForgotPassword;
