import { useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/router';

interface PageTransitionProps {
    children: ReactNode;
    /** Transition style: 'slide' | 'fade' | 'circle' */
    style?: 'slide' | 'fade' | 'circle';
    /** Duration in milliseconds */
    duration?: number;
    /** Enable/disable transitions */
    enabled?: boolean;
}

type TransitionPhase = 'idle' | 'exiting' | 'entering';

export function PageTransition({
    children,
    style = 'slide',
    duration = 400,
    enabled = true,
}: PageTransitionProps) {
    const router = useRouter();
    const [phase, setPhase] = useState<TransitionPhase>('idle');
    const [displayChildren, setDisplayChildren] = useState(children);
    const [mounted, setMounted] = useState(false);
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

    // Check for reduced motion preference on mount only (avoid hydration mismatch)
    useEffect(() => {
        setMounted(true);
        setPrefersReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }, []);

    const isActive = mounted && enabled && !prefersReducedMotion;
    const halfDuration = duration / 2;

    useEffect(() => {
        if (!isActive) return;

        const handleStart = (url: string) => {
            // Don't animate if staying on same page (hash change, etc.)
            if (url === router.asPath) return;

            setPhase('exiting');
        };

        const handleComplete = () => {
            if (phase === 'exiting') {
                // Overlay is fully covering, now swap content
                setDisplayChildren(children);
                setPhase('entering');

                // After entering animation, return to idle
                setTimeout(() => {
                    setPhase('idle');
                }, halfDuration);
            }
        };

        const handleError = () => {
            setPhase('idle');
        };

        router.events.on('routeChangeStart', handleStart);
        router.events.on('routeChangeComplete', handleComplete);
        router.events.on('routeChangeError', handleError);

        return () => {
            router.events.off('routeChangeStart', handleStart);
            router.events.off('routeChangeComplete', handleComplete);
            router.events.off('routeChangeError', handleError);
        };
    }, [router, isActive, phase, children, halfDuration]);

    // Update children when not transitioning
    useEffect(() => {
        if (phase === 'idle') {
            setDisplayChildren(children);
        }
    }, [children, phase]);

    // If disabled, just render children
    if (!isActive) {
        return <>{children}</>;
    }

    const getOverlayClass = () => {
        const baseClass = 'page-transition-overlay';

        if (phase === 'idle') return `${baseClass} page-transition-overlay--hidden`;
        if (phase === 'exiting') return `${baseClass} page-transition-overlay--${style}-enter`;
        if (phase === 'entering') return `${baseClass} page-transition-overlay--${style}-exit`;

        return baseClass;
    };

    return (
        <>
            {/* Content */}
            <div className={`page-transition-content ${phase !== 'idle' ? 'page-transition-content--transitioning' : ''}`}>
                {displayChildren}
            </div>

            {/* Overlay */}
            <div
                className={getOverlayClass()}
                style={{
                    '--transition-duration': `${halfDuration}ms`,
                } as React.CSSProperties}
            >
                {/* Center content during transition */}
                <div className="page-transition-center">
                    {/* Animated Spinner Ring */}
                    <div className="page-transition-spinner">
                        <div className="page-transition-spinner__ring"></div>
                        <div className="page-transition-spinner__ring page-transition-spinner__ring--delay"></div>
                    </div>

                    {/* Logo */}
                    <div className="page-transition-logo">
                        <img
                            src="/logo.jpg"
                            alt="Loading"
                            className="page-transition-logo__image"
                        />
                    </div>

                    {/* Brand Name */}
                    <div className="page-transition-brand">
                        <span className="page-transition-brand__name">NemarkInbox</span>
                        <span className="page-transition-brand__loading">Đang tải...</span>
                    </div>
                </div>
            </div>
        </>
    );
}

export default PageTransition;
