import React from 'react';
import { Button, Card } from 'antd';
import { SettingsLayout } from '@/components/layout/SettingsLayout';

const ZaloSettingsPage: React.FC = () => {
    return (
        <SettingsLayout>
            <div className="max-w-4xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-[#0068FF] rounded-lg flex items-center justify-center shadow-sm">
                                <span className="text-white font-bold text-xs">Zalo</span>
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-neutral-900">Zalo OA</h1>
                                <p className="text-sm text-neutral-500">Kết nối Zalo Official Account</p>
                            </div>
                        </div>
                    </div>
                    <Button type="primary" size="large" className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg">add</span>
                        Kết nối Zalo OA
                    </Button>
                </div>

                {/* Empty State */}
                <Card className="text-center py-16">
                    <div className="w-24 h-24 mx-auto mb-6 bg-blue-50 rounded-full flex items-center justify-center">
                        <div className="w-14 h-14 bg-[#0068FF] rounded-xl flex items-center justify-center shadow-lg">
                            <span className="text-white font-bold text-sm">Zalo</span>
                        </div>
                    </div>
                    <h3 className="text-lg font-semibold text-neutral-900 mb-2">Chưa có Zalo OA nào được kết nối</h3>
                    <p className="text-neutral-500 mb-6 max-w-md mx-auto">
                        Kết nối Zalo Official Account để nhận tin nhắn từ khách hàng trực tiếp trong LiveChat
                    </p>
                    <Button type="primary" size="large" className="flex items-center gap-2 mx-auto">
                        <span className="material-symbols-outlined text-lg">link</span>
                        Kết nối Zalo OA đầu tiên
                    </Button>
                </Card>

                {/* Instructions */}
                <div className="mt-6 p-5 bg-blue-50 rounded-xl border border-blue-100">
                    <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg">info</span>
                        Hướng dẫn kết nối
                    </h4>
                    <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside ml-1">
                        <li>Đăng nhập Zalo với tài khoản quản trị OA</li>
                        <li>Chọn OA bạn muốn kết nối</li>
                        <li>Cấp quyền cho ứng dụng truy cập tin nhắn</li>
                        <li>Hoàn tất kết nối và bắt đầu nhận tin nhắn</li>
                    </ol>
                </div>
            </div>
        </SettingsLayout>
    );
};

export default ZaloSettingsPage;

