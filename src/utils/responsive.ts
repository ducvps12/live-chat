import { SCREEN_BREAKPOINTS, SCREEN_RESPONSIVE } from "./enums";

export const getScreenSizeFromWidth = (width: number): SCREEN_RESPONSIVE => {
  if (width < SCREEN_BREAKPOINTS.MOBILE) {
    return SCREEN_RESPONSIVE.MOBILE;
  }

  if (width < SCREEN_BREAKPOINTS.SMALL_TABLET) {
    return SCREEN_RESPONSIVE.SMALL_TABLET;
  }

  if (width < SCREEN_BREAKPOINTS.TABLET) {
    return SCREEN_RESPONSIVE.TABLET;
  }

  return SCREEN_RESPONSIVE.DESKTOP;
};
