import React, { useState, useEffect } from 'react';
import { useConversation } from '@/contexts/ConversationContext';
import { formatRelativeTime } from '@/utils/date';
import { Button, Input, Modal, message, DatePicker, Select } from 'antd';
import { updateVisitorContact } from '@/services/conversation.service';
import { useMyStore } from '@/contexts/MyStoreContext';

const { TextArea } = Input;

// Modal types
type ModalType = 'email' | 'phone' | 'reminder' | 'ticket' | 'note' | 'order' | null;

export const ContactSidebar = () => {
  const { selectedConversation, messages } = useConversation();
  const { activeWorkspace } = useMyStore();
  const [activeTab, setActiveTab] = useState<'customer' | 'ticket'>('customer');
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [isPotentialCustomer, setIsPotentialCustomer] = useState(false);
  const [loading, setLoading] = useState(false);

  // Local state for contact info (persisted in session only)
  const [localContactInfo, setLocalContactInfo] = useState({
    email: '',
    phone: '',
  });

  // Form states
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    reminderDate: null as any,
    reminderNote: '',
    ticketTitle: '',
    ticketContent: '',
    noteContent: '',
    orderNote: '',
  });

  // Get initials
  const getInitials = (name: string | null): string => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Get display name
  const getDisplayName = (): string => {
    if (!selectedConversation) return 'Visitor';
    return (
      selectedConversation.visitorName ||
      `Khách vãng lai #${selectedConversation.conversationKey || ''}`
    );
  };

  // Handle modal open
  const openModal = (type: ModalType) => {
    setActiveModal(type);
    // Pre-fill data if available from local state
    if (type === 'email' && localContactInfo.email) {
      setFormData(prev => ({ ...prev, email: localContactInfo.email }));
    }
    if (type === 'phone' && localContactInfo.phone) {
      setFormData(prev => ({ ...prev, phone: localContactInfo.phone }));
    }
  };

  // Handle modal close
  const closeModal = () => {
    setActiveModal(null);
  };

  // Handle form submit
  const handleSubmit = async () => {
    if (!selectedConversation) return;

    setLoading(true);
    try {
      switch (activeModal) {
        case 'email':
          if (!formData.email.trim()) {
            message.warning('Vui lòng nhập email');
            setLoading(false);
            return;
          }
          // Call API to save email
          if (activeWorkspace?.workspaceId && selectedConversation?.conversationId) {
            await updateVisitorContact(
              activeWorkspace.workspaceId,
              selectedConversation.conversationId,
              { email: formData.email.trim() }
            );
          }
          // Save to local state for immediate UI update
          setLocalContactInfo(prev => ({ ...prev, email: formData.email.trim() }));
          message.success('Đã cập nhật email!');
          break;

        case 'phone':
          if (!formData.phone.trim()) {
            message.warning('Vui lòng nhập số điện thoại');
            setLoading(false);
            return;
          }
          // Call API to save phone
          if (activeWorkspace?.workspaceId && selectedConversation?.conversationId) {
            await updateVisitorContact(
              activeWorkspace.workspaceId,
              selectedConversation.conversationId,
              { phone: formData.phone.trim() }
            );
          }
          // Save to local state for immediate UI update
          setLocalContactInfo(prev => ({ ...prev, phone: formData.phone.trim() }));
          message.success('Đã cập nhật số điện thoại!');
          break;

        case 'reminder':
          if (!formData.reminderNote.trim()) {
            message.warning('Vui lòng nhập nội dung nhắc việc');
            setLoading(false);
            return;
          }
          message.success('Đã tạo nhắc việc! (Demo)');
          break;

        case 'ticket':
          if (!formData.ticketTitle.trim()) {
            message.warning('Vui lòng nhập tiêu đề phiếu');
            setLoading(false);
            return;
          }
          message.success('Đã tạo phiếu ghi! (Demo)');
          break;

        case 'note':
          if (!formData.noteContent.trim()) {
            message.warning('Vui lòng nhập ghi chú');
            setLoading(false);
            return;
          }
          message.success('Đã thêm ghi chú!');
          break;

        case 'order':
          message.success('Đã tạo đơn hàng! (Demo)');
          break;
      }
      closeModal();
      // Reset form
      setFormData({
        email: '',
        phone: '',
        reminderDate: null,
        reminderNote: '',
        ticketTitle: '',
        ticketContent: '',
        noteContent: '',
        orderNote: '',
      });
    } catch (error) {
      message.error('Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setLoading(false);
    }
  };

  // Toggle potential customer
  const togglePotentialCustomer = async () => {
    if (!selectedConversation) return;

    const newState = !isPotentialCustomer;
    setIsPotentialCustomer(newState);

    // TODO: Add API support for marking potential customer
    message.success(newState ? 'Đã đánh dấu khách tiềm năng! ⭐ (Demo)' : 'Đã bỏ đánh dấu khách tiềm năng (Demo)');
  };

  // Render modal content based on type
  const renderModalContent = () => {
    switch (activeModal) {
      case 'email':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Email khách hàng</label>
              <Input
                placeholder="email@example.com"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                size="large"
              />
            </div>
          </div>
        );

      case 'phone':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Số điện thoại</label>
              <Input
                placeholder="0912 345 678"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                size="large"
              />
            </div>
          </div>
        );

      case 'reminder':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Thời gian nhắc</label>
              <DatePicker
                showTime
                className="w-full"
                placeholder="Chọn thời gian"
                value={formData.reminderDate}
                onChange={(date) => setFormData(prev => ({ ...prev, reminderDate: date }))}
                size="large"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Nội dung nhắc việc</label>
              <TextArea
                rows={3}
                placeholder="Nhập nội dung nhắc việc..."
                value={formData.reminderNote}
                onChange={(e) => setFormData(prev => ({ ...prev, reminderNote: e.target.value }))}
              />
            </div>
          </div>
        );

      case 'ticket':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Tiêu đề phiếu</label>
              <Input
                placeholder="VD: Yêu cầu báo giá sản phẩm X"
                value={formData.ticketTitle}
                onChange={(e) => setFormData(prev => ({ ...prev, ticketTitle: e.target.value }))}
                size="large"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Nội dung</label>
              <TextArea
                rows={4}
                placeholder="Mô tả chi tiết yêu cầu..."
                value={formData.ticketContent}
                onChange={(e) => setFormData(prev => ({ ...prev, ticketContent: e.target.value }))}
              />
            </div>
          </div>
        );

      case 'note':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Ghi chú về khách hàng</label>
              <TextArea
                rows={4}
                placeholder="VD: Khách quan tâm gói Enterprise, cần liên hệ lại sau 2 ngày..."
                value={formData.noteContent}
                onChange={(e) => setFormData(prev => ({ ...prev, noteContent: e.target.value }))}
              />
            </div>
          </div>
        );

      case 'order':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Sản phẩm/Dịch vụ</label>
              <Select
                className="w-full"
                placeholder="Chọn sản phẩm"
                size="large"
                options={[
                  { value: 'basic', label: 'Gói Basic - 99.000đ/tháng' },
                  { value: 'pro', label: 'Gói Pro - 299.000đ/tháng' },
                  { value: 'enterprise', label: 'Gói Enterprise - Liên hệ' },
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Ghi chú đơn hàng</label>
              <TextArea
                rows={3}
                placeholder="Ghi chú thêm..."
                value={formData.orderNote}
                onChange={(e) => setFormData(prev => ({ ...prev, orderNote: e.target.value }))}
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Get modal title
  const getModalTitle = () => {
    switch (activeModal) {
      case 'email': return '✉️ Cập nhật Email';
      case 'phone': return '📞 Cập nhật Số điện thoại';
      case 'reminder': return '🔔 Tạo nhắc việc mới';
      case 'ticket': return '📝 Tạo phiếu ghi mới';
      case 'note': return '✏️ Thêm ghi chú';
      case 'order': return '🛒 Tạo đơn hàng mới';
      default: return '';
    }
  };

  // Empty state
  if (!selectedConversation) {
    return (
      <div className="w-[320px] bg-white border-l border-neutral-200 flex flex-col flex-shrink-0 h-full items-center justify-center">
        <div className="text-center text-neutral-400 p-6">
          <span className="material-symbols-outlined text-5xl mb-3 block">person_outline</span>
          <p className="text-sm">Chọn hội thoại để xem chi tiết</p>
        </div>
      </div>
    );
  }

  const visitorName = getDisplayName();
  const visitorInitials = getInitials(selectedConversation.visitorName);
  const isOpen = selectedConversation.status === 1;
  const currentEmail = localContactInfo.email;
  const currentPhone = localContactInfo.phone;

  return (
    <>
      <div className="w-[320px] bg-white border-l border-neutral-200 flex flex-col flex-shrink-0 overflow-y-auto h-full">
        {/* Header with tabs */}
        <div className="flex border-b border-neutral-200">
          <button
            onClick={() => setActiveTab('customer')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'customer'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-neutral-500 hover:text-neutral-700'
              }`}
          >
            Khách
          </button>
          <button
            onClick={() => setActiveTab('ticket')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'ticket'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-neutral-500 hover:text-neutral-700'
              }`}
          >
            Phiếu
          </button>
        </div>

        {activeTab === 'customer' ? (
          <>
            {/* Profile header */}
            <div className="p-4 border-b border-neutral-100">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-cyan-500 text-white rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0">
                  {visitorInitials}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-neutral-900 truncate">{visitorName}</h3>
                  <p className="text-xs text-neutral-500">Website · {selectedConversation.widgetName || 'Live Chat'}</p>
                </div>
                <button className={`px-3 py-1 rounded text-xs font-medium ${isOpen ? 'bg-orange-100 text-orange-600' : 'bg-neutral-100 text-neutral-600'}`}>
                  {isOpen ? 'Đang mở' : 'Đã đóng'}
                </button>
              </div>
            </div>

            {/* Contact Info */}
            <div className="p-4 space-y-3 border-b border-neutral-100">
              {/* Email */}
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-neutral-400 text-lg">mail</span>
                <span className="text-sm text-neutral-600 flex-1">Email</span>
                <span
                  onClick={() => openModal('email')}
                  className="text-sm text-primary-600 cursor-pointer hover:underline"
                >
                  {currentEmail || 'Click để sửa'}
                </span>
              </div>

              {/* Phone */}
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-neutral-400 text-lg">call</span>
                <span className="text-sm text-neutral-600 flex-1">SĐT</span>
                <span
                  onClick={() => openModal('phone')}
                  className="text-sm text-primary-600 cursor-pointer hover:underline"
                >
                  {currentPhone || 'Click để sửa'}
                </span>
              </div>
            </div>

            {/* Assignment */}
            <div className="p-4 space-y-3 border-b border-neutral-100">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600">Nhãn</span>
                <span className="text-sm text-neutral-400">:</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600">Phụ trách</span>
                <div className="flex items-center gap-1">
                  <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                    <span className="text-white text-xs">H</span>
                  </div>
                  <span className="text-sm text-neutral-900">Hỗ Trợ Viên</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="p-4 space-y-2 border-b border-neutral-100">
              <button
                onClick={() => openModal('reminder')}
                className="w-full flex items-center justify-between py-2 px-3 hover:bg-neutral-50 rounded text-sm transition-colors"
              >
                <span className="flex items-center gap-2 text-neutral-600">
                  <span className="material-symbols-outlined text-lg">schedule</span>
                  Nhắc việc
                </span>
                <span className="text-primary-600">Tạo mới 🔔</span>
              </button>

              <button
                onClick={() => openModal('ticket')}
                className="w-full flex items-center justify-between py-2 px-3 hover:bg-neutral-50 rounded text-sm transition-colors"
              >
                <span className="flex items-center gap-2 text-neutral-600">
                  <span className="material-symbols-outlined text-lg">description</span>
                  Phiếu ghi
                </span>
                <span className="text-primary-600">Tạo mới 📝</span>
              </button>

              <button
                onClick={() => openModal('note')}
                className="w-full flex items-center justify-between py-2 px-3 hover:bg-neutral-50 rounded text-sm transition-colors"
              >
                <span className="flex items-center gap-2 text-neutral-600">
                  <span className="material-symbols-outlined text-lg">edit_note</span>
                  Ghi chú
                </span>
                <span className="text-primary-600">Thêm ghi chú ✏️</span>
              </button>

              <button
                onClick={() => openModal('order')}
                className="w-full flex items-center justify-between py-2 px-3 hover:bg-neutral-50 rounded text-sm transition-colors"
              >
                <span className="flex items-center gap-2 text-neutral-600">
                  <span className="material-symbols-outlined text-lg">shopping_cart</span>
                  Đơn hàng
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-neutral-400 text-xs">0</span>
                  <span className="text-primary-600">Tạo đơn 🛒</span>
                </div>
              </button>
            </div>

            {/* Conversation History */}
            <div className="p-4 flex-1">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-neutral-600">Lịch sử hội thoại</span>
                <span className="text-sm text-neutral-900 font-medium">1</span>
              </div>

              <div className="p-3 bg-neutral-50 rounded-lg">
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-neutral-400 text-lg">chat_bubble</span>
                  <div className="flex-1">
                    <p className="text-sm text-neutral-900 truncate">
                      {(selectedConversation as any).lastMessage || 'Đang xem website...'}
                    </p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {formatRelativeTime(selectedConversation.lastMessageAt || selectedConversation.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Ticket Tab Content */
          <div className="p-4 flex-1">
            <div className="text-center text-neutral-400 py-8">
              <span className="material-symbols-outlined text-4xl mb-2 block">description</span>
              <p className="text-sm">Chưa có phiếu ghi nào</p>
              <button
                onClick={() => openModal('ticket')}
                className="mt-3 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition-colors"
              >
                + Tạo phiếu mới
              </button>
            </div>
          </div>
        )}

        {/* Potential Customer Button */}
        <div className="p-4 border-t border-neutral-100">
          <button
            onClick={togglePotentialCustomer}
            className={`w-full py-2.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${isPotentialCustomer
              ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white shadow-lg'
              : 'bg-gradient-to-r from-amber-400 to-orange-400 text-white hover:from-amber-500 hover:to-orange-500'
              }`}
          >
            <span className="material-symbols-outlined text-lg">{isPotentialCustomer ? 'star' : 'star_outline'}</span>
            {isPotentialCustomer ? 'Đã đánh dấu tiềm năng ⭐' : 'Đánh dấu khách tiềm năng'}
          </button>
        </div>
      </div>

      {/* Modal */}
      <Modal
        title={getModalTitle()}
        open={activeModal !== null}
        onCancel={closeModal}
        footer={[
          <Button key="cancel" onClick={closeModal}>
            Hủy
          </Button>,
          <Button key="submit" type="primary" loading={loading} onClick={handleSubmit}>
            {activeModal === 'email' || activeModal === 'phone' ? 'Lưu' : 'Tạo mới'}
          </Button>,
        ]}
        destroyOnClose
      >
        {renderModalContent()}
      </Modal>
    </>
  );
};
