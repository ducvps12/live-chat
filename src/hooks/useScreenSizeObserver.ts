"use client";

import { useEffect, useState } from "react";

const DEFAULT_DESKTOP_WIDTH = 1440;

type ResizeObserverConstructor = typeof ResizeObserver;

export const useScreenSizeObserver = () => {
  // Always start with default to avoid SSR/client hydration mismatch.
  // The real width will be set after mount via ResizeObserver.
  const [screenWidth, setScreenWidth] = useState<number>(DEFAULT_DESKTOP_WIDTH);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    let resizeObserver: ResizeObserver | null = null;
    let mounted = true;

    const updateWidth = (width: number | undefined) => {
      if (typeof width !== "number") {
        return;
      }

      setScreenWidth((prevWidth) => (prevWidth === width ? prevWidth : width));
    };

    const initObserver = async () => {
      const ResizeObserverImpl = (
        typeof window.ResizeObserver !== "undefined"
          ? window.ResizeObserver
          : (await import("resize-observer-polyfill")).default
      ) as ResizeObserverConstructor;

      if (!mounted) {
        return;
      }

      resizeObserver = new ResizeObserverImpl((entries) => {
        const entry = entries[0];
        const width = entry?.contentRect?.width ?? window.innerWidth;
        updateWidth(width);
      });

      resizeObserver.observe(document.documentElement);
    };

    void initObserver();

    return () => {
      mounted = false;
      resizeObserver?.disconnect();
    };
  }, []);

  return { screenWidth };
};
