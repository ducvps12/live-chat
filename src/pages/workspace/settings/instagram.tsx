import React from 'react';
import { Button, Card } from 'antd';
import { SettingsLayout } from '@/components/layout/SettingsLayout';

const InstagramSettingsPage: React.FC = () => {
    return (
        <SettingsLayout>
            <div className="max-w-4xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 rounded-lg flex items-center justify-center shadow-sm">
                                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                                </svg>
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-neutral-900">Instagram</h1>
                                <p className="text-sm text-neutral-500">Kết nối Instagram Business</p>
                            </div>
                        </div>
                    </div>
                    <Button type="primary" size="large" className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg">add</span>
                        Kết nối Instagram
                    </Button>
                </div>

                {/* Empty State */}
                <Card className="text-center py-16">
                    <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-tr from-yellow-100 via-pink-100 to-purple-100 rounded-full flex items-center justify-center">
                        <div className="w-14 h-14 bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                            <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073z" />
                            </svg>
                        </div>
                    </div>
                    <h3 className="text-lg font-semibold text-neutral-900 mb-2">Chưa có tài khoản Instagram nào được kết nối</h3>
                    <p className="text-neutral-500 mb-6 max-w-md mx-auto">
                        Kết nối Instagram Business để nhận tin nhắn DM từ khách hàng trực tiếp trong LiveChat
                    </p>
                    <Button type="primary" size="large" className="flex items-center gap-2 mx-auto">
                        <span className="material-symbols-outlined text-lg">link</span>
                        Kết nối Instagram đầu tiên
                    </Button>
                </Card>

                {/* Requirements */}
                <div className="mt-6 p-5 bg-purple-50 rounded-xl border border-purple-100">
                    <h4 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg">info</span>
                        Yêu cầu kết nối
                    </h4>
                    <ul className="text-sm text-purple-800 space-y-2 list-disc list-inside ml-1">
                        <li>Tài khoản Instagram Business hoặc Creator</li>
                        <li>Đã liên kết với Facebook Page</li>
                        <li>Có quyền quản lý Page đó</li>
                    </ul>
                </div>
            </div>
        </SettingsLayout>
    );
};

export default InstagramSettingsPage;

