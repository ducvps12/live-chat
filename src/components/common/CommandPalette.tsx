import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { Modal, Input } from 'antd';

interface CommandItem {
    id: string;
    title: string;
    description?: string;
    icon: string;
    action: () => void;
    category: string;
}

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
    const router = useRouter();
    const [searchText, setSearchText] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<any>(null);

    const commands: CommandItem[] = [
        // Navigation
        { id: 'inbox', title: 'Đi tới Inbox', icon: 'inbox', action: () => router.push('/workspace/inbox'), category: 'Điều hướng' },
        { id: 'teams', title: 'Đi tới Teams', icon: 'groups', action: () => router.push('/workspace/teams'), category: 'Điều hướng' },
        { id: 'settings', title: 'Mở Cài đặt', icon: 'settings', action: () => router.push('/workspace/settings'), category: 'Điều hướng' },
        { id: 'website', title: 'Quản lý Website', icon: 'language', action: () => router.push('/workspace/settings/website'), category: 'Điều hướng' },
        { id: 'agents', title: 'Quản lý Agents', icon: 'support_agent', action: () => router.push('/workspace/settings/agents'), category: 'Điều hướng' },

        // Actions
        { id: 'new-conv', title: 'Tạo hội thoại mới', icon: 'add_comment', action: () => { }, category: 'Hành động' },
        { id: 'invite', title: 'Mời thành viên', icon: 'person_add', action: () => router.push('/workspace/teams'), category: 'Hành động' },
        { id: 'new-template', title: 'Tạo mẫu tin nhắn', icon: 'description', action: () => router.push('/workspace/settings/templates'), category: 'Hành động' },

        // Settings
        { id: 'facebook', title: 'Kết nối Facebook', icon: 'facebook', action: () => router.push('/workspace/settings/facebook'), category: 'Tích hợp' },
        { id: 'zalo', title: 'Kết nối Zalo OA', icon: 'chat', action: () => router.push('/workspace/settings/zalo'), category: 'Tích hợp' },
        { id: 'email', title: 'Cấu hình Email', icon: 'email', action: () => router.push('/workspace/settings/email'), category: 'Tích hợp' },
        { id: 'bot', title: 'Quản lý Bot', icon: 'smart_toy', action: () => router.push('/workspace/settings/bot'), category: 'Tích hợp' },

        // Profile
        { id: 'profile', title: 'Hồ sơ cá nhân', icon: 'person', action: () => router.push('/profile'), category: 'Tài khoản' },
        { id: 'logout', title: 'Đăng xuất', icon: 'logout', action: () => { }, category: 'Tài khoản' },
    ];

    const filteredCommands = commands.filter(cmd =>
        cmd.title.toLowerCase().includes(searchText.toLowerCase()) ||
        cmd.category.toLowerCase().includes(searchText.toLowerCase())
    );

    // Group by category
    const groupedCommands = filteredCommands.reduce((acc, cmd) => {
        if (!acc[cmd.category]) acc[cmd.category] = [];
        acc[cmd.category].push(cmd);
        return acc;
    }, {} as Record<string, CommandItem[]>);

    useEffect(() => {
        if (isOpen) {
            setSearchText('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(i => Math.max(i - 1, 0));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const cmd = filteredCommands[selectedIndex];
                if (cmd) {
                    cmd.action();
                    onClose();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, filteredCommands, selectedIndex, onClose]);

    let flatIndex = 0;

    return (
        <Modal
            open={isOpen}
            onCancel={onClose}
            footer={null}
            closable={false}
            width={600}
            className="command-palette-modal"
            style={{ top: 100 }}
        >
            <div className="bg-white rounded-lg overflow-hidden">
                {/* Search Input */}
                <div className="p-4 border-b border-neutral-200">
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-neutral-400">
                            search
                        </span>
                        <Input
                            ref={inputRef}
                            value={searchText}
                            onChange={(e) => { setSearchText(e.target.value); setSelectedIndex(0); }}
                            placeholder="Tìm kiếm lệnh..."
                            className="pl-10 py-2 text-base"
                            bordered={false}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-neutral-100 rounded text-xs text-neutral-500">ESC</kbd>
                        </div>
                    </div>
                </div>

                {/* Commands List */}
                <div className="max-h-80 overflow-y-auto">
                    {Object.entries(groupedCommands).map(([category, cmds]) => (
                        <div key={category}>
                            <div className="px-4 py-2 text-xs font-semibold text-neutral-400 uppercase tracking-wide bg-neutral-50">
                                {category}
                            </div>
                            {cmds.map((cmd) => {
                                const isSelected = flatIndex === selectedIndex;
                                flatIndex++;
                                return (
                                    <button
                                        key={cmd.id}
                                        onClick={() => { cmd.action(); onClose(); }}
                                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isSelected ? 'bg-primary-50 text-primary-700' : 'hover:bg-neutral-50'
                                            }`}
                                    >
                                        <span className={`material-symbols-outlined text-lg ${isSelected ? 'text-primary-600' : 'text-neutral-400'
                                            }`}>
                                            {cmd.icon}
                                        </span>
                                        <span className="flex-1 font-medium">{cmd.title}</span>
                                        {isSelected && (
                                            <kbd className="px-1.5 py-0.5 bg-primary-100 rounded text-xs text-primary-600">↵</kbd>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    ))}

                    {filteredCommands.length === 0 && (
                        <div className="p-8 text-center text-neutral-500">
                            <span className="material-symbols-outlined text-4xl mb-2 block">search_off</span>
                            Không tìm thấy lệnh nào
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-400">
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                            <kbd className="px-1 py-0.5 bg-neutral-100 rounded">↑</kbd>
                            <kbd className="px-1 py-0.5 bg-neutral-100 rounded">↓</kbd>
                            di chuyển
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1 py-0.5 bg-neutral-100 rounded">↵</kbd>
                            chọn
                        </span>
                    </div>
                    <span>⌘K để mở</span>
                </div>
            </div>
        </Modal>
    );
};

export default CommandPalette;
