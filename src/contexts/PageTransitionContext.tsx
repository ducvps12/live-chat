import { createContext, useContext, useState, ReactNode } from 'react';

export type TransitionStyle = 'slide' | 'fade' | 'circle' | 'none';

interface PageTransitionContextType {
    transitionStyle: TransitionStyle;
    setTransitionStyle: (style: TransitionStyle) => void;
    duration: number;
    setDuration: (ms: number) => void;
    isEnabled: boolean;
    setIsEnabled: (enabled: boolean) => void;
}

const PageTransitionContext = createContext<PageTransitionContextType | undefined>(undefined);

interface PageTransitionProviderProps {
    children: ReactNode;
    defaultStyle?: TransitionStyle;
    defaultDuration?: number;
}

export function PageTransitionProvider({
    children,
    defaultStyle = 'slide',
    defaultDuration = 400,
}: PageTransitionProviderProps) {
    const [transitionStyle, setTransitionStyle] = useState<TransitionStyle>(defaultStyle);
    const [duration, setDuration] = useState(defaultDuration);
    const [isEnabled, setIsEnabled] = useState(true);

    // Check for reduced motion preference
    if (typeof window !== 'undefined') {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReducedMotion && isEnabled) {
            setIsEnabled(false);
        }
    }

    return (
        <PageTransitionContext.Provider
            value={{
                transitionStyle,
                setTransitionStyle,
                duration,
                setDuration,
                isEnabled,
                setIsEnabled,
            }}
        >
            {children}
        </PageTransitionContext.Provider>
    );
}

export function usePageTransition() {
    const context = useContext(PageTransitionContext);
    if (!context) {
        throw new Error('usePageTransition must be used within a PageTransitionProvider');
    }
    return context;
}
