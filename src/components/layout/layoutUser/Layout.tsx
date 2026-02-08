import { ReactNode } from "react";
import Header from "./Header";
import Footer from "./Footer";

interface LayoutProps {
    children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
    return (
        <div className="flex flex-col bg-gray-100 min-h-screen">
            <Header />
            <main className="grow container mx-auto p-4 max-w-325 ld:px-0 px-4 md:px-12 bg-[url('/assets/img/bg_our_services.png')]">
                {children}
            </main>
            <Footer />

        </div>
    );
};

export default Layout;
