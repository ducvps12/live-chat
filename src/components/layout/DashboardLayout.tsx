import React, { ReactNode, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { CommandPalette } from '@/components/common/CommandPalette';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { useNotifications } from '@/contexts/NotificationContext';
import { formatRelativeTime } from '@/utils/date';

interface DashboardLayoutProps {
  children: ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<'online' | 'away' | 'offline'>('online');
  const userMenuRef = useRef<HTMLDivElement>(null);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const { logout, user } = useAuth();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const profile = user?.data?.user; // ProfileData.user contains the User object

  // Helper to check active route
  const isActive = (href: string) => {
    if (href === '/workspace/dashboard') return router.pathname === '/workspace/dashboard';
    return router.pathname.startsWith(href);
  };

  // Handle outside click for user menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (statusMenuRef.current && !statusMenuRef.current.contains(event.target as Node)) {
        setIsStatusMenuOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle ⌘K / Ctrl+K for command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="bg-neutral-50 dark:bg-neutral-900 font-sans text-neutral-900 dark:text-neutral-100 overflow-hidden h-screen flex flex-col lg:flex-row transition-colors duration-300">
      {/* Mobile Header - Only visible on mobile */}
      <header className="lg:hidden sticky top-0 z-30 h-14 bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between px-4 flex-shrink-0 transition-colors">
        {/* Hamburger Menu */}
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 -ml-2 text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
          aria-label="Open menu"
        >
          <span className="material-symbols-outlined text-[24px]">menu</span>
        </button>

        {/* Logo */}
        <Link href="/workspace/dashboard" className="flex items-center">
          <img src="/logo.jpg" alt="Logo" className="h-8 w-auto object-contain" />
        </Link>

        {/* User Avatar */}
        <button
          className="w-8 h-8 rounded-full bg-neutral-800 text-white flex items-center justify-center text-xs font-bold uppercase"
          onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
        >
          {profile?.DisplayName?.substring(0, 2) || profile?.Email?.substring(0, 2) || 'SA'}
        </button>
      </header>

      {/* Mobile Sidebar Drawer */}
      {isMobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden animate-fade-in"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Drawer Panel */}
          <aside className="fixed left-0 top-0 h-full w-64 bg-white dark:bg-neutral-800 z-50 shadow-xl animate-slide-in-left lg:hidden flex flex-col transition-colors">
            {/* Drawer Header with close button */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-neutral-100 flex-shrink-0">
              <Link href="/workspace/dashboard" onClick={() => setIsMobileMenuOpen(false)}>
                <img src="/logo.jpg" alt="Logo" className="h-10 object-contain" />
              </Link>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 text-neutral-500 hover:bg-neutral-100 rounded-lg transition-colors"
                aria-label="Close menu"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Mobile Navigation */}
            <nav className="flex-1 overflow-y-auto py-4 space-y-5">
              {/* Overview Section */}
              <div>
                <h3 className="px-6 text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Overview</h3>
                <div className="space-y-0.5">
                  <NavItem
                    href="/workspace/dashboard"
                    icon="grid_view"
                    label="Dashboard"
                    active={isActive('/workspace/dashboard')}
                    collapsed={false}
                    onClick={() => setIsMobileMenuOpen(false)}
                  />
                </div>
              </div>

              {/* Communications Section */}
              <div>
                <h3 className="px-6 text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Communications</h3>
                <div className="space-y-0.5">
                  <NavItem
                    href="/workspace/inbox"
                    icon="inbox"
                    label="Inbox"
                    active={isActive('/workspace/inbox')}
                    collapsed={false}
                    badge={unreadCount > 0 ? unreadCount : undefined}
                    onClick={() => setIsMobileMenuOpen(false)}
                  />
                  <NavItem
                    href="/workspace/kanban"
                    icon="view_kanban"
                    label="Kanban"
                    active={isActive('/workspace/kanban')}
                    collapsed={false}
                    onClick={() => setIsMobileMenuOpen(false)}
                  />
                </div>
              </div>

              {/* Management Section */}
              <div>
                <h3 className="px-6 text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Management</h3>
                <div className="space-y-0.5">
                  <NavItem
                    href="/workspace/teams"
                    icon="groups"
                    label="Teams & Agents"
                    active={isActive('/workspace/teams')}
                    collapsed={false}
                    onClick={() => setIsMobileMenuOpen(false)}
                  />
                  <NavItem
                    href="/workspace/settings"
                    icon="extension"
                    label="Integrations"
                    active={isActive('/workspace/settings/facebook') || isActive('/workspace/settings/zalo')}
                    collapsed={false}
                    onClick={() => setIsMobileMenuOpen(false)}
                  />
                </div>
              </div>

              {/* System Section */}
              <div>
                <h3 className="px-6 text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">System</h3>
                <div className="space-y-0.5">
                  <NavItem
                    href="/workspace/workspaces"
                    icon="business"
                    label="Workspaces"
                    active={isActive('/workspace/workspaces')}
                    collapsed={false}
                    onClick={() => setIsMobileMenuOpen(false)}
                  />
                  <NavItem
                    href="/workspace/settings"
                    icon="settings"
                    label="Settings"
                    active={isActive('/workspace/settings')}
                    collapsed={false}
                    onClick={() => setIsMobileMenuOpen(false)}
                  />
                </div>
              </div>
            </nav>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-neutral-200">
              <div className="text-xs text-neutral-400 text-center">v2.4.0</div>
            </div>
          </aside>
        </>
      )}

      {/* Desktop Sidebar - Hidden on mobile */}
      <aside
        className={`hidden lg:flex bg-white dark:bg-neutral-800 border-r border-neutral-200 dark:border-neutral-700 flex-col flex-shrink-0 z-20 transition-all duration-300 ease-in-out ${collapsed ? 'w-[80px]' : 'w-[240px]'
          }`}
      >
        <Link href="/workspace/dashboard" className={`h-16 flex items-center border-b border-neutral-100 ${collapsed ? 'justify-center px-0' : 'px-6'}`}>
          <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap">
            <img
              src="/logo.jpg"
              alt="Nemark Logo"
              className={`object-contain flex-shrink-0 ${collapsed ? 'w-10 h-10' : 'h-10'}`}
            />
          </div>
        </Link>

        <nav className="flex-1 overflow-y-auto py-4 space-y-5">
          {/* Overview Section */}
          <div>
            <h3 className={`px-6 text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2 ${collapsed ? 'hidden' : 'block'}`}>Overview</h3>
            <div className="space-y-0.5">
              <NavItem
                href="/workspace/dashboard"
                icon="grid_view"
                label="Dashboard"
                active={isActive('/workspace/dashboard')}
                collapsed={collapsed}
              />
            </div>
          </div>

          {/* Communications Section */}
          <div>
            <h3 className={`px-6 text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2 ${collapsed ? 'hidden' : 'block'}`}>Communications</h3>
            <div className="space-y-0.5">
              <NavItem
                href="/workspace/inbox"
                icon="inbox"
                label="Inbox"
                active={isActive('/workspace/inbox')}
                collapsed={collapsed}
                badge={unreadCount > 0 ? unreadCount : undefined}
              />
              <NavItem
                href="/workspace/kanban"
                icon="view_kanban"
                label="Kanban"
                active={isActive('/workspace/kanban')}
                collapsed={collapsed}
              />
            </div>
          </div>

          {/* Management Section */}
          <div>
            <h3 className={`px-6 text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2 ${collapsed ? 'hidden' : 'block'}`}>Management</h3>
            <div className="space-y-0.5">
              <NavItem
                href="/workspace/teams"
                icon="groups"
                label="Teams & Agents"
                active={isActive('/workspace/teams')}
                collapsed={collapsed}
              />
              <NavItem
                href="/workspace/settings"
                icon="extension"
                label="Integrations"
                active={isActive('/workspace/settings/facebook') || isActive('/workspace/settings/zalo')}
                collapsed={collapsed}
              />
            </div>
          </div>

          {/* System Section */}
          <div>
            <h3 className={`px-6 text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2 ${collapsed ? 'hidden' : 'block'}`}>System</h3>
            <div className="space-y-0.5">
              <NavItem
                href="/workspace/workspaces"
                icon="business"
                label="Workspaces"
                active={isActive('/workspace/workspaces')}
                collapsed={collapsed}
              />
              <NavItem
                href="/workspace/settings"
                icon="settings"
                label="Settings"
                active={isActive('/workspace/settings')}
                collapsed={collapsed}
              />
            </div>
          </div>
        </nav>

        {/* Sidebar Footer / Toggle */}
        <div className="p-4 border-t border-neutral-200 flex flex-col gap-2">
          {!collapsed && (
            <div className="text-xs text-neutral-400 text-center whitespace-nowrap overflow-hidden">
              v2.4.0
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-full py-2 hover:bg-neutral-50 text-neutral-500 rounded-lg transition-colors"
            title={collapsed ? t('sidebar.expandSidebar') : t('sidebar.collapseSidebar')}
          >
            <span className="material-symbols-outlined text-[20px]">
              {collapsed ? 'keyboard_double_arrow_right' : 'keyboard_double_arrow_left'}
            </span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-full overflow-hidden relative min-w-0">
        {/* Desktop Header - Hidden on mobile (mobile has its own header) */}
        <header className="hidden lg:flex h-14 bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 items-center justify-between px-4 flex-shrink-0 z-20 transition-colors">
          <div className="flex items-center w-[280px]">
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200 border ${isUserMenuOpen ? 'bg-neutral-50 dark:bg-neutral-700 border-neutral-200 dark:border-neutral-600' : 'border-transparent hover:bg-neutral-50 dark:hover:bg-neutral-700 hover:border-neutral-200 dark:hover:border-neutral-600'}`}
              >
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center text-xs font-bold uppercase shadow-sm">
                  {profile?.DisplayName?.substring(0, 2) || profile?.Email?.substring(0, 2) || 'SA'}
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold text-neutral-900 dark:text-neutral-100 leading-none max-w-[120px] truncate">
                    {profile?.DisplayName || `${profile?.FirstName || ''} ${profile?.LastName || ''}`.trim() || 'Support Team A'}
                  </div>
                  <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">Admin Role</div>
                </div>
                <span className="material-symbols-outlined text-neutral-400 text-[18px] ml-1">
                  {isUserMenuOpen ? 'flag' : 'unfold_more'}
                </span>
              </button>

              {/* User Dropdown */}
              {isUserMenuOpen && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl py-1 z-50 animate-fade-scale">
                  <div className="px-4 py-2 border-b border-neutral-100">
                    <p className="text-sm font-medium text-neutral-900">{profile?.Email || 'admin@example.com'}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">Administrator</p>
                  </div>

                  <div className="py-1">
                    <Link
                      href="/profile"
                      className="flex items-center gap-2 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <span className="material-symbols-outlined text-[18px]">person</span>
                      {t('common.profile', 'Profile')}
                    </Link>
                    <Link
                      href="/workspace/settings"
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors text-left"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <span className="material-symbols-outlined text-[18px]">settings</span>
                      {t('common.settings', 'Settings')}
                    </Link>
                  </div>

                  <div className="border-t border-neutral-100 py-1">
                    <button
                      onClick={() => logout.mutate()}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-[18px]">logout</span>
                      {t('common.logout', 'Logout')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex-1 max-w-xl px-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-neutral-400 text-[20px]">search</span>
              </div>
              <input className="block w-full pl-10 pr-3 py-1.5 border border-neutral-200 dark:border-neutral-600 rounded-lg leading-5 bg-neutral-50 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:bg-white dark:focus:bg-neutral-600 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 sm:text-sm transition-all shadow-sm" placeholder="Search conversations, contacts, messages..." type="text" />
              <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
                <span className="text-[10px] text-neutral-400 border border-neutral-200 rounded px-1.5 py-0.5 bg-white">⌘K</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative" ref={statusMenuRef}>
              <button
                onClick={() => setIsStatusMenuOpen(!isStatusMenuOpen)}
                className="flex items-center gap-2 px-2.5 py-1.5 bg-white dark:bg-neutral-700 rounded-full border border-neutral-200 dark:border-neutral-600 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-600 transition-all duration-200 shadow-sm"
              >
                <div className={`w-2 h-2 rounded-full ${currentStatus === 'online' ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)] animate-pulse' :
                  currentStatus === 'away' ? 'bg-yellow-500 shadow-[0_0_6px_rgba(234,179,8,0.5)]' : 'bg-neutral-400'
                  }`}></div>
                <span className="text-xs font-semibold text-neutral-700">
                  {currentStatus === 'online' ? 'Online' : currentStatus === 'away' ? 'Away' : 'Offline'}
                </span>
                <span className="material-symbols-outlined text-neutral-400 text-[16px]">
                  {isStatusMenuOpen ? 'expand_less' : 'expand_more'}
                </span>
              </button>

              {isStatusMenuOpen && (
                <div className="absolute top-full right-0 mt-1 w-40 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 z-50">
                  <button
                    onClick={() => { setCurrentStatus('online'); setIsStatusMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-neutral-50"
                  >
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    Online
                  </button>
                  <button
                    onClick={() => { setCurrentStatus('away'); setIsStatusMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-neutral-50"
                  >
                    <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                    Away
                  </button>
                  <button
                    onClick={() => { setCurrentStatus('offline'); setIsStatusMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-neutral-50"
                  >
                    <div className="w-2 h-2 rounded-full bg-neutral-400"></div>
                    Offline
                  </button>
                </div>
              )}
            </div>
            <div className="h-6 w-[1px] bg-neutral-200 dark:bg-neutral-600 mx-1"></div>
            <ThemeToggle />
            <div className="h-6 w-[1px] bg-neutral-200 dark:bg-neutral-600 mx-1"></div>
            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                className="relative p-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-[22px]">notifications</span>
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                )}
              </button>

              {isNotificationOpen && (
                <div className="absolute top-full right-0 mt-1 w-80 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl z-50 animate-fade-scale">
                  <div className="p-3 border-b border-neutral-100 flex items-center justify-between">
                    <h3 className="font-semibold text-neutral-900">Thông báo</h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => markAllRead()}
                        className="text-xs text-primary-600 hover:underline"
                      >
                        Đánh dấu đã đọc
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-neutral-400">
                        <span className="material-symbols-outlined text-3xl mb-2 block">notifications_off</span>
                        <p className="text-sm">Không có thông báo mới</p>
                      </div>
                    ) : (
                      notifications.map((notif) => {
                        const getIcon = () => {
                          switch (notif.type) {
                            case 'new_message': return { icon: 'chat', bg: 'bg-blue-100', color: 'text-blue-600' };
                            case 'new_conversation': return { icon: 'forum', bg: 'bg-green-100', color: 'text-green-600' };
                            case 'mention': return { icon: 'alternate_email', bg: 'bg-orange-100', color: 'text-orange-600' };
                            default: return { icon: 'info', bg: 'bg-neutral-100', color: 'text-neutral-600' };
                          }
                        };
                        const { icon, bg, color } = getIcon();

                        return (
                          <div
                            key={notif.id}
                            onClick={() => markRead(notif.id)}
                            className={`p-3 hover:bg-neutral-50 cursor-pointer ${!notif.read ? 'border-l-2 border-primary-500 bg-primary-50/30' : ''}`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`w-8 h-8 rounded-full ${bg} flex items-center justify-center`}>
                                <span className={`material-symbols-outlined ${color} text-sm`}>{icon}</span>
                              </div>
                              <div className="flex-1">
                                <p className="text-sm text-neutral-900">
                                  {notif.title}: <strong>{notif.visitorName || 'Khách'}</strong>
                                </p>
                                <p className="text-xs text-neutral-600 truncate">{notif.body}</p>
                                <p className="text-xs text-neutral-500 mt-0.5">{formatRelativeTime(notif.createdAt)}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  {notifications.length > 0 && (
                    <div className="p-2 border-t border-neutral-100 text-center">
                      <button className="text-sm text-primary-600 hover:underline">Xem tất cả thông báo</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-neutral-50 dark:bg-neutral-900 p-4 sm:p-6 lg:p-8 scroll-smooth min-w-0 transition-colors">
          {children}
        </main>
      </div>

      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
    </div>
  );
};

interface NavItemProps {
  href: string;
  icon: string;
  label: string;
  active?: boolean;
  collapsed?: boolean;
  badge?: number;
  onClick?: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ href, icon, label, active, collapsed, badge, onClick }) => {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`relative flex items-center gap-3 py-2.5 transition-all duration-200 group ${collapsed ? 'justify-center px-0' : 'px-6'
        } ${active
          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium'
          : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 hover:text-neutral-900 dark:hover:text-neutral-200 hover:translate-x-0.5'
        }`}
      title={collapsed ? label : undefined}
    >
      {active && (
        <span className="absolute left-0 top-1 bottom-1 w-[3px] bg-gradient-to-b from-blue-500 to-blue-600 rounded-r-full shadow-[2px_0_8px_rgba(59,130,246,0.3)]"></span>
      )}
      <span className={`material-symbols-outlined text-[20px] transition-colors duration-200 ${active ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-600 dark:group-hover:text-neutral-300'
        }`}
        style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
      >
        {icon}
      </span>
      {!collapsed && (
        <>
          <span className="whitespace-nowrap flex-1 text-[13px]">{label}</span>
          {badge && (
            <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center animate-bounce-in shadow-sm shadow-blue-500/30">
              {badge}
            </span>
          )}
        </>
      )}
    </Link>
  );
};
