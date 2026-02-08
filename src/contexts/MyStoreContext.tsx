import {
  LANGUAGE,
  SCREEN_RESPONSIVE,
} from "@/utils/enums";
import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useMemo,
  useCallback,
} from "react";
// import { Account } from "@/types/account";
// import accountApi from "@/services/account/account.api";
import { useScreenSizeObserver } from "@/hooks/useScreenSizeObserver";
import { getScreenSizeFromWidth } from "@/utils/responsive";
import { useRouter } from "next/router";
import { ProfileService } from "@/services/profile.service";
import { User } from "@/types/auth";
import { WorkspaceService } from "@/services/workspace.service";

type MyStoreType = {
  isGlobalLoading: boolean;
  setIsGlobalLoading: (loading: boolean) => void;
  user: User | null;
  setUser: (user: User | null) => void;
  // permissions: PERMISSION_TYPE[];
  // setPermissions: (permissions: PERMISSION_TYPE[]) => void;
  language: LANGUAGE;
  setLanguage: (language: LANGUAGE) => void;
  // role: ROLE_AUTH | "";
  // setRole: (n: ROLE_AUTH | "") => void;
  // statisticsProject: FundingProjectsStatisticsResponse[];
  // setStatisticsProject: (data: FundingProjectsStatisticsResponse[]) => void;
  isStoreReady: boolean;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  screenType: SCREEN_RESPONSIVE;
  screenWidth: number;
  isMobile: boolean;
  isSmallTablet: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  showSignup: boolean;
  setShowSignup: (v: boolean) => void;
  showForgot: boolean;
  isNoFooter: boolean;
  setShowForgot: (v: boolean) => void;
  setIsStoreReady: (v: boolean) => void;
  // updateUserStore: (accountData: Account) => void;
  activeWorkspace: {
    workspaceKey: number;
    workspaceId: string;
    name: string;
    membership: {
      membershipKey: number;
      membershipId: string;
      role: string;
    };
  } | null;
  setActiveWorkspace: (workspace: MyStoreType['activeWorkspace']) => void;
};

const MyStoreContext = createContext<MyStoreType | undefined>(undefined);

export const useMyStore = () => {
  const ctx = useContext(MyStoreContext);
  if (!ctx) throw new Error("useMyStore must be used within MyStoreProvider");
  return ctx;
};

export const MyStoreProvider = ({ children }: { children: ReactNode }) => {
  const [isStoreReady, setIsStoreReady] = useState<boolean>(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [showSignup, setShowSignup] = useState<boolean>(false);
  const [showForgot, setShowForgot] = useState<boolean>(false);
  const [isGlobalLoading, setIsGlobalLoading] = useState<boolean>(false);
  const [language, setLanguage] = useState<LANGUAGE>(LANGUAGE.vi); // Fixed to Vietnamese
  const [activeWorkspace, setActiveWorkspaceState] = useState<MyStoreType['activeWorkspace']>(null);

  // Wrapper for setActiveWorkspace that also persists to localStorage
  const setActiveWorkspace = useCallback((workspace: MyStoreType['activeWorkspace']) => {
    setActiveWorkspaceState(workspace);
    if (workspace) {
      localStorage.setItem('active_workspace_id', workspace.workspaceId);
    } else {
      localStorage.removeItem('active_workspace_id');
    }
  }, []);

  const { screenWidth: observedScreenWidth } = useScreenSizeObserver();
  const [screenWidth, setScreenWidth] = useState<number>(observedScreenWidth);
  const router = useRouter();
  const pathname = router.pathname;
  const isNoFooter = useMemo(() => {
    const listNoFooter = ["identify"];
    return listNoFooter.some((key) => pathname?.includes(key));
  }, [pathname]);

  useEffect(() => {
    setScreenWidth(observedScreenWidth);
  }, [observedScreenWidth]);

  const screenType = useMemo(
    () => getScreenSizeFromWidth(screenWidth),
    [screenWidth]
  );

  // const updateUserStore = (accountData: Account) => {
  //   setIsStoreReady(true);
  // };

  const { isMobile, isSmallTablet, isTablet, isDesktop } = useMemo(
    () => ({
      isMobile: screenType === SCREEN_RESPONSIVE.MOBILE,
      isSmallTablet: screenType === SCREEN_RESPONSIVE.SMALL_TABLET,
      isTablet: screenType === SCREEN_RESPONSIVE.TABLET,
      isDesktop: screenType === SCREEN_RESPONSIVE.DESKTOP,
    }),
    [screenType]
  );

  const [user, setUser] = useState<User | null>(null);

  // ... (existing code: screenWidth, etc)

  useEffect(() => {
    // Force language to Vietnamese (fixed)
    setLanguage(LANGUAGE.vi);

    const savedSidebarState = localStorage.getItem("sidebar_collapsed");
    if (savedSidebarState) {
      setSidebarCollapsed(JSON.parse(savedSidebarState));
    }

    const tokenRaw = localStorage.getItem("auth_token");
    if (tokenRaw && !user) {
      ProfileService.getProfile()
        .then((res) => {
          setUser(res);
          setIsStoreReady(true);
        })
        .catch(() => {
          setUser(null);
          setIsStoreReady(true);
        });
    } else {
      setIsStoreReady(true);
    }
  }, []);

  // Load active workspace - separate effect that re-runs when user changes (e.g., after login)
  useEffect(() => {
    // Only load workspace when user is authenticated
    if (!user) return;

    const loadWorkspace = async () => {
      try {
        const tokenRaw = localStorage.getItem('auth_token');
        if (!tokenRaw) {
          setActiveWorkspaceState(null);
          return;
        }

        const workspaces = await WorkspaceService.list();
        if (workspaces.length === 0) return;

        // Try to restore last active workspace
        const lastWorkspaceId = localStorage.getItem('active_workspace_id');
        const found = workspaces.find(w => w.workspaceId === lastWorkspaceId);
        const selected = found || workspaces[0];

        const primaryRole = (selected as any).membership?.role || 'User';

        setActiveWorkspaceState({
          workspaceKey: selected.workspaceKey,
          workspaceId: selected.workspaceId,
          name: selected.name,
          membership: {
            membershipKey: (selected as any).membership?.membershipKey || 0,
            membershipId: (selected as any).membership?.membershipId || '',
            role: primaryRole,
          },
        });
      } catch (error) {
        console.error('Failed to load workspaces:', error);
      }
    };

    loadWorkspace();
  }, [user]);

  useEffect(() => {
    localStorage.setItem("sidebar_collapsed", JSON.stringify(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const contextValue = useMemo(
    () => ({
      user,
      setUser,
      // permissions,
      // setPermissions,
      // role,
      // setRole,
      language,
      setLanguage,
      // statisticsProject,
      // setStatisticsProject,
      isGlobalLoading,
      setIsGlobalLoading,
      isStoreReady,
      setIsStoreReady,
      isNoFooter,
      sidebarCollapsed,
      setSidebarCollapsed,
      showSignup,
      setShowSignup,
      showForgot,
      setShowForgot,
      screenType,
      screenWidth,
      isMobile,
      isSmallTablet,
      isTablet,
      isDesktop,
      activeWorkspace,
      setActiveWorkspace,
      // updateUserStore,
    }),
    [
      user,
      // permissions,
      // role,
      language,
      // statisticsProject,
      isGlobalLoading,
      isStoreReady,
      sidebarCollapsed,
      showSignup,
      showForgot,
      screenType,
      screenWidth,
      isMobile,
      isSmallTablet,
      isTablet,
      isDesktop,
      isNoFooter,
      activeWorkspace,
      setActiveWorkspace,
      setUser
    ]
  );

  return (
    <MyStoreContext.Provider value={contextValue}>
      {children}
    </MyStoreContext.Provider>
  );
};
