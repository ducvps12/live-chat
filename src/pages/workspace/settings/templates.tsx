import React, { useState } from 'react';
import { Button, Card, Input, Table, Tag, Modal } from 'antd';
import { SettingsLayout } from '@/components/layout/SettingsLayout';

interface Template {
    key: number;
    name: string;
    content: string;
    shortcut: string;
    category: string;
}

const TemplatesSettingsPage: React.FC = () => {
    const [modalVisible, setModalVisible] = useState(false);

    const templates: Template[] = [
        { key: 1, name: 'Chào mừng', content: 'Xin chào! Tôi có thể giúp gì cho bạn?', shortcut: '/hi', category: 'Chào hỏi' },
        { key: 2, name: 'Cảm ơn', content: 'Cảm ơn bạn đã liên hệ. Chúc bạn một ngày tốt lành!', shortcut: '/thanks', category: 'Kết thúc' },
        { key: 3, name: 'Chờ xác nhận', content: 'Vui lòng chờ trong giây lát, tôi đang kiểm tra thông tin cho bạn.', shortcut: '/wait', category: 'Hỗ trợ' },
        { key: 4, name: 'Hướng dẫn đặt hàng', content: 'Để đặt hàng, bạn vui lòng...\n1. Chọn sản phẩm\n2. Thêm vào giỏ hàng\n3. Thanh toán', shortcut: '/order', category: 'Hướng dẫn' },
    ];

    const columns = [
        {
            title: 'TÊN MẪU',
            dataIndex: 'name',
            key: 'name',
            render: (name: string) => <span className="font-medium">{name}</span>,
        },
        {
            title: 'NỘI DUNG',
            dataIndex: 'content',
            key: 'content',
            render: (content: string) => (
                <span className="text-neutral-600 truncate max-w-xs block">{content}</span>
            ),
        },
        {
            title: 'SHORTCUT',
            dataIndex: 'shortcut',
            key: 'shortcut',
            render: (shortcut: string) => (
                <code className="bg-neutral-100 px-2 py-0.5 rounded text-sm">{shortcut}</code>
            ),
        },
        {
            title: 'DANH MỤC',
            dataIndex: 'category',
            key: 'category',
            render: (category: string) => <Tag>{category}</Tag>,
        },
        {
            title: '',
            key: 'actions',
            render: () => (
                <Button type="link" size="small">Sửa</Button>
            ),
        },
    ];

    return (
        <SettingsLayout>
            <div className="max-w-5xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-2xl text-primary-600">description</span>
                            <h1 className="text-2xl font-bold text-neutral-900">Mẫu tin nhắn</h1>
                            <span className="text-neutral-400 ml-2">{templates.length} mẫu</span>
                        </div>
                        <p className="text-neutral-500 mt-1">
                            Tạo mẫu tin nhắn để phản hồi nhanh hơn. Sử dụng / + shortcut để gọi mẫu.
                        </p>
                    </div>
                    <Button type="primary" size="large" onClick={() => setModalVisible(true)}>
                        + Tạo mẫu mới
                    </Button>
                </div>

                {/* Search */}
                <div className="mb-4">
                    <Input
                        placeholder="Tìm kiếm mẫu tin nhắn..."
                        prefix={<span className="material-symbols-outlined text-neutral-400">search</span>}
                        className="max-w-sm"
                    />
                </div>

                {/* Table */}
                <Card>
                    <Table
                        dataSource={templates}
                        columns={columns}
                        pagination={false}
                    />
                </Card>

                {/* Tips */}
                <div className="mt-6 p-4 bg-primary-50 rounded-lg">
                    <h4 className="font-medium text-primary-900 mb-2">Mẹo sử dụng:</h4>
                    <ul className="text-sm text-primary-800 space-y-1 list-disc list-inside">
                        <li>Gõ <code className="bg-white px-1 rounded">/</code> trong hộp chat để xem danh sách mẫu</li>
                        <li>Gõ shortcut (vd: <code className="bg-white px-1 rounded">/hi</code>) để chèn mẫu nhanh</li>
                        <li>Sử dụng biến như <code className="bg-white px-1 rounded">{"{{customer_name}}"}</code> để cá nhân hoá</li>
                    </ul>
                </div>
            </div>

            {/* Create Modal */}
            <Modal
                title="Tạo mẫu tin nhắn mới"
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                footer={[
                    <Button key="cancel" onClick={() => setModalVisible(false)}>Huỷ</Button>,
                    <Button key="save" type="primary">Lưu mẫu</Button>,
                ]}
            >
                <div className="space-y-4 py-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Tên mẫu</label>
                        <Input placeholder="VD: Chào mừng khách hàng" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Shortcut</label>
                        <Input prefix="/" placeholder="hi" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Nội dung</label>
                        <Input.TextArea rows={4} placeholder="Nhập nội dung mẫu tin nhắn..." />
                    </div>
                </div>
            </Modal>
        </SettingsLayout>
    );
};

export default TemplatesSettingsPage;
