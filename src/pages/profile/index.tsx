import { ReactElement, useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useProfile, useUpdateProfile, useUploadAvatar } from '@/hooks/useProfile';
import { useResendVerification } from '@/hooks/useAuth';
import { ResendVerificationButton } from '@/components/common/ResendVerificationButton';
import { Form, Input, Button, Card, Upload, Avatar, Spin, Select, Typography, Divider } from 'antd';
import { UserOutlined, UploadOutlined, SaveOutlined, LoadingOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';

const { Title, Text } = Typography;
const { Option } = Select;

function ProfilePage() {
  const router = useRouter();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { mutate: updateProfile, isPending: updating } = useUpdateProfile();
  const { mutate: uploadAvatar, isPending: uploading } = useUploadAvatar();
  const { mutate: resendVerification, isPending: resending } = useResendVerification();
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);
  const [hasChanges, setHasChanges] = useState(false);
  const UPDATE_COOLDOWN = 3000; // 3 seconds cooldown

  // Track form changes
  const formValues = Form.useWatch([], form);

  useEffect(() => {
    if (!profile) return;

    // Compare current values with initial profile data
    const initialValues = {
      firstName: profile.FirstName || '',
      lastName: profile.LastName || '',
      language: profile.Language || 'vi',
      timezone: profile.Timezone || 'Asia/Ho_Chi_Minh',
    };

    const currentValues = form.getFieldsValue();
    const changed = Object.keys(initialValues).some(
      (key) => initialValues[key as keyof typeof initialValues] !== currentValues[key]
    );

    setHasChanges(changed);
  }, [formValues, profile, form]);

  const handleSubmit = (values: any) => {
    const now = Date.now();
    if (now - lastUpdateTime < UPDATE_COOLDOWN) {
      return; // Prevent spam
    }
    setLastUpdateTime(now);
    updateProfile(values);
  };

  const handleAvatarUpload = (file: File) => {
    uploadAvatar(file);
    return false; // Prevent default upload
  };

  const [isMounted, setIsMounted] = useState(false);

  // Handle client-side mounting to avoid hydration errors
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || profileLoading) {
    return null; // Return null during SSR and initial load
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <Title level={2} className="mb-6">Hồ sơ của tôi</Title>

        {/* Avatar Section */}
        <Card className="mb-6">
          <div className="flex items-center gap-6">
            <Avatar
              size={100}
              src={profile?.AvatarUrl}
              icon={<UserOutlined />}
              className="bg-blue-500"
            />
            <div className="flex-1">
              <Title level={4} className="mb-2">Ảnh đại diện</Title>
              <Text type="secondary" className="block mb-4">
                PNG, JPG, GIF tối đa 5MB
              </Text>
              <Upload
                beforeUpload={handleAvatarUpload}
                fileList={fileList}
                onChange={({ fileList }) => setFileList(fileList)}
                maxCount={1}
                accept="image/*"
              >
                <Button icon={<UploadOutlined />} loading={uploading}>
                  {uploading ? 'Đang tải lên...' : 'Tải ảnh lên'}
                </Button>
              </Upload>
            </div>
          </div>
        </Card>

        {/* Profile Form */}
        <Card>
          <Title level={4} className="mb-6">Thông tin cá nhân</Title>

          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{
              firstName: profile?.FirstName || '',
              lastName: profile?.LastName || '',
              language: profile?.Language || 'vi',
              timezone: profile?.Timezone || 'Asia/Ho_Chi_Minh',
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item
                name="firstName"
                label="Họ"
              >
                <Input
                  size="large"
                  placeholder="Nguyễn"
                />
              </Form.Item>

              <Form.Item
                name="lastName"
                label="Tên"
              >
                <Input
                  size="large"
                  placeholder="Văn A"
                />
              </Form.Item>
            </div>

            <Form.Item label="Email">
              <Input
                size="large"
                value={profile?.Email}
                disabled
                suffix={
                  profile?.EmailVerified ? (
                    <span className="text-green-600 text-xs">✓ Đã xác thực</span>
                  ) : (
                    <span className="text-amber-600 text-xs">⚠ Chưa xác thực</span>
                  )
                }
              />
              {!profile?.EmailVerified && (
                <div className="mt-2">
                  <ResendVerificationButton
                    email={profile?.Email || ''}
                    resendVerification={resendVerification}
                    resending={resending}
                  />
                </div>
              )}
            </Form.Item>

            <Divider />

            <Title level={5} className="mb-4">Tùy chọn</Title>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item
                name="language"
                label="Ngôn ngữ"
              >
                <Select size="large">
                  <Option value="vi">Tiếng Việt</Option>
                  <Option value="en">English</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="timezone"
                label="Múi giờ"
              >
                <Select size="large">
                  <Option value="Asia/Ho_Chi_Minh">Việt Nam (UTC+7)</Option>
                  <Option value="Asia/Bangkok">Bangkok (UTC+7)</Option>
                  <Option value="Asia/Singapore">Singapore (UTC+8)</Option>
                  <Option value="UTC">UTC (UTC+0)</Option>
                </Select>
              </Form.Item>
            </div>

            <Form.Item className="mb-0">
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                icon={<SaveOutlined />}
                loading={updating}
                disabled={!hasChanges || updating}
                block
              >
                {updating ? 'Đang lưu...' : 'Lưu thay đổi'}
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </div>
  );
}

ProfilePage.getLayout = function getLayout(page: ReactElement) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export default ProfilePage;
