import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth, useChangePassword, useSessions, useRevokeSession, useLogoutAll } from '@/hooks/useAuth';
import { Alert, Spin, Table, Tag, Button, Popconfirm, Form, Input } from 'antd';
import { format } from 'date-fns';

export default function ProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const changePassword = useChangePassword();
  const sessions = useSessions();
  const revokeSession = useRevokeSession();
  const logoutAll = useLogoutAll();

  // Password Change State
  const [form] = Form.useForm();

  const handlePasswordChange = (values: any) => {
    changePassword.mutate(values, {
      onSuccess: () => {
        form.resetFields();
      }
    });
  };

  const columns = [
    {
      title: 'Session ID',
      dataIndex: 'sessionId',
      key: 'sessionId',
      ellipsis: true,
    },
    {
      title: 'Current',
      key: 'current',
      render: (_: any, record: any) => {
        // This is tricky without knowing current sessionID. 
        // Usually API returns isCurrent flag or we match with token payload.
        // For now, skipping or assuming API provides a flag 'isCurrent'
        return record.isCurrent ? <Tag color="green">Current</Tag> : null;
      }
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => text ? format(new Date(text), 'yyyy-MM-dd HH:mm') : '-',
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: any) => (
        <Popconfirm
          title="Revoke session?"
          description="Are you sure you want to revoke this session?"
          onConfirm={() => revokeSession.mutate(record.sessionId)}
          disabled={record.isCurrent}
        >
          <Button type="link" danger disabled={record.isCurrent}>
            Revoke
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">

      {/* Profile Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('profile.title', { defaultValue: 'Hồ sơ người dùng' })}
          </h1>
          <p className="text-gray-500">
            Welcome, {user.data?.user?.FirstName} {user.data?.user?.LastName} ({user.data?.user?.Email})
          </p>
        </div>
        <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xl">
          {user.data?.user?.FirstName?.charAt(0).toUpperCase()}
        </div>
      </div>

      {/* Security Section */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <span className="material-symbols-outlined text-gray-600">security</span>
          Bảo mật
        </h2>

        {/* Change Password */}
        <div className="border-b border-gray-100 pb-6 mb-6">
          <h3 className="text-base font-medium text-gray-800 mb-4">Đổi mật khẩu</h3>
          {changePassword.isError && (
            <Alert
              className="mb-4"
              message="Error"
              description={(changePassword.error as any)?.message || t('message.server_error')}
              type="error"
              showIcon
            />
          )}
          <Form form={form} layout="vertical" onFinish={handlePasswordChange} disabled={changePassword.isPending}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Form.Item name="oldPassword" label="Mật khẩu hiện tại" rules={[{ required: true, message: 'Required' }]}>
                <Input.Password placeholder="••••••••" />
              </Form.Item>
              <Form.Item name="newPassword" label="Mật khẩu mới" rules={[{ required: true, min: 6, message: 'Min 6 chars' }]}>
                <Input.Password placeholder="••••••••" />
              </Form.Item>
              <Form.Item
                name="confirmPassword"
                label="Xác nhận mật khẩu"
                dependencies={['newPassword']}
                rules={[
                  { required: true, message: 'Required' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('newPassword') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('Passwords do not match!'));
                    },
                  }),
                ]}
              >
                <Input.Password placeholder="••••••••" />
              </Form.Item>
            </div>
            <div className="flex justify-end">
              <Button type="primary" htmlType="submit" loading={changePassword.isPending}>
                Cập nhật mật khẩu
              </Button>
            </div>
          </Form>
        </div>

        {/* Sessions */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-medium text-gray-800">Phiên đăng nhập</h3>
            <Popconfirm
              title="Logout all devices?"
              description="This will log you out from all other devices."
              onConfirm={() => logoutAll.mutate()}
            >
              <Button danger loading={logoutAll.isPending}>
                Đăng xuất tất cả thiết bị
              </Button>
            </Popconfirm>
          </div>

          {sessions.isLoading ? (
            <div className="flex justify-center p-4"><Spin /></div>
          ) : sessions.isError ? (
            <Alert message="Không thể tải danh sách phiên" type="error" />
          ) : (
            <Table
              dataSource={sessions.data || []}
              columns={columns}
              rowKey="sessionId"
              pagination={false}
              size="small"
            />
          )}
        </div>
      </div>
    </div>
  );
}
