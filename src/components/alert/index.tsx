import { Modal } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons';
import React from 'react';

type SweetAlertIcon = 'success' | 'error' | 'warning' | 'info' | 'question';

interface AlertShowOptions {
  title?: string;
  message?: string;
  icon?: SweetAlertIcon;
  isShowIcon?: boolean
  confirmText?: string;
  showCancelButton?: boolean;
  cancelText?: string;
  customClass?: Record<string, unknown>; // kept for compatibility but generally unused in Antd default
}

const getIcon = (iconName: SweetAlertIcon) => {
  switch (iconName) {
    case 'success': return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    case 'error': return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
    case 'warning': return <ExclamationCircleOutlined style={{ color: '#faad14' }} />;
    case 'info': return <InfoCircleOutlined style={{ color: '#1890ff' }} />;
    case 'question': return <QuestionCircleOutlined style={{ color: '#1890ff' }} />;
    default: return null;
  }
};

/**
 * Display a customizable alert modal using Ant Design.
 */
export const Alert = {
  show: ({
    title = 'Notification',
    message = '',
    icon = 'info',
    isShowIcon = true,
    confirmText = 'OK',
    showCancelButton = false,
    cancelText = 'Cancel',
  }: AlertShowOptions) => {
    return new Promise((resolve) => {
      Modal.confirm({
        title,
        content: message,
        icon: isShowIcon ? getIcon(icon) : null,
        okText: confirmText,
        cancelText: cancelText,
        cancelButtonProps: { style: { display: showCancelButton ? 'inline-block' : 'none' } },
        onOk: () => {
          resolve({ isConfirmed: true, isDenied: false, isDismissed: false, value: true });
        },
        onCancel: () => {
          resolve({ isConfirmed: false, isDenied: false, isDismissed: true, dismiss: 'cancel' });
        },
        centered: true,
      });
    });
  }
};

