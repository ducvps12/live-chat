// utils/notifyCustom.ts
import { notification } from "antd";

export type NotifyType = "success" | "error" | "info" | "warning";

interface NotifyProps {
  title: string;
  description?: string;
  duration?: number;
}

export function notifyCustom(
  type: NotifyType,
  { title, description, duration = 4000 }: NotifyProps
) {
  notification[type]({
    message: title,
    description: description,
    duration: duration / 1000, // Antd uses seconds
    placement: 'topRight',
  });
}

