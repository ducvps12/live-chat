import React, { useState, useMemo } from 'react';
import { Spin, Button, Modal, Form, Input, Select, DatePicker } from 'antd';
import { KanbanBoard } from '@/components/kanban';
import { useTickets, useCreateTicket, useUpdateTicketStatus } from '@/hooks/useTickets';
import { Ticket, STATUS_LABELS } from '@/services/tickets.service';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

const { TextArea } = Input;

// Stats configuration
const STATS_CONFIG = [
    { key: 'total', label: 'Tổng', icon: 'inventory_2', color: 'text-white', bgColor: 'bg-neutral-700/50' },
    { key: 'new', label: 'Mới', icon: 'add_box', color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
    { key: 'inProgress', label: 'Đang xử lý', icon: 'pending_actions', color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
    { key: 'waiting', label: 'Chờ phản hồi', icon: 'hourglass_empty', color: 'text-orange-400', bgColor: 'bg-orange-500/10' },
    { key: 'done', label: 'Hoàn thành', icon: 'task_alt', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
];

const KanbanPage: React.FC = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [form] = Form.useForm();

    const { data: tickets = [], isLoading, refetch } = useTickets();
    const createTicket = useCreateTicket();
    const updateStatus = useUpdateTicketStatus();

    // Calculate stats
    const stats = useMemo(() => ({
        total: tickets.length,
        new: tickets.filter(t => t.Status === 1).length,
        inProgress: tickets.filter(t => t.Status === 2).length,
        waiting: tickets.filter(t => t.Status === 3).length,
        done: tickets.filter(t => t.Status === 4).length,
    }), [tickets]);

    const handleStatusChange = async (ticketId: string, newStatus: number, newPosition: number) => {
        try {
            await updateStatus.mutateAsync({ ticketId, status: newStatus, position: newPosition });
        } catch (error) {
            // Error handled in hook
        }
    };

    const handleCardClick = (ticket: Ticket) => {
        setSelectedTicket(ticket);
        // TODO: Open detail modal
    };

    const handleAddClick = () => {
        setSelectedTicket(null);
        form.resetFields();
        setIsModalOpen(true);
    };

    const handleModalOk = async () => {
        try {
            const values = await form.validateFields();
            await createTicket.mutateAsync({
                title: values.title,
                description: values.description,
                type: values.type || 1,
                priority: values.priority || 2,
                dueDate: values.dueDate?.toISOString(),
            });
            setIsModalOpen(false);
            form.resetFields();
        } catch (error) {
            // Validation or API error
        }
    };

    if (isLoading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-64">
                    <Spin size="large" />
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="p-6 space-y-6">
                {/* Enhanced Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-500/25">
                            <span className="material-symbols-outlined text-white text-2xl">view_kanban</span>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Kanban Board</h1>
                            <p className="text-neutral-400 text-sm">Quản lý tickets và tasks của bạn</p>
                        </div>
                    </div>
                    <Button
                        type="primary"
                        size="large"
                        icon={<span className="material-symbols-outlined text-lg mr-1.5">add_circle</span>}
                        onClick={handleAddClick}
                        className="flex items-center h-11 px-5 rounded-xl shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 transition-shadow"
                    >
                        Tạo Ticket
                    </Button>
                </div>

                {/* Stats Overview Bar */}
                <div className="grid grid-cols-5 gap-4">
                    {STATS_CONFIG.map((stat) => (
                        <div
                            key={stat.key}
                            className={`${stat.bgColor} backdrop-blur-sm rounded-xl p-4 border border-neutral-800/50 
                                       hover:border-neutral-700 transition-all duration-200 cursor-default`}
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-neutral-400 text-xs font-medium uppercase tracking-wide">{stat.label}</p>
                                    <p className={`text-2xl font-bold ${stat.color} mt-1`}>
                                        {stats[stat.key as keyof typeof stats]}
                                    </p>
                                </div>
                                <div className={`w-10 h-10 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                                    <span className={`material-symbols-outlined ${stat.color} text-xl`}>{stat.icon}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Board */}
                <KanbanBoard
                    tickets={tickets}
                    onStatusChange={handleStatusChange}
                    onCardClick={handleCardClick}
                    onAddClick={handleAddClick}
                />

                {/* Enhanced Create/Edit Modal */}
                <Modal
                    title={
                        <div className="flex items-center gap-3 pb-2">
                            <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center">
                                <span className="material-symbols-outlined text-primary-400">
                                    {selectedTicket ? 'edit_note' : 'add_task'}
                                </span>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-white">
                                    {selectedTicket ? 'Chỉnh sửa Ticket' : 'Tạo Ticket mới'}
                                </h3>
                                <p className="text-neutral-400 text-xs">
                                    {selectedTicket ? 'Cập nhật thông tin ticket' : 'Điền thông tin để tạo ticket'}
                                </p>
                            </div>
                        </div>
                    }
                    open={isModalOpen}
                    onOk={handleModalOk}
                    onCancel={() => setIsModalOpen(false)}
                    okText={selectedTicket ? 'Cập nhật' : 'Tạo ticket'}
                    cancelText="Hủy"
                    confirmLoading={createTicket.isPending}
                    className="dark-modal"
                    width={520}
                >
                    <Form form={form} layout="vertical" className="mt-4 space-y-1">
                        <Form.Item
                            name="title"
                            label={<span className="text-neutral-300 font-medium">Tiêu đề</span>}
                            rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}
                        >
                            <Input
                                placeholder="Nhập tiêu đề ticket..."
                                className="h-11 rounded-lg"
                            />
                        </Form.Item>

                        <Form.Item
                            name="description"
                            label={<span className="text-neutral-300 font-medium">Mô tả</span>}
                        >
                            <TextArea
                                rows={3}
                                placeholder="Mô tả chi tiết về ticket..."
                                className="rounded-lg"
                            />
                        </Form.Item>

                        <div className="grid grid-cols-2 gap-4">
                            <Form.Item
                                name="type"
                                label={<span className="text-neutral-300 font-medium">Loại</span>}
                                initialValue={1}
                            >
                                <Select className="h-11">
                                    <Select.Option value={1}>
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-purple-400 text-sm">confirmation_number</span>
                                            Ticket
                                        </div>
                                    </Select.Option>
                                    <Select.Option value={2}>
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-emerald-400 text-sm">task_alt</span>
                                            Task
                                        </div>
                                    </Select.Option>
                                </Select>
                            </Form.Item>

                            <Form.Item
                                name="priority"
                                label={<span className="text-neutral-300 font-medium">Độ ưu tiên</span>}
                                initialValue={2}
                            >
                                <Select className="h-11">
                                    <Select.Option value={1}>
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-neutral-400 text-sm">keyboard_arrow_down</span>
                                            Low
                                        </div>
                                    </Select.Option>
                                    <Select.Option value={2}>
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-blue-400 text-sm">drag_handle</span>
                                            Medium
                                        </div>
                                    </Select.Option>
                                    <Select.Option value={3}>
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-orange-400 text-sm">keyboard_arrow_up</span>
                                            High
                                        </div>
                                    </Select.Option>
                                    <Select.Option value={4}>
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-red-400 text-sm">keyboard_double_arrow_up</span>
                                            Critical
                                        </div>
                                    </Select.Option>
                                </Select>
                            </Form.Item>
                        </div>

                        <Form.Item
                            name="dueDate"
                            label={<span className="text-neutral-300 font-medium">Hạn hoàn thành</span>}
                        >
                            <DatePicker
                                className="w-full h-11 rounded-lg"
                                placeholder="Chọn ngày"
                            />
                        </Form.Item>
                    </Form>
                </Modal>
            </div>
        </DashboardLayout>
    );
};

export default KanbanPage;
