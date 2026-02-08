'use client';

import { useEffect, useState, ReactNode } from 'react';

interface NoSSRProps {
    children: ReactNode;
    fallback?: ReactNode;
}

/**
 * Wrapper component to skip server-side rendering.
 * This fixes hydration errors when browser extensions inject HTML.
 */
export default function NoSSR({ children, fallback = null }: NoSSRProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
}
