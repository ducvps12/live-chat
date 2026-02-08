import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { message, Button, Table, Tag, Modal, Input, Spin, Form, ColorPicker, Radio } from 'antd';
import { SettingsLayout } from '@/components/layout/SettingsLayout';
import { useMyStore } from '@/contexts/MyStoreContext';
import api from '@/lib/http';

interface WidgetData {
    widgetId: string;
    widgetKey: number;
    siteKey: string;
    name: string;
    allowedDomains: string[];
    theme: {
        mainColor?: string;
        color?: string;
        position?: 'br' | 'bl';
        welcomeMessage?: string;
    };
    status: number;
}

interface CreateWidgetForm {
    name: string;
    allowedDomains: string;
    color: string;
    position: 'br' | 'bl';
}

const WebsiteSettingsPage: React.FC = () => {
    const { t } = useTranslation();
    const { activeWorkspace } = useMyStore();
    const workspaceId = activeWorkspace?.workspaceId;

    const [loading, setLoading] = useState(false);
    const [widgets, setWidgets] = useState<WidgetData[]>([]);
    const [selectedWidget, setSelectedWidget] = useState<WidgetData | null>(null);
    const [embedModalVisible, setEmbedModalVisible] = useState(false);
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [guideModalVisible, setGuideModalVisible] = useState(false);
    const [creating, setCreating] = useState(false);
    const [form] = Form.useForm<CreateWidgetForm>();

    const fetchWidgets = useCallback(async () => {
        if (!workspaceId) return;

        setLoading(true);
        try {
            const res = await api.get(`/workspaces/${workspaceId}/widgets`);
            setWidgets(res.data?.data?.widgets || []);
        } catch (error: any) {
            console.error('Failed to fetch widgets:', error);
        } finally {
            setLoading(false);
        }
    }, [workspaceId]);

    useEffect(() => {
        fetchWidgets();
    }, [fetchWidgets]);

    const showEmbedCode = (widget: WidgetData) => {
        setSelectedWidget(widget);
        setEmbedModalVisible(true);
    };

    const copyEmbedCode = () => {
        if (!selectedWidget) return;
        const code = getEmbedCode(selectedWidget);
        navigator.clipboard.writeText(code);
        message.success('Đã sao chép mã nhúng!');
    };

    const getEmbedCode = (widget: WidgetData) => {
        const apiBase = process.env.NEXT_PUBLIC_API_URL_BASE || 'http://localhost:4000';
        return `<script async src="${apiBase}/api/embed/widget.js" data-site-key="${widget.siteKey}" data-api-base="${apiBase}"></script>`;
    };

    const handleCreateWidget = async (values: CreateWidgetForm) => {
        if (!workspaceId) return;

        setCreating(true);
        try {
            // Parse domains from comma-separated string
            const domains = values.allowedDomains
                .split(',')
                .map(d => d.trim())
                .filter(d => d.length > 0);

            if (domains.length === 0) {
                message.error('Vui lòng nhập ít nhất một tên miền!');
                setCreating(false);
                return;
            }

            await api.post(`/workspaces/${workspaceId}/widgets`, {
                name: values.name,
                allowedDomains: domains,
                theme: {
                    color: values.color || '#3B82F6',
                    position: values.position || 'br',
                }
            });

            message.success('Tạo widget thành công!');
            setCreateModalVisible(false);
            form.resetFields();
            fetchWidgets();
        } catch (error: any) {
            console.error('Failed to create widget:', error);
            const errorMsg = error.response?.data?.message || 'Không thể tạo widget. Vui lòng thử lại!';
            message.error(errorMsg);
        } finally {
            setCreating(false);
        }
    };

    const columns = [
        {
            title: 'WEBSITE',
            dataIndex: 'name',
            key: 'name',
            render: (name: string, record: WidgetData) => (
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-neutral-400">language</span>
                    <span className="font-medium">{name}</span>
                    {record.status === 1 && (
                        <span className="material-symbols-outlined text-green-500 text-sm">verified</span>
                    )}
                </div>
            ),
        },
        {
            title: 'DOMAINS',
            dataIndex: 'allowedDomains',
            key: 'domains',
            render: (domains: string[]) => (
                <span className="text-neutral-500">
                    {domains.length > 0 ? domains.join(', ') : 'Chưa dùng'}
                </span>
            ),
        },
        {
            title: 'TRẠNG THÁI',
            key: 'status',
            render: (_: any, record: WidgetData) => (
                <Tag color={record.status === 1 ? 'green' : 'orange'}>
                    {record.status === 1 ? 'Hoạt động' : 'Tạm ngưng'}
                </Tag>
            ),
        },
        {
            title: 'THAO TÁC',
            key: 'actions',
            render: (_: any, record: WidgetData) => (
                <div className="flex items-center gap-2">
                    <Button
                        type="link"
                        size="small"
                        onClick={() => showEmbedCode(record)}
                    >
                        Chỉnh sửa cửa sổ chat ...
                    </Button>
                </div>
            ),
        },
    ];

    if (!workspaceId) {
        return (
            <SettingsLayout>
                <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <span className="material-symbols-outlined text-4xl text-neutral-400">business</span>
                    <p className="text-neutral-500">Vui lòng chọn workspace để xem cài đặt Website</p>
                    <a href="/workspace/workspaces" className="text-primary-600 hover:underline flex items-center gap-1">
                        <span className="material-symbols-outlined text-lg">arrow_forward</span>
                        Đi đến danh sách Workspaces
                    </a>
                </div>
            </SettingsLayout>
        );
    }

    return (
        <SettingsLayout>
            <Spin spinning={loading}>
                <div className="max-w-6xl">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-2xl text-primary-600">language</span>
                                <h1 className="text-2xl font-bold text-neutral-900">Website</h1>
                                <span className="text-neutral-400 ml-2">{widgets.length} trang</span>
                            </div>
                            <p className="text-neutral-500 mt-1">
                                Tích hợp cửa sổ chat và các tiện ích khác để tương tác với khách hàng ngay trên website của bạn.{' '}
                                <a href="#" onClick={(e) => { e.preventDefault(); setGuideModalVisible(true); }} className="text-primary-600 hover:underline">Hướng dẫn tích hợp</a>
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Input
                                placeholder="Tìm kiếm"
                                prefix={<span className="material-symbols-outlined text-neutral-400 text-lg">search</span>}
                                className="w-48"
                            />
                            <Button type="primary" onClick={() => setCreateModalVisible(true)} icon={<span className="material-symbols-outlined text-lg mr-1">add</span>}>
                                + Cài lên website
                            </Button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-lg shadow-sm border border-neutral-200">
                        <Table
                            dataSource={widgets}
                            columns={columns}
                            rowKey="widgetId"
                            pagination={false}
                            onRow={(record) => ({
                                onClick: () => showEmbedCode(record),
                                className: 'cursor-pointer hover:bg-neutral-50',
                            })}
                        />
                    </div>
                </div>
            </Spin>

            {/* Embed Code Modal */}
            <Modal
                title="Gắn mã nhúng"
                open={embedModalVisible}
                onCancel={() => setEmbedModalVisible(false)}
                footer={[
                    <Button key="close" onClick={() => setEmbedModalVisible(false)}>
                        Đóng
                    </Button>,
                ]}
                width={700}
            >
                {selectedWidget && (
                    <div className="space-y-4">
                        <p className="text-neutral-600">
                            Chèn đoạn mã dưới đây vào trước thẻ đóng <code className="bg-neutral-100 px-1 rounded">&lt;/body&gt;</code> trên các trang bạn muốn sử dụng.{' '}
                            <a href="#" className="text-primary-600 hover:underline">Sao chép</a>
                        </p>

                        <div className="relative">
                            <pre className="p-4 bg-neutral-900 text-green-400 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap">
                                {getEmbedCode(selectedWidget)}
                            </pre>
                            <button
                                onClick={copyEmbedCode}
                                className="absolute top-2 right-2 p-2 bg-neutral-700 hover:bg-neutral-600 rounded text-white text-xs"
                            >
                                Sao chép
                            </button>
                        </div>

                        <a href="#" onClick={(e) => { e.preventDefault(); setGuideModalVisible(true); }} className="text-primary-600 hover:underline text-sm">
                            Xem hướng dẫn
                        </a>

                        <div className="flex items-center gap-2 pt-4 border-t">
                            <span className="material-symbols-outlined text-green-500">check_circle</span>
                            <span className="text-neutral-600">
                                Tên miền <strong>{selectedWidget.name}</strong> đã được xác nhận.
                            </span>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Create Widget Modal */}
            <Modal
                title="Thêm Website Mới"
                open={createModalVisible}
                onCancel={() => {
                    setCreateModalVisible(false);
                    form.resetFields();
                }}
                footer={null}
                width={500}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleCreateWidget}
                    initialValues={{
                        color: '#3B82F6',
                        position: 'br'
                    }}
                >
                    <Form.Item
                        name="name"
                        label="Tên Website"
                        rules={[{ required: true, message: 'Vui lòng nhập tên website!' }]}
                    >
                        <Input placeholder="Ví dụ: Website chính, Landing page..." />
                    </Form.Item>

                    <Form.Item
                        name="allowedDomains"
                        label="Tên miền được phép"
                        rules={[{ required: true, message: 'Vui lòng nhập ít nhất một tên miền!' }]}
                        extra="Nhập các tên miền cách nhau bởi dấu phẩy. Ví dụ: example.com, localhost:3000"
                    >
                        <Input.TextArea
                            rows={2}
                            placeholder="example.com, https://mysite.com"
                        />
                    </Form.Item>

                    <Form.Item
                        name="color"
                        label="Màu chủ đề"
                        rules={[{ required: true, message: 'Vui lòng chọn màu!' }]}
                        getValueFromEvent={(color) => {
                            return typeof color === 'string' ? color : color?.toHexString?.() || '#3B82F6';
                        }}
                    >
                        <ColorPicker format="hex" showText />
                    </Form.Item>

                    <Form.Item
                        name="position"
                        label="Vị trí hiển thị"
                        rules={[{ required: true }]}
                    >
                        <Radio.Group>
                            <Radio value="br">Góc phải dưới</Radio>
                            <Radio value="bl">Góc trái dưới</Radio>
                        </Radio.Group>
                    </Form.Item>

                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button onClick={() => {
                            setCreateModalVisible(false);
                            form.resetFields();
                        }}>
                            Hủy
                        </Button>
                        <Button type="primary" htmlType="submit" loading={creating}>
                            Tạo Widget
                        </Button>
                    </div>
                </Form>
            </Modal>

            {/* Guide Modal */}
            <Modal
                title="Hướng dẫn tích hợp Chat Widget"
                open={guideModalVisible}
                onCancel={() => setGuideModalVisible(false)}
                footer={[
                    <Button key="close" type="primary" onClick={() => setGuideModalVisible(false)}>
                        Đã hiểu
                    </Button>,
                ]}
                width={700}
            >
                <div className="space-y-6">
                    {/* Step 1 */}
                    <div className="flex gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-bold">
                            1
                        </div>
                        <div>
                            <h3 className="font-semibold text-neutral-900">Thêm Website mới</h3>
                            <p className="text-neutral-600 text-sm mt-1">
                                Bấm nút <strong>"+ Cài lên website"</strong> để tạo widget mới. Nhập tên và các tên miền được phép sử dụng widget (ví dụ: example.com, mysite.vn).
                            </p>
                        </div>
                    </div>

                    {/* Step 2 */}
                    <div className="flex gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-bold">
                            2
                        </div>
                        <div>
                            <h3 className="font-semibold text-neutral-900">Sao chép mã nhúng</h3>
                            <p className="text-neutral-600 text-sm mt-1">
                                Sau khi tạo, bấm vào widget trong danh sách để xem mã nhúng. Bấm <strong>"Sao chép"</strong> để copy đoạn mã script.
                            </p>
                        </div>
                    </div>

                    {/* Step 3 */}
                    <div className="flex gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-bold">
                            3
                        </div>
                        <div>
                            <h3 className="font-semibold text-neutral-900">Dán mã vào website</h3>
                            <p className="text-neutral-600 text-sm mt-1">
                                Mở file HTML của website và dán đoạn mã vào <strong>trước thẻ đóng</strong> <code className="bg-neutral-100 px-1 rounded">&lt;/body&gt;</code>.
                            </p>
                            <pre className="mt-2 p-3 bg-neutral-900 text-green-400 rounded text-xs overflow-x-auto">
                                {`<!DOCTYPE html>
<html>
<head>...</head>
<body>
    <!-- Nội dung website -->

    <!-- Dán mã widget vào đây -->
    <script async src=".../widget.js" data-site-key="..."></script>
</body>
</html>`}
                            </pre>
                        </div>
                    </div>

                    {/* Step 4 */}
                    <div className="flex gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center font-bold">
                            ✓
                        </div>
                        <div>
                            <h3 className="font-semibold text-neutral-900">Hoàn tất!</h3>
                            <p className="text-neutral-600 text-sm mt-1">
                                Refresh lại website của bạn. Bạn sẽ thấy icon chat xuất hiện ở góc màn hình. Khách hàng có thể bắt đầu chat ngay lập tức!
                            </p>
                        </div>
                    </div>

                    {/* Tips */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                        <h4 className="font-semibold text-blue-800 flex items-center gap-2">
                            <span className="material-symbols-outlined text-lg">lightbulb</span>
                            Mẹo hữu ích
                        </h4>
                        <ul className="text-blue-700 text-sm mt-2 space-y-1 list-disc list-inside">
                            <li>Đảm bảo tên miền trong cài đặt khớp với domain website của bạn</li>
                            <li>Widget hỗ trợ cả HTTP và HTTPS</li>
                            <li>Có thể tùy chỉnh màu sắc và vị trí hiển thị trong phần cài đặt</li>
                        </ul>
                    </div>
                </div>
            </Modal>
        </SettingsLayout>
    );
};

export default WebsiteSettingsPage;
