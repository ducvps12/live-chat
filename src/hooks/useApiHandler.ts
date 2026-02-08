import { notifyCustom } from "@/components/notificationsCustom";
import { ErrorResponse } from "@/types/error";
import { convertI18nKeyToText } from "@/utils/helper";
import { useTranslation } from "react-i18next";

export function useApiHandler(
  setIsGlobalLoading: (v: boolean) => void | boolean,
) {
  const {t} = useTranslation();
  
  const handleApi = async <T>(
    apiCall: () => Promise<T>,
    onSuccess?: (res: T) => void
  ) => {
    try {
      setIsGlobalLoading(true);
      const res = await apiCall();
      onSuccess?.(res);
      notifyCustom("success", {
        title: t("common.success"),
      });
      return true;
    } catch (error) {
      notifyCustom("error", {
        title: t("common.error"),
        description: convertI18nKeyToText((error as ErrorResponse).response?.data?.message || "", t),
      });
      return false;
    } finally {
      setIsGlobalLoading(false);
    }
  };

  return { handleApi };
}
