import { ReactElement } from 'react';
import Head from 'next/head';
import PublicLayout from '@/components/layout/PublicLayout';
import AuthLayout from '@/components/layout/AuthLayout';
import RegisterPageContent from '@/components/pages/auth/RegisterPage';

const Register = () => {
  return (
    <>
      <Head>
        <title>Đăng ký Nemark Inbox - Tạo Workspace</title>
      </Head>
      <RegisterPageContent />
    </>
  );
};

Register.getLayout = function getLayout(page: ReactElement) {
  return (
    <PublicLayout>
        <AuthLayout>{page}</AuthLayout>
    </PublicLayout>
  );
};

export default Register;
