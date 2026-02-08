import { ReactNode } from 'react';
import Header from './Header';
import Footer from './Footer';
import BottomNavBar from './BottomNavBar';

interface PublicLayoutProps {
  children: ReactNode;
  variant?: 'light' | 'dark';
}

export default function PublicLayout({ children, variant = 'light' }: PublicLayoutProps) {
  const isDark = variant === 'dark';

  return (
    <div suppressHydrationWarning className={`min-h-screen ${isDark ? 'bg-[#020617] text-white selection:bg-primary selection:text-white' : 'bg-gradient-to-br from-blue-50 via-white to-purple-50 text-gray-900'} font-display antialiased overflow-x-clip relative`}>
      {isDark && (
        <style jsx global>{`
          .glass-panel {
              background: rgba(255, 255, 255, 0.03);
              backdrop-filter: blur(12px);
              -webkit-backdrop-filter: blur(12px);
              border: 1px solid rgba(255, 255, 255, 0.08);
          }
          .glass-panel:hover {
              background: rgba(255, 255, 255, 0.06);
              border-color: rgba(13, 166, 242, 0.3);
              box-shadow: 0 0 30px rgba(13, 166, 242, 0.1);
              transform: translateY(-4px);
              transition: all 0.3s ease;
          }
          .glass-header {
              background: rgba(2, 6, 23, 0.7);
              backdrop-filter: blur(16px);
              border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          }
          .text-glow {
              text-shadow: 0 0 20px rgba(13, 166, 242, 0.5);
          }
          .btn-glow {
              box-shadow: 0 0 20px rgba(13, 166, 242, 0.4);
              transition: all 0.3s ease;
          }
          .btn-glow:hover {
              box-shadow: 0 0 30px rgba(13, 166, 242, 0.6);
              transform: translateY(-1px);
          }
          .nav-link.active {
              color: #0da6f2;
              border-left-color: #0da6f2;
              background: linear-gradient(90deg, rgba(13,166,242,0.1) 0%, transparent 100%);
          }
          /* Animation utility */
          @keyframes float {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-20px); }
          }
          .animate-float {
              animation: float 6s ease-in-out infinite;
          }
          .animate-float-delayed {
              animation: float 6s ease-in-out 3s infinite;
          }
        `}</style>
      )}

      {/* Background blobs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {isDark ? (
          <>
            <div className="absolute w-[500px] h-[500px] bg-primary/20 top-[-100px] left-[-100px] rounded-full blur-[80px] opacity-40"></div>
            <div className="absolute w-[600px] h-[600px] bg-accent-purple/10 bottom-0 right-[-100px] rounded-full blur-[80px] opacity-40"></div>
            <div className="absolute w-[400px] h-[400px] bg-accent-teal/10 top-[40%] left-[30%] rounded-full blur-[80px] opacity-40"></div>
          </>
        ) : (
          <>
            <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-electric-blue/5 rounded-full blur-[100px]"></div>
            <div className="absolute bottom-[10%] right-[-5%] w-[600px] h-[600px] bg-electric-purple/5 rounded-full blur-[120px]"></div>
            <div className="absolute top-[40%] left-[-10%] w-[400px] h-[400px] bg-electric-teal/5 rounded-full blur-[80px]"></div>
          </>
        )}
      </div>

      {/* Header */}
      <Header variant={variant} />

      {/* Main Content - add bottom padding for mobile bottom nav */}
      <main className="relative z-10 pb-20 lg:pb-0">{children}</main>

      {/* Footer */}
      <Footer variant={variant} />

      {/* Mobile Bottom Navigation Bar */}
      <BottomNavBar />
    </div>
  );
}

