// pages/_app.tsx
import "../styles/globals.css";
import "../i18n";
import type { AppProps } from "next/app";
import type { ReactElement, ReactNode } from "react";
import type { NextPage } from "next";
import { MyStoreProvider, useMyStore } from "@/contexts/MyStoreContext";

import Head from "next/head";
import { Toaster } from "sonner";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/react-query";
import { useEffect } from "react";
import i18n from "@/i18n";
import { PageTransition } from "@/components/common/PageTransition";
import { DbStatusBanner } from "@/components/common/DbStatusBanner";

export type NextPageWithLayout<P = object, IP = P> = NextPage<P, IP> & {
  getLayout?: (page: ReactElement) => ReactNode;
};

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout;
};

import { I18nextProvider } from "react-i18next";

export default function App({ Component, pageProps, router }: AppPropsWithLayout) {
  // Use the layout defined at the page level, if available
  const getLayout = Component.getLayout ?? ((page) => page);

  // Theme initialization — apply dark class before first paint
  useEffect(() => {
    try {
      const saved = localStorage.getItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (saved === 'dark' || (!saved && prefersDark)) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) { }
  }, []);

  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <MyStoreProvider>
          <Head>
            <title>Live Chat</title>
          </Head>
          <MyAppContent
            Component={Component}
            pageProps={pageProps}
            router={router}
            getLayout={getLayout}
          />
        </MyStoreProvider>
      </QueryClientProvider>
    </I18nextProvider>
  );
}

import { useAuthRedirect } from "@/hooks/useAuth";
import { useWorkspaceRouting } from "@/hooks/useWorkspaceRouting";

function MyAppContent({ Component, pageProps, getLayout }: AppPropsWithLayout & { getLayout: (page: ReactElement) => ReactNode }) {
  const { language } = useMyStore();
  useAuthRedirect();
  useWorkspaceRouting(); // Auto-redirect based on workspace status

  useEffect(() => {
    i18n.changeLanguage(language);
    if (typeof window !== "undefined") {
      localStorage.setItem("language", language);
    }
  }, [language]);

  return (
    <>
      <DbStatusBanner />
      <Toaster position="top-right" richColors closeButton />
      <PageTransition style="slide" duration={400}>
        {getLayout(<Component {...pageProps} />)}
      </PageTransition>
    </>
  );
}

