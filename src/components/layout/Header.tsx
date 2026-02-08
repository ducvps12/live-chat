'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useState, useCallback, useEffect } from 'react';

interface HeaderProps {
  variant?: 'light' | 'dark';
}

export default function Header({ variant = 'light' }: HeaderProps) {
  const { t } = useTranslation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isDark = variant === 'dark';

  // Close menu on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileMenuOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobileMenuOpen]);

  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(prev => !prev);
  }, []);

  const closeMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false);
  }, []);

  const headerClass = isDark
    ? "fixed top-0 w-full z-50 glass-header transition-all duration-300 border-b border-white/5 bg-[#020617]/70 backdrop-blur-md"
    : "fixed top-0 w-full z-50 glass-panel-heavy transition-all duration-300 border-b-2 border-gray-300";

  const textClass = isDark ? "text-white" : "text-gray-900";
  const descTextClass = isDark ? "text-slate-400" : "text-gray-600";
  const navLinkClass = isDark
    ? "text-sm font-medium text-slate-300 hover:text-white transition-colors"
    : "text-sm font-medium text-gray-800 hover:text-gray-950 transition-colors font-semibold";
  const secondaryBtnClass = isDark
    ? "hidden xl:block text-xs font-medium text-white hover:bg-white/5 transition-colors px-3 py-2 rounded-full border border-white/10"
    : "hidden xl:block text-xs font-medium text-gray-700 hover:text-electric-blue transition-colors px-3 py-2 rounded-full border-2 border-gray-300 hover:border-electric-blue/50 font-semibold";

  // Mobile menu styles
  const mobileNavLinkClass = isDark
    ? "flex items-center gap-3 px-4 py-3 text-base font-medium text-slate-200 hover:text-white hover:bg-white/5 rounded-xl transition-all"
    : "flex items-center gap-3 px-4 py-3 text-base font-medium text-gray-700 hover:text-electric-blue hover:bg-electric-blue/5 rounded-xl transition-all";

  return (
    <>
      <header className={headerClass}>
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          {/* Mobile Hamburger Button */}
          <button
            onClick={toggleMobileMenu}
            className={`lg:hidden flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-gray-100 text-gray-700'
              }`}
            aria-label="Toggle menu"
            aria-expanded={isMobileMenuOpen}
          >
            <span className="material-symbols-outlined text-2xl">
              {isMobileMenuOpen ? 'close' : 'menu'}
            </span>
          </button>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 cursor-pointer group" onClick={closeMobileMenu}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isDark ? 'bg-primary/10 border border-primary/20' : 'bg-electric-blue/10 border border-electric-blue/30 group-hover:bg-electric-blue/20'}`}>
              <span className={`material-symbols-outlined ${isDark ? 'text-primary' : 'text-electric-blue'}`}>
                all_inclusive
              </span>
            </div>
            <span className={`font-display font-bold text-xl tracking-tight ${textClass}`}>
              {t('landing.header.logo')}
              <span className={`font-light ${descTextClass}`}>
                {t('landing.header.logoSuffix')}
              </span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-8">
            <Link href="/product" className={`relative ${navLinkClass} ${isDark ? "hover:text-primary after:content-[''] after:absolute after:-bottom-6 after:left-0 after:w-full after:h-0.5 after:bg-primary after:shadow-[0_0_10px_#0da6f2]" : ""}`}>
              {t('landing.header.nav.product')}
            </Link>
            <Link href="/solutions" className={navLinkClass}>
              {t('landing.header.nav.solutions')}
            </Link>
            <Link href="/customers" className={navLinkClass}>
              Khách hàng
            </Link>
            <Link href="/pricing" className={navLinkClass}>
              {t('landing.header.nav.pricing')}
            </Link>
            <Link href="/security" className={navLinkClass}>
              Bảo mật
            </Link>
            <Link href="/legal" className={navLinkClass}>
              Pháp lý
            </Link>
          </nav>

          {/* CTA Buttons */}
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/auth/login"
              className={`hidden md:block text-sm font-medium transition-colors font-semibold ${isDark ? 'text-slate-300 hover:text-white' : 'text-gray-800 hover:text-gray-950'}`}
            >
              {t('landing.header.login')}
            </Link>
            <Link
              href="/demo"
              className={secondaryBtnClass}
            >
              {t('landing.header.demo')}
            </Link>
            <Link href="/auth/register" className={`relative group overflow-hidden rounded-full text-white px-4 sm:px-6 py-2 sm:py-2.5 font-bold text-xs sm:text-sm transition-all hover:shadow-lg ${isDark ? 'bg-primary hover:bg-[#0b93d6] btn-glow' : 'bg-electric-blue hover:shadow-electric-blue/30'}`}>
              <span className="relative z-10">{t('landing.header.cta')}</span>
              {!isDark && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500"></div>}
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        onClick={closeMobileMenu}
        aria-hidden="true"
      />

      {/* Mobile Sidebar Drawer - thatim.vn style */}
      <nav
        className={`fixed top-0 left-0 z-50 h-full w-[280px] transform transition-transform duration-300 ease-out lg:hidden overflow-hidden ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
        aria-label="Mobile navigation"
        style={{
          background: 'linear-gradient(180deg, #1a1212 0%, #2a1f1f 50%, #1f1818 100%)',
        }}
      >
        {/* Decorative gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-900/10 via-transparent to-rose-900/10 pointer-events-none" />

        {/* Sidebar Header */}
        <div className="relative flex items-center justify-between px-4 h-16 border-b border-white/10">
          <Link href="/" className="flex items-center gap-3" onClick={closeMobileMenu}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <span className="material-symbols-outlined text-white text-xl">
                all_inclusive
              </span>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-white text-lg tracking-tight">
                {t('landing.header.logo')}
              </span>
              <span className="text-[10px] text-amber-400/80 uppercase tracking-widest">
                Live Chat Platform
              </span>
            </div>
          </Link>
          <button
            onClick={closeMobileMenu}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all"
            aria-label="Close menu"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Scrollable Navigation */}
        <div className="relative flex-1 overflow-y-auto custom-scrollbar" style={{ height: 'calc(100% - 64px - 140px)' }}>
          {/* Main Navigation Section */}
          <div className="p-4">
            <div className="text-[10px] font-bold text-amber-400/60 uppercase tracking-widest mb-3 px-2">
              Khám phá
            </div>
            <div className="flex flex-col gap-1">
              <Link href="/" className="flex items-center gap-3 px-3 py-2.5 text-white/90 hover:text-white hover:bg-white/5 rounded-xl transition-all group" onClick={closeMobileMenu}>
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center group-hover:from-blue-500/30 group-hover:to-blue-600/30 transition-all">
                  <span className="material-symbols-outlined text-lg text-blue-400">home</span>
                </div>
                <span className="font-medium">Trang chủ</span>
              </Link>
              <Link href="/product" className="flex items-center gap-3 px-3 py-2.5 text-white/90 hover:text-white hover:bg-white/5 rounded-xl transition-all group" onClick={closeMobileMenu}>
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-600/20 flex items-center justify-center group-hover:from-purple-500/30 group-hover:to-purple-600/30 transition-all">
                  <span className="material-symbols-outlined text-lg text-purple-400">inventory_2</span>
                </div>
                <span className="font-medium">{t('landing.header.nav.product')}</span>
              </Link>
              <Link href="/solutions" className="flex items-center gap-3 px-3 py-2.5 text-white/90 hover:text-white hover:bg-white/5 rounded-xl transition-all group" onClick={closeMobileMenu}>
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-500/20 to-teal-600/20 flex items-center justify-center group-hover:from-teal-500/30 group-hover:to-teal-600/30 transition-all">
                  <span className="material-symbols-outlined text-lg text-teal-400">lightbulb</span>
                </div>
                <span className="font-medium">{t('landing.header.nav.solutions')}</span>
              </Link>
              <Link href="/demo" className="flex items-center gap-3 px-3 py-2.5 text-white/90 hover:text-white hover:bg-white/5 rounded-xl transition-all group" onClick={closeMobileMenu}>
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-500/20 to-green-600/20 flex items-center justify-center group-hover:from-green-500/30 group-hover:to-green-600/30 transition-all">
                  <span className="material-symbols-outlined text-lg text-green-400">play_circle</span>
                </div>
                <span className="font-medium">Xem Demo</span>
                <span className="ml-auto px-2 py-0.5 text-[10px] font-bold bg-green-500/20 text-green-400 rounded-full">LIVE</span>
              </Link>
            </div>
          </div>

          {/* Pricing Section */}
          <div className="px-4 pb-4">
            <div className="text-[10px] font-bold text-amber-400/60 uppercase tracking-widest mb-3 px-2">
              Dịch vụ
            </div>
            <div className="flex flex-col gap-1">
              <Link href="/pricing" className="flex items-center gap-3 px-3 py-2.5 text-white/90 hover:text-white hover:bg-white/5 rounded-xl transition-all group" onClick={closeMobileMenu}>
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/20 flex items-center justify-center group-hover:from-amber-500/30 group-hover:to-amber-600/30 transition-all">
                  <span className="material-symbols-outlined text-lg text-amber-400">payments</span>
                </div>
                <span className="font-medium">{t('landing.header.nav.pricing')}</span>
              </Link>
              <Link href="/customers" className="flex items-center gap-3 px-3 py-2.5 text-white/90 hover:text-white hover:bg-white/5 rounded-xl transition-all group" onClick={closeMobileMenu}>
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-pink-500/20 to-pink-600/20 flex items-center justify-center group-hover:from-pink-500/30 group-hover:to-pink-600/30 transition-all">
                  <span className="material-symbols-outlined text-lg text-pink-400">groups</span>
                </div>
                <span className="font-medium">Khách hàng</span>
              </Link>
            </div>
          </div>

          {/* Support Section */}
          <div className="px-4 pb-4">
            <div className="text-[10px] font-bold text-amber-400/60 uppercase tracking-widest mb-3 px-2">
              Hỗ trợ
            </div>
            <div className="flex flex-col gap-1">
              <Link href="/security" className="flex items-center gap-3 px-3 py-2.5 text-white/90 hover:text-white hover:bg-white/5 rounded-xl transition-all group" onClick={closeMobileMenu}>
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-500/20 to-red-600/20 flex items-center justify-center group-hover:from-red-500/30 group-hover:to-red-600/30 transition-all">
                  <span className="material-symbols-outlined text-lg text-red-400">shield</span>
                </div>
                <span className="font-medium">Bảo mật</span>
              </Link>
              <Link href="/legal" className="flex items-center gap-3 px-3 py-2.5 text-white/90 hover:text-white hover:bg-white/5 rounded-xl transition-all group" onClick={closeMobileMenu}>
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-slate-500/20 to-slate-600/20 flex items-center justify-center group-hover:from-slate-500/30 group-hover:to-slate-600/30 transition-all">
                  <span className="material-symbols-outlined text-lg text-slate-400">gavel</span>
                </div>
                <span className="font-medium">Pháp lý</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10 bg-gradient-to-t from-black/20 to-transparent">
          <div className="flex flex-col gap-2">
            <Link
              href="/auth/login"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white/90 border border-white/20 hover:bg-white/5 hover:border-white/30 transition-all"
              onClick={closeMobileMenu}
            >
              <span className="material-symbols-outlined text-lg">login</span>
              {t('landing.header.login')}
            </Link>
            <Link
              href="/auth/register"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white transition-all shadow-lg"
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)',
              }}
              onClick={closeMobileMenu}
            >
              <span className="material-symbols-outlined text-lg">rocket_launch</span>
              {t('landing.header.cta')}
            </Link>
          </div>
        </div>
      </nav>
    </>
  );
}

