import Link from 'next/link';

interface FooterProps {
  variant?: 'light' | 'dark';
}

export default function Footer({ variant = 'light' }: FooterProps) {
  const isDark = variant === 'dark';

  const footerBg = isDark ? "bg-[#01030d] border-t border-white/5" : "bg-gray-100 border-t-2 border-gray-300";
  const titleColor = isDark ? "text-white" : "text-gray-900";
  const textColor = isDark ? "text-slate-500" : "text-gray-700";
  const hoverColor = isDark ? "hover:text-primary" : "hover:text-electric-blue";

  return (
    <footer className={`${footerBg} py-16 text-sm transition-colors`}>
      <div className="max-w-[1280px] mx-auto px-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-10 mb-16">
        {/* Company Info */}
        <div className="col-span-2 lg:col-span-2">
          <div className="flex items-center gap-2 mb-6">
            <div className={`size-6 flex items-center justify-center rounded border ${isDark ? 'text-primary bg-primary/10 border-primary/20' : 'text-electric-blue bg-electric-blue/10 border-electric-blue/30'}`}>
              <span className="material-symbols-outlined text-sm">all_inclusive</span>
            </div>
            <span className={`text-lg font-bold ${titleColor}`}>Nemark Inbox</span>
          </div>
          <p className={`${textColor} max-w-xs mb-6 font-medium`}>
            Giải pháp Live Chat thế hệ mới cho doanh nghiệp hiện đại. Kết nối với khách hàng mọi lúc, mọi nơi.
          </p>
          <div className="flex gap-4">
            <a
              href="https://facebook.com/nemarkinbox"
              target="_blank"
              rel="noopener noreferrer"
              className={`${textColor} ${hoverColor} transition-colors`}
              title="Facebook"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            </a>
            <a
              href="mailto:support@mtdvps.com"
              className={`${textColor} ${hoverColor} transition-colors`}
              title="Email: support@mtdvps.com"
            >
              <span className="material-symbols-outlined">mail</span>
            </a>
            <a
              href="https://zalo.me/nemarkinbox"
              target="_blank"
              rel="noopener noreferrer"
              className={`${textColor} ${hoverColor} transition-colors`}
              title="Zalo"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 48 48">
                <path d="M24 4C12.954 4 4 12.954 4 24s8.954 20 20 20 20-8.954 20-20S35.046 4 24 4zm8.983 26.724c-.694.99-1.743 2.188-2.847 2.847-.69.412-1.482.619-2.376.619-1.252 0-2.628-.378-4.104-1.134-2.628-1.346-5.256-3.598-7.389-6.336-1.505-1.93-2.661-3.938-3.442-5.978-.781-2.04-1.008-3.876-.676-5.464.166-.794.496-1.49.991-2.088.495-.598 1.089-1.008 1.783-1.23.347-.111.694-.167 1.041-.167.495 0 .891.111 1.188.333.297.222.545.545.744.969l1.733 3.764c.199.421.297.793.297 1.116 0 .446-.173.867-.52 1.263l-.892 1.04c-.074.074-.111.173-.111.297 0 .124.037.248.111.372.074.124.173.248.297.372.842 1.165 1.808 2.156 2.898 2.972 1.09.816 2.279 1.46 3.567 1.931.248.099.446.148.595.148.198 0 .372-.074.52-.223l.893-1.04c.347-.396.768-.595 1.263-.595.322 0 .694.099 1.116.297l3.764 1.733c.421.199.744.446.967.744.223.297.334.694.334 1.189 0 .347-.056.694-.167 1.041-.222.694-.632 1.288-1.23 1.783z" />
              </svg>
            </a>
          </div>
        </div>

        {/* Product Links */}
        <div>
          <h4 className={`${titleColor} font-bold mb-4`}>Sản phẩm</h4>
          <ul className={`space-y-2 ${textColor} font-medium`}>
            <li><Link href="/product" className={`transition-colors ${hoverColor}`}>Live Chat</Link></li>
            <li><Link href="/product#inbox" className={`transition-colors ${hoverColor}`}>Inbox thống nhất</Link></li>
            <li><Link href="/product#analytics" className={`transition-colors ${hoverColor}`}>Phân tích & Báo cáo</Link></li>
            <li><Link href="/product#integrations" className={`transition-colors ${hoverColor}`}>Tích hợp API</Link></li>
          </ul>
        </div>

        {/* Resources Links */}
        <div>
          <h4 className={`${titleColor} font-bold mb-4`}>Tài nguyên</h4>
          <ul className={`space-y-2 ${textColor} font-medium`}>
            <li><Link href="/docs" className={`transition-colors ${hoverColor}`}>Tài liệu hướng dẫn</Link></li>
            <li><Link href="/docs/api" className={`transition-colors ${hoverColor}`}>API Documentation</Link></li>
            <li><a href="https://status.mtdvps.com" target="_blank" rel="noopener noreferrer" className={`transition-colors ${hoverColor}`}>Trạng thái hệ thống</a></li>
            <li><Link href="/pricing" className={`transition-colors ${hoverColor}`}>Bảng giá</Link></li>
          </ul>
        </div>

        {/* Company Links */}
        <div>
          <h4 className={`${titleColor} font-bold mb-4`}>Công ty</h4>
          <ul className={`space-y-2 ${textColor} font-medium`}>
            <li><Link href="/about" className={`transition-colors ${hoverColor}`}>Về chúng tôi</Link></li>
            <li><a href="mailto:support@mtdvps.com" className={`transition-colors ${hoverColor}`}>Liên hệ</a></li>
            <li><Link href="/careers" className={`transition-colors ${hoverColor}`}>Tuyển dụng</Link></li>
            <li><Link href="/legal" className={`transition-colors ${hoverColor}`}>Pháp lý</Link></li>
          </ul>
        </div>
      </div>

      {/* Contact Info */}
      <div className={`max-w-[1280px] mx-auto px-6 pb-8`}>
        <div className={`p-6 rounded-xl ${isDark ? 'bg-white/5' : 'bg-white'} border ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
          <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
            <div>
              <h5 className={`${titleColor} font-bold mb-2`}>Cần hỗ trợ?</h5>
              <p className={`${textColor} text-sm`}>Đội ngũ hỗ trợ của chúng tôi sẵn sàng giúp đỡ bạn 24/7</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="mailto:support@mtdvps.com"
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${isDark
                  ? 'bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20'
                  : 'bg-electric-blue/10 text-electric-blue hover:bg-electric-blue/20 border border-electric-blue/20'
                  }`}
              >
                <span className="material-symbols-outlined text-lg">mail</span>
                support@mtdvps.com
              </a>
              <a
                href="tel:+84123456789"
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${isDark
                  ? 'bg-white/5 text-white hover:bg-white/10 border border-white/10'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                  }`}
              >
                <span className="material-symbols-outlined text-lg">call</span>
                Hotline 24/7
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className={`max-w-[1280px] mx-auto px-6 pt-8 border-t ${isDark ? 'border-white/5' : 'border-gray-300'} flex flex-col md:flex-row justify-between items-center gap-4 text-xs ${textColor}`}>
        <p>© {new Date().getFullYear()} Nemark Inbox by MTDVPS. All rights reserved.</p>
        <div className="flex gap-6">
          <Link href="/legal/terms-of-service" className={`${hoverColor} transition-colors`}>Điều khoản</Link>
          <Link href="/legal/privacy-policy" className={`${hoverColor} transition-colors`}>Bảo mật</Link>
          <Link href="/legal/cookie-policy" className={`${hoverColor} transition-colors`}>Cookies</Link>
        </div>
      </div>
    </footer>
  );
}
