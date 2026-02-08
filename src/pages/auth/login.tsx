import { ReactElement } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import PublicLayout from '@/components/layout/PublicLayout';
import AuthLayout from '@/components/layout/AuthLayout';

// Dynamic import with SSR disabled to fix hydration mismatch
const LoginPageContent = dynamic(
  () => import('@/components/pages/auth/LoginPage'),
  { ssr: false }
);

const Login = () => {
  return (
    <>
      <Head>
        <title>Đăng nhập Nemark Inbox</title>
      </Head>
      <LoginPageContent />
    </>
  );
};

Login.getLayout = function getLayout(page: ReactElement) {
  return (
    <PublicLayout>
      <AuthLayout>{page}</AuthLayout>
    </PublicLayout>
  );
};

export default Login;
