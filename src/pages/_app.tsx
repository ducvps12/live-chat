import type { AppProps } from "next/app";
import AppQueryProvider from "../providers/QueryProvider";
import "../styles/globals.css";

export default function App({ Component, pageProps }: AppProps) {
    return (
        <AppQueryProvider>
            <Component {...pageProps} />
        </AppQueryProvider>
    );
}
