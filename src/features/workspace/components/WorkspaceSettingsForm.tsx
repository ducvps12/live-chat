import React, { useEffect, useState } from 'react';
import { Form, Input, Button, Upload, message, Avatar, Select, Spin, Tag, Typography } from 'antd';
import type { UploadChangeParam, UploadFile } from 'antd/es/upload';
const { Text } = Typography;
import {
    UploadOutlined,
    BuildOutlined,
    PlusOutlined,
    LinkOutlined,
    ClockCircleOutlined,
    GlobalOutlined,
    TagsOutlined,
    CheckCircleOutlined,
} from '@ant-design/icons';
import { useWorkspace, useUpdateWorkspace, useWorkspaceTags, useAddWorkspaceTag, useRemoveWorkspaceTag } from '../../../domains/workspace/workspace.hooks';

type ApiError = {
    response?: {
        data?: {
            message?: string;
            error?: { message?: string };
        };
    };
};

type WorkspaceSettingsValues = {
    name: string;
    timezone?: string;
    language?: string;
};

export default function WorkspaceSettingsForm({ workspaceId }: { workspaceId: string }) {
    const { data: wsRes, isLoading } = useWorkspace(workspaceId);
    const { mutateAsync: updateWorkspace, isPending: isUpdating } = useUpdateWorkspace();

    const [form] = Form.useForm();
    const [logoBase64, setLogoBase64] = useState<string | null>(null);
    const [tagInput, setTagInput] = useState('');
    const [addingTag, setAddingTag] = useState(false);

    const ws = wsRes?.data;
    const { data: tagsRes } = useWorkspaceTags(workspaceId);
    const tags = tagsRes?.data || [];
    const addTag = useAddWorkspaceTag();
    const removeTag = useRemoveWorkspaceTag();

    useEffect(() => {
        if (ws) {
            form.setFieldsValue({
                name: ws.name,
                slug: ws.slug,
                timezone: ws.settings?.timezone || 'Asia/Ho_Chi_Minh',
                language: ws.settings?.language || 'vi',
            });
            if (ws.logoUrl) {
                setLogoBase64(ws.logoUrl);
            }
        }
    }, [ws, form]);

    const handleLogoChange = (info: UploadChangeParam<UploadFile>) => {
        const file = info.file.originFileObj || (info.file as unknown as File);
        if (!file) return;

        const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png';
        if (!isJpgOrPng) {
            message.error('Bạn chỉ có thể tải lên file JPG/PNG!');
            return;
        }

        const isLt2M = file.size / 1024 / 1024 < 2;
        if (!isLt2M) {
            message.error('Ảnh tải lên phải nhỏ hơn 2MB!');
            return;
        }

        const reader = new FileReader();
        reader.addEventListener('load', () => {
            setLogoBase64(reader.result as string);
        });
        reader.readAsDataURL(file);
    };

    const handleAddTag = async () => {
        if (!tagInput || !tagInput.trim()) return;
        const newTag = tagInput.trim();
        if (tags.includes(newTag)) {
            message.warning('Tag đã tồn tại!');
            return;
        }
        setAddingTag(true);
        try {
            await addTag.mutateAsync({ workspaceId, tag: newTag });
            setTagInput('');
        } catch (error: unknown) {
            const err = error as ApiError;
            message.error(err.response?.data?.message || 'Lỗi khi thêm tag');
        } finally {
            setAddingTag(false);
        }
    };

    const handleRemoveTag = async (removedTag: string) => {
        try {
            await removeTag.mutateAsync({ workspaceId, tag: removedTag });
        } catch (error: unknown) {
            const err = error as ApiError;
            message.error(err.response?.data?.message || 'Lỗi khi xóa tag');
        }
    };

    const onFinish = async (values: WorkspaceSettingsValues) => {
        try {
            await updateWorkspace({
                id: workspaceId,
                name: values.name,
                logoUrl: logoBase64 || '',
                settings: {
                    ...(ws?.settings || {}),
                    timezone: values.timezone,
                    language: values.language,
                }
            });
            message.success('Cập nhật thông tin workspace thành công!');
        } catch (error: unknown) {
            const err = error as ApiError;
            message.error(err.response?.data?.error?.message || 'Có lỗi xảy ra khi cập nhật');
        }
    };

    if (isLoading) {
        return (
            <div className="workspace-settings-loading">
                <Spin size="large" />
            </div>
        );
    }

    return (
        <div className="workspace-settings-form">
            <section className="workspace-settings-card">
                <div className="workspace-settings-card-header">
                    <div className="workspace-settings-title">
                        <span className="workspace-settings-title-icon">
                            <BuildOutlined />
                        </span>
                        <div>
                            <h2>Thông tin chung</h2>
                            <p>Thông tin nhận diện workspace dùng trên các kênh CSKH.</p>
                        </div>
                    </div>
                    <Tag className="workspace-settings-state" icon={<CheckCircleOutlined />}>
                        Đang hoạt động
                    </Tag>
                </div>

                <Form form={form} layout="vertical" onFinish={onFinish} className="workspace-settings-ant-form">
                    <Form.Item label="Logo Workspace" className="workspace-logo-field">
                        <div className="workspace-logo-uploader">
                            <Avatar
                                shape="square"
                                size={92}
                                icon={<BuildOutlined />}
                                src={logoBase64}
                                style={{
                                    background: '#f1f5f9',
                                    color: '#64748b',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: 8,
                                }}
                            />
                            <div className="workspace-logo-copy">
                                <h3>Ảnh đại diện workspace</h3>
                                <p>JPG/PNG, tối đa 2MB. Logo vuông tỷ lệ 1:1 sẽ hiển thị đẹp nhất.</p>
                                <Upload showUploadList={false} beforeUpload={() => false} onChange={handleLogoChange}>
                                    <Button icon={<UploadOutlined />}>Tải logo lên</Button>
                                </Upload>
                            </div>
                        </div>
                    </Form.Item>

                    <div className="workspace-form-grid">
                        <Form.Item label="Tên Workspace" name="name" rules={[{ required: true, message: 'Vui lòng nhập tên' }]}>
                            <Input prefix={<BuildOutlined />} placeholder="Nhập tên workspace" />
                        </Form.Item>

                        <Form.Item label="Slug (Đường dẫn)" name="slug">
                            <Input prefix={<LinkOutlined />} disabled />
                        </Form.Item>

                        <Form.Item label="Múi giờ" name="timezone">
                            <Select
                                suffixIcon={<ClockCircleOutlined />}
                                options={[
                                    { value: 'Asia/Ho_Chi_Minh', label: 'Asia/Ho_Chi_Minh (Việt Nam)' },
                                    { value: 'UTC', label: 'UTC' }
                                ]}
                            />
                        </Form.Item>

                        <Form.Item label="Ngôn ngữ chính" name="language">
                            <Select
                                suffixIcon={<GlobalOutlined />}
                                options={[
                                    { value: 'vi', label: 'Tiếng Việt' },
                                    { value: 'en', label: 'English' }
                                ]}
                            />
                        </Form.Item>
                    </div>

                    <div className="workspace-settings-actions">
                        <Button type="primary" htmlType="submit" loading={isUpdating}>
                            Lưu thay đổi
                        </Button>
                    </div>
                </Form>
            </section>

            <section className="workspace-settings-card">
                <div className="workspace-settings-card-header">
                    <div className="workspace-settings-title">
                        <span className="workspace-settings-title-icon teal">
                            <TagsOutlined />
                        </span>
                        <div>
                            <h2>Phân loại khách hàng</h2>
                            <p>Quản lý các tag mà agent có thể gắn cho hội thoại và khách hàng.</p>
                        </div>
                    </div>
                    <span className="workspace-settings-count">{tags.length} thẻ</span>
                </div>

                <div className="workspace-tag-cloud">
                    {tags.length === 0 ? (
                        <div className="workspace-empty-tags">
                            <TagsOutlined />
                            <Text type="secondary">Chưa có thẻ nào.</Text>
                        </div>
                    ) : (
                        tags.map(tag => (
                            <Tag
                                key={tag}
                                closable
                                onClose={(e) => {
                                    e.preventDefault();
                                    handleRemoveTag(tag);
                                }}
                                color="blue"
                                className="workspace-tag-pill"
                            >
                                {tag}
                            </Tag>
                        ))
                    )}
                </div>

                <div className="workspace-tag-actions">
                    <Input
                        placeholder="Nhập thẻ mới (VD: VIP)"
                        value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        onPressEnter={(e) => {
                            e.preventDefault();
                            handleAddTag();
                        }}
                    />
                    <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddTag} loading={addingTag}>
                        Thêm thẻ
                    </Button>
                </div>
            </section>
        </div>
    );
}
