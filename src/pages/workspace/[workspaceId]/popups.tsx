import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState, useCallback, useMemo } from 'react';
import {
    Button, Form, Input, Select, Switch, Tabs, message,
    Empty, Spin, Tag, Drawer, Typography,
    InputNumber, Radio, Popconfirm,
} from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import {
    Plus, Trash2, Megaphone, PauseCircle, PlayCircle,
    Search, RefreshCw, LayoutTemplate, Activity, MousePointerClick,
    BadgePercent, CalendarDays, Clock3, Code2, Eye, FileText, Mail, Phone, ShoppingBag,
    Sparkles, Target, UsersRound, XCircle,
} from 'lucide-react';
import AppLayout from '../../../components/layout/AppLayout';
import { popupHttpService } from '../../../services/popup.service';

const { Text, Title } = Typography;

type PopupFieldType = 'text' | 'email' | 'phone' | 'button';
type PopupType = 'popup' | 'notification';
type PopupStatus = 'active' | 'paused';
type PopupTriggerMode = 'immediate' | 'delay' | 'scroll' | 'exit_intent';
type PopupFrequency = 'once' | 'every_visit' | 'every_day';

interface PopupFormField {
    type: PopupFieldType;
    label: string;
    placeholder?: string;
    required?: boolean;
}

interface PopupCustomCode {
    enabled?: boolean;
    html?: string;
    css?: string;
    js?: string;
}

interface PopupDesign {
    imageUrl?: string;
    width?: number;
    height?: number | 'auto';
    layout?: string;
    fields?: PopupFormField[];
    buttonText?: string;
    buttonColor?: string;
    customCode?: PopupCustomCode;
}

interface PopupThankYou {
    title?: string;
    message?: string;
    buttonText?: string;
    buttonUrl?: string;
}

interface PopupSettings {
    triggerMode?: PopupTriggerMode;
    triggerDelay?: number;
    scrollPercent?: number;
    frequency?: PopupFrequency;
    urlRules?: {
        domains: unknown[];
        paths: unknown[];
    };
}

interface PopupPayload {
    name: string;
    type: PopupType;
    category: string;
    status?: PopupStatus;
    design: PopupDesign;
    thankYou: PopupThankYou;
    settings: PopupSettings;
}

interface PopupTemplate {
    id: string;
    name: string;
    description: string;
    category: string;
    preview: {
        badge: string;
        headline: string;
        title: string;
        message: string;
        cta: string;
        theme: string;
        textColor: string;
        panel: string;
        panelText: string;
        imageMode: string;
        accent?: string;
    };
    meta?: {
        goal: string;
        bestFor: string;
        tone: string;
    };
    payload: PopupPayload;
}

interface PopupRecord extends PopupPayload {
    id?: string;
    _id?: string;
    stats?: {
        views?: number;
        submissions?: number;
        closes?: number;
    };
}

interface PopupFormValues {
    name: string;
    type?: PopupType;
    category?: string;
    designImageUrl?: string;
    designWidth?: number;
    designHeight?: number;
    designLayout?: string;
    designFields?: PopupFormField[];
    designButtonText?: string;
    designButtonColor?: string;
    customCodeEnabled?: boolean;
    customHtml?: string;
    customCss?: string;
    customJs?: string;
    thankYouTitle?: string;
    thankYouMessage?: string;
    thankYouButtonText?: string;
    thankYouButtonUrl?: string;
    triggerMode?: PopupTriggerMode;
    triggerDelay?: number;
    scrollPercent?: number;
    frequency?: PopupFrequency;
}

interface ApiError {
    response?: {
        data?: {
            error?: {
                message?: string;
            };
        };
    };
}

const CATEGORIES = [
    { key: 'all', label: 'Tất cả' },
    { key: 'tet', label: 'Tết Nguyên đán' },
    { key: 'quoc_khanh', label: 'Quốc khánh' },
    { key: '30_4', label: '30/4 - 1/5' },
    { key: '8_3', label: '8-3' },
    { key: 'giang_sinh', label: 'Giáng sinh' },
    { key: 'nam_moi', label: 'Năm mới' },
    { key: 'sale', label: 'Giảm giá' },
    { key: 'lead', label: 'Thu thập lead' },
    { key: 'general', label: 'Chung' },
];

const DEFAULT_POPUP: PopupPayload = {
    name: 'Popup mới',
    type: 'popup',
    category: 'general',
    status: 'paused',
    design: {
        imageUrl: '',
        width: 400,
        height: 600,
        layout: 'center',
        fields: [
            { type: 'email', label: 'Email', placeholder: 'Nhập Email', required: true },
            { type: 'phone', label: 'Số điện thoại', placeholder: 'Nhập số điện thoại' },
        ],
        buttonText: 'Đăng ký ngay',
        buttonColor: '#6366f1',
        customCode: {
            enabled: false,
            html: '',
            css: '',
            js: '',
        },
    },
    thankYou: {
        title: 'Cảm ơn bạn',
        message: 'Chúng tôi đã nhận thông tin và sẽ liên hệ sớm.',
    },
    settings: {
        triggerMode: 'delay',
        triggerDelay: 5,
        frequency: 'once',
        urlRules: { domains: [], paths: [] },
    },
};

const CUSTOM_CODE_STARTER_HTML = `<div class="nmk-offer">
  <p class="nmk-kicker">Ưu đãi hôm nay</p>
  <h2>Nhận tư vấn miễn phí</h2>
  <p>Để lại thông tin, đội ngũ sẽ liên hệ và gửi ưu đãi phù hợp.</p>
  <form>
    <input name="name" placeholder="Họ và tên" />
    <input name="phone" placeholder="Số điện thoại" required />
    <button type="submit">Gửi thông tin</button>
  </form>
</div>`;

const CUSTOM_CODE_STARTER_CSS = `.nmk-offer {
  width: min(420px, calc(100vw - 32px));
  padding: 28px;
  border-radius: 20px;
  background: linear-gradient(160deg, #0f172a 0%, #2563eb 100%);
  color: #ffffff;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.35);
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.nmk-kicker {
  margin: 0 0 10px;
  color: #bfdbfe;
  font-size: 13px;
  font-weight: 800;
  text-transform: uppercase;
}
.nmk-offer h2 {
  margin: 0 0 10px;
  font-size: 30px;
  line-height: 1.05;
}
.nmk-offer p {
  margin: 0 0 18px;
  color: #dbeafe;
  line-height: 1.55;
}
.nmk-offer form {
  display: grid;
  gap: 10px;
}
.nmk-offer input {
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 12px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
  outline: none;
}
.nmk-offer input::placeholder {
  color: rgba(255, 255, 255, 0.74);
}
.nmk-offer button {
  border: 0;
  border-radius: 12px;
  padding: 13px 16px;
  background: #facc15;
  color: #111827;
  font-weight: 900;
  cursor: pointer;
}`;

const CUSTOM_CODE_STARTER_JS = `console.log('NemarkChat custom popup ready');`;

const POPUP_TEMPLATES: PopupTemplate[] = [
    {
        id: 'tet-sale-2027',
        name: 'Tết 2027 - Săn sale',
        description: 'Popup ưu đãi Tết nổi bật để thu lead mua hàng đầu năm.',
        category: 'tet',
        preview: {
            badge: 'Sau 3s',
            headline: 'Chúc mừng năm mới',
            title: 'Lì xì ưu đãi Tết',
            message: 'Nhập số điện thoại để nhận mã giảm giá và quà tặng đầu xuân.',
            cta: 'Nhận lì xì ngay',
            theme: 'linear-gradient(180deg, #b91c1c 0%, #dc2626 100%)',
            textColor: '#fff7ed',
            panel: '#ffffff',
            panelText: '#7f1d1d',
            imageMode: 'sale',
        },
        meta: { goal: 'Thu lead mùa vụ', bestFor: 'E-commerce Tết', tone: 'Lễ hội' },
        payload: {
            name: 'Popup lì xì Tết',
            type: 'popup',
            category: 'tet',
            design: {
                imageUrl: '', width: 400, height: 566, layout: 'center',
                fields: [
                    { type: 'text', label: 'Họ và tên', placeholder: 'Nhập họ và tên' },
                    { type: 'phone', label: 'Số điện thoại', placeholder: 'Nhập số điện thoại', required: true },
                ],
                buttonText: 'Nhận lì xì ngay', buttonColor: '#f59e0b',
            },
            thankYou: {
                title: 'Chúc mừng năm mới',
                message: 'Chúng tôi sẽ gửi ưu đãi Tết cho bạn trong ít phút.',
            },
            settings: { triggerMode: 'delay', triggerDelay: 3, frequency: 'once' },
        },
    },
    {
        id: 'quoc-khanh-promo',
        name: 'Quốc khánh - Khuyến mãi',
        description: 'Mẫu popup nổi bật theo phong cách sale event giống Subiz.',
        category: 'quoc_khanh',
        preview: {
            badge: 'Sau 4s',
            headline: 'Chúc mừng',
            title: 'Ngày Quốc khánh',
            message: 'Săn sale hàng loạt deal hot, giảm giá đến 50% cùng nhiều quà tặng.',
            cta: 'Săn sale ngay',
            theme: 'linear-gradient(180deg, #b40d12 0%, #c61b1f 100%)',
            textColor: '#fff7cc',
            panel: '#ffffff',
            panelText: '#991b1b',
            imageMode: 'flag',
        },
        meta: { goal: 'Đẩy sale sự kiện', bestFor: 'Chiến dịch Quốc khánh', tone: 'Nổi bật' },
        payload: {
            name: 'Quốc khánh 2026 - Khuyến mãi',
            type: 'popup',
            category: 'quoc_khanh',
            design: {
                imageUrl: '', width: 400, height: 566, layout: 'center',
                fields: [
                    { type: 'text', label: 'Họ và tên', placeholder: 'Nhập họ và tên' },
                    { type: 'phone', label: 'Số điện thoại', placeholder: 'Nhập số điện thoại', required: true },
                ],
                buttonText: 'Săn sale ngay', buttonColor: '#facc15',
            },
            thankYou: {
                title: 'Đăng ký thành công',
                message: 'Ưu đãi Quốc khánh sẽ được gửi cho bạn ngay hôm nay.',
            },
            settings: { triggerMode: 'delay', triggerDelay: 4, frequency: 'once' },
        },
    },
    {
        id: 'holiday-announcement',
        name: 'Thông báo nghỉ lễ',
        description: 'Thông báo lịch nghỉ kèm form để khách để lại yêu cầu hỗ trợ.',
        category: '30_4',
        preview: {
            badge: 'Hiện ngay',
            headline: 'Thông báo',
            title: 'Lịch nghỉ lễ',
            message: 'Đội ngũ tạm nghỉ trong dịp lễ. Để lại thông tin để được hỗ trợ sớm nhất.',
            cta: 'Để lại yêu cầu',
            theme: 'linear-gradient(180deg, #d97706 0%, #ea580c 100%)',
            textColor: '#fff7ed',
            panel: '#fff7ed',
            panelText: '#9a3412',
            imageMode: 'notice',
        },
        meta: { goal: 'Thông báo vận hành', bestFor: 'Lịch nghỉ, hỗ trợ', tone: 'Rõ ràng' },
        payload: {
            name: 'Thông báo lịch nghỉ lễ',
            type: 'notification',
            category: '30_4',
            design: {
                imageUrl: '', width: 420, height: 520, layout: 'center',
                fields: [
                    { type: 'text', label: 'Họ và tên', placeholder: 'Nhập họ tên' },
                    { type: 'phone', label: 'Số điện thoại', placeholder: 'Số điện thoại để được hỗ trợ' },
                ],
                buttonText: 'Để lại yêu cầu', buttonColor: '#ea580c',
            },
            thankYou: {
                title: 'Đã ghi nhận',
                message: 'Đội ngũ sẽ phản hồi ngay khi làm việc trở lại.',
            },
            settings: { triggerMode: 'immediate', frequency: 'every_visit' },
        },
    },
    {
        id: 'womens-day-lead',
        name: 'Ưu đãi 8/3',
        description: 'Thu lead nhanh cho chiến dịch 8/3 với thiết kế mềm mại.',
        category: '8_3',
        preview: {
            badge: 'Sau 4s',
            headline: 'Quà tặng dịp 8/3',
            title: 'Ưu đãi đặc biệt',
            message: 'Đăng ký nhận ưu đãi và quà tặng gửi đến khách hàng nữ trong hôm nay.',
            cta: 'Nhận ưu đãi 8/3',
            theme: 'linear-gradient(180deg, #ec4899 0%, #f472b6 100%)',
            textColor: '#fff1f2',
            panel: '#ffffff',
            panelText: '#9d174d',
            imageMode: 'gift',
        },
        meta: { goal: 'Thu lead chiến dịch', bestFor: 'Quà tặng, ưu đãi', tone: 'Mềm mại' },
        payload: {
            name: 'Quà tặng dịp 8/3',
            type: 'popup',
            category: '8_3',
            design: {
                imageUrl: '', width: 420, height: 560, layout: 'center',
                fields: [
                    { type: 'text', label: 'Tên người nhận', placeholder: 'Nhập tên người nhận' },
                    { type: 'phone', label: 'Số điện thoại', placeholder: 'Nhập số điện thoại', required: true },
                ],
                buttonText: 'Nhận ưu đãi 8/3', buttonColor: '#db2777',
            },
            thankYou: {
                title: 'Yêu cầu đã được ghi nhận',
                message: 'Chúng tôi sẽ gửi quà tặng và thông tin ưu đãi sớm nhất.',
            },
            settings: { triggerMode: 'delay', triggerDelay: 4, frequency: 'once' },
        },
    },
    {
        id: 'christmas-lead',
        name: 'Giáng sinh - Thu lead',
        description: 'Popup chủ đề Noel dùng để đăng ký voucher cuối năm.',
        category: 'giang_sinh',
        preview: {
            badge: 'Cuộn 40%',
            headline: 'Merry Christmas',
            title: 'Nhận voucher Noel',
            message: 'Đăng ký để nhận khuyến mãi cuối năm và quà tặng cho đơn hàng tiếp theo.',
            cta: 'Nhận voucher',
            theme: 'linear-gradient(180deg, #0f766e 0%, #065f46 100%)',
            textColor: '#ecfeff',
            panel: '#f0fdf4',
            panelText: '#065f46',
            imageMode: 'gift',
        },
        meta: { goal: 'Kích hoạt voucher', bestFor: 'Chiến dịch cuối năm', tone: 'Ấm áp' },
        payload: {
            name: 'Voucher Giáng sinh',
            type: 'popup',
            category: 'giang_sinh',
            design: {
                imageUrl: '', width: 420, height: 560, layout: 'center',
                fields: [
                    { type: 'text', label: 'Họ và tên', placeholder: 'Nhập họ tên' },
                    { type: 'email', label: 'Email', placeholder: 'Nhập email', required: true },
                ],
                buttonText: 'Nhận voucher', buttonColor: '#047857',
            },
            thankYou: {
                title: 'Đăng ký thành công',
                message: 'Voucher Giáng sinh sẽ được gửi vào email của bạn.',
            },
            settings: { triggerMode: 'scroll', scrollPercent: 40, frequency: 'once' },
        },
    },
    {
        id: 'lead-capture-basic',
        name: 'Thu thập lead cơ bản',
        description: 'Mẫu chung cho landing page cần lấy email và số điện thoại.',
        category: 'lead',
        preview: {
            badge: 'Sau 5s',
            headline: 'Đừng bỏ lỡ',
            title: 'Nhận tư vấn miễn phí',
            message: 'Để lại email và số điện thoại để đội ngũ tư vấn liên hệ ngay hôm nay.',
            cta: 'Nhận tư vấn',
            theme: 'linear-gradient(180deg, #4f46e5 0%, #7c3aed 100%)',
            textColor: '#eef2ff',
            panel: '#ffffff',
            panelText: '#312e81',
            imageMode: 'form',
        },
        meta: { goal: 'Tư vấn nhanh', bestFor: 'Landing page lead', tone: 'Trực tiếp' },
        payload: {
            name: 'Form nhận tư vấn',
            type: 'popup',
            category: 'lead',
            design: {
                imageUrl: '', width: 420, height: 560, layout: 'center',
                fields: [
                    { type: 'text', label: 'Họ và tên', placeholder: 'Nhập họ và tên' },
                    { type: 'email', label: 'Email', placeholder: 'Nhập email', required: true },
                    { type: 'phone', label: 'Số điện thoại', placeholder: 'Nhập số điện thoại', required: true },
                ],
                buttonText: 'Nhận tư vấn', buttonColor: '#4f46e5',
            },
            thankYou: {
                title: 'Cảm ơn bạn',
                message: 'Đội ngũ sẽ liên hệ trong thời gian sớm nhất.',
            },
            settings: { triggerMode: 'delay', triggerDelay: 5, frequency: 'once' },
        },
    },
    {
        id: 'flash-sale-countdown',
        name: 'Flash sale - Đếm ngược',
        description: 'Tạo cảm giác khẩn cấp cho chiến dịch giảm giá ngắn giờ, hợp với landing page bán hàng.',
        category: 'sale',
        preview: {
            badge: 'Sau 2s',
            headline: 'Chỉ còn hôm nay',
            title: 'Flash sale 2 giờ',
            message: 'Giảm thêm 20% cho khách để lại số điện thoại trước khi mã ưu đãi hết hạn.',
            cta: 'Giữ mã giảm ngay',
            theme: 'linear-gradient(180deg, #111827 0%, #f97316 100%)',
            textColor: '#fff7ed',
            panel: '#fff7ed',
            panelText: '#9a3412',
            imageMode: 'countdown',
        },
        meta: { goal: 'Tăng chuyển đổi', bestFor: 'Landing page sale', tone: 'Khẩn cấp' },
        payload: {
            name: 'Flash sale đếm ngược',
            type: 'popup',
            category: 'sale',
            design: {
                imageUrl: '', width: 420, height: 560, layout: 'center',
                fields: [
                    { type: 'text', label: 'Họ và tên', placeholder: 'Nhập họ và tên' },
                    { type: 'phone', label: 'Số điện thoại', placeholder: 'Nhập số điện thoại', required: true },
                ],
                buttonText: 'Giữ mã giảm ngay', buttonColor: '#f97316',
            },
            thankYou: {
                title: 'Đã giữ mã ưu đãi',
                message: 'Mã giảm giá sẽ được gửi cho bạn trong ít phút.',
            },
            settings: { triggerMode: 'delay', triggerDelay: 2, frequency: 'once' },
        },
    },
    {
        id: 'exit-intent-voucher',
        name: 'Giữ khách rời trang',
        description: 'Bật khi khách chuẩn bị rời website, dùng để giữ lại lead bằng voucher hoặc tư vấn nhanh.',
        category: 'sale',
        preview: {
            badge: 'Rời trang',
            headline: 'Khoan đã',
            title: 'Nhận voucher trước khi đi',
            message: 'Để lại email để nhận ưu đãi riêng và quay lại mua hàng bất cứ lúc nào.',
            cta: 'Gửi voucher cho tôi',
            theme: 'linear-gradient(180deg, #0f172a 0%, #2563eb 100%)',
            textColor: '#eff6ff',
            panel: '#ffffff',
            panelText: '#1d4ed8',
            imageMode: 'coupon',
        },
        meta: { goal: 'Giảm thoát trang', bestFor: 'Checkout, pricing', tone: 'Thuyết phục' },
        payload: {
            name: 'Voucher giữ khách rời trang',
            type: 'popup',
            category: 'sale',
            design: {
                imageUrl: '', width: 420, height: 560, layout: 'center',
                fields: [
                    { type: 'email', label: 'Email', placeholder: 'Nhập email nhận voucher', required: true },
                    { type: 'phone', label: 'Số điện thoại', placeholder: 'Số điện thoại nếu cần tư vấn' },
                ],
                buttonText: 'Gửi voucher cho tôi', buttonColor: '#2563eb',
            },
            thankYou: {
                title: 'Voucher đang trên đường đến bạn',
                message: 'Kiểm tra email hoặc chờ đội ngũ tư vấn liên hệ.',
            },
            settings: { triggerMode: 'exit_intent', frequency: 'every_day' },
        },
    },
    {
        id: 'new-year-countdown',
        name: 'Năm mới - Countdown',
        description: 'Mẫu chúc mừng năm mới kèm CTA nhận ưu đãi sớm, phù hợp banner đầu năm.',
        category: 'nam_moi',
        preview: {
            badge: 'Hiện ngay',
            headline: 'Happy New Year',
            title: 'Ưu đãi đầu năm',
            message: 'Đăng ký sớm để nhận bộ mã ưu đãi và quà tặng cho đơn hàng đầu tiên.',
            cta: 'Nhận ưu đãi sớm',
            theme: 'linear-gradient(180deg, #1e3a8a 0%, #0ea5e9 100%)',
            textColor: '#ecfeff',
            panel: '#f0f9ff',
            panelText: '#075985',
            imageMode: 'sparkle',
        },
        meta: { goal: 'Kích hoạt khách cũ', bestFor: 'Trang chủ, chiến dịch đầu năm', tone: 'Tươi mới' },
        payload: {
            name: 'Ưu đãi đầu năm mới',
            type: 'popup',
            category: 'nam_moi',
            design: {
                imageUrl: '', width: 420, height: 560, layout: 'center',
                fields: [
                    { type: 'text', label: 'Họ và tên', placeholder: 'Nhập họ tên' },
                    { type: 'phone', label: 'Số điện thoại', placeholder: 'Nhập số điện thoại', required: true },
                ],
                buttonText: 'Nhận ưu đãi sớm', buttonColor: '#0ea5e9',
            },
            thankYou: {
                title: 'Chúc mừng năm mới',
                message: 'Ưu đãi đầu năm sẽ được gửi cho bạn ngay khi chiến dịch mở.',
            },
            settings: { triggerMode: 'immediate', frequency: 'every_visit' },
        },
    },
    {
        id: 'consultation-booking',
        name: 'Đặt lịch tư vấn',
        description: 'Thu lead chất lượng cao cho dịch vụ cần tư vấn, demo sản phẩm hoặc báo giá.',
        category: 'lead',
        preview: {
            badge: 'Cuộn 55%',
            headline: 'Cần tư vấn sâu hơn?',
            title: 'Đặt lịch với chuyên viên',
            message: 'Chọn kênh liên hệ để đội ngũ tư vấn gọi lại và chuẩn bị báo giá phù hợp.',
            cta: 'Đặt lịch tư vấn',
            theme: 'linear-gradient(180deg, #134e4a 0%, #14b8a6 100%)',
            textColor: '#ecfeff',
            panel: '#f0fdfa',
            panelText: '#0f766e',
            imageMode: 'calendar',
        },
        meta: { goal: 'Lead chất lượng', bestFor: 'SaaS, dịch vụ, B2B', tone: 'Chuyên nghiệp' },
        payload: {
            name: 'Form đặt lịch tư vấn',
            type: 'popup',
            category: 'lead',
            design: {
                imageUrl: '', width: 440, height: 580, layout: 'center',
                fields: [
                    { type: 'text', label: 'Họ và tên', placeholder: 'Nhập họ và tên', required: true },
                    { type: 'phone', label: 'Số điện thoại', placeholder: 'Nhập số điện thoại', required: true },
                    { type: 'email', label: 'Email công việc', placeholder: 'Nhập email' },
                ],
                buttonText: 'Đặt lịch tư vấn', buttonColor: '#0f766e',
            },
            thankYou: {
                title: 'Đã nhận lịch tư vấn',
                message: 'Chuyên viên sẽ liên hệ để xác nhận khung giờ phù hợp.',
            },
            settings: { triggerMode: 'scroll', scrollPercent: 55, frequency: 'once' },
        },
    },
    {
        id: 'customer-survey-lite',
        name: 'Khảo sát nhanh',
        description: 'Mẫu nhẹ để hỏi nhu cầu khách truy cập trước khi chuyển qua đội tư vấn.',
        category: 'general',
        preview: {
            badge: 'Sau 6s',
            headline: 'Giúp chúng tôi hiểu bạn',
            title: 'Bạn đang cần gì?',
            message: 'Để lại nhu cầu chính, đội ngũ sẽ gợi ý đúng sản phẩm hoặc tài liệu phù hợp.',
            cta: 'Gửi nhu cầu',
            theme: 'linear-gradient(180deg, #3f3f46 0%, #a855f7 100%)',
            textColor: '#faf5ff',
            panel: '#ffffff',
            panelText: '#6b21a8',
            imageMode: 'survey',
        },
        meta: { goal: 'Phân loại nhu cầu', bestFor: 'Trang chủ, blog, tài liệu', tone: 'Nhẹ nhàng' },
        payload: {
            name: 'Khảo sát nhu cầu khách truy cập',
            type: 'popup',
            category: 'general',
            design: {
                imageUrl: '', width: 420, height: 540, layout: 'center',
                fields: [
                    { type: 'text', label: 'Nhu cầu của bạn', placeholder: 'VD: cần báo giá, cần demo, cần hỗ trợ' },
                    { type: 'phone', label: 'Số điện thoại', placeholder: 'Số điện thoại để phản hồi', required: true },
                ],
                buttonText: 'Gửi nhu cầu', buttonColor: '#7c3aed',
            },
            thankYou: {
                title: 'Đã nhận nhu cầu',
                message: 'Đội ngũ sẽ phản hồi với gợi ý phù hợp nhất.',
            },
            settings: { triggerMode: 'delay', triggerDelay: 6, frequency: 'every_day' },
        },
    },
];

function buildDefaultFormValues(): PopupFormValues {
    return {
        name: DEFAULT_POPUP.name,
        type: DEFAULT_POPUP.type,
        category: DEFAULT_POPUP.category,
        designImageUrl: DEFAULT_POPUP.design.imageUrl,
        designWidth: 400,
        designHeight: 600,
        designLayout: DEFAULT_POPUP.design.layout,
        designFields: DEFAULT_POPUP.design.fields,
        designButtonText: 'Đăng ký ngay',
        designButtonColor: '#6366f1',
        customCodeEnabled: false,
        customHtml: '',
        customCss: '',
        customJs: '',
        thankYouTitle: 'Cảm ơn bạn',
        thankYouMessage: 'Chúng tôi đã nhận thông tin và sẽ liên hệ sớm.',
        triggerMode: 'delay',
        triggerDelay: 5,
        frequency: 'once',
    };
}

function buildTemplateFormValues(template: PopupTemplate): PopupFormValues {
    return {
        name: template.payload.name,
        type: template.payload.type,
        category: template.payload.category,
        designImageUrl: template.payload.design?.imageUrl || '',
        designWidth: template.payload.design?.width || 400,
        designHeight: getNumericHeight(template.payload.design?.height),
        designLayout: template.payload.design?.layout || 'center',
        designButtonText: template.payload.design?.buttonText || 'Đăng ký ngay',
        designButtonColor: template.payload.design?.buttonColor || '#6366f1',
        designFields: template.payload.design?.fields || [],
        customCodeEnabled: Boolean(template.payload.design?.customCode?.enabled),
        customHtml: template.payload.design?.customCode?.html || '',
        customCss: template.payload.design?.customCode?.css || '',
        customJs: template.payload.design?.customCode?.js || '',
        thankYouTitle: template.payload.thankYou?.title || 'Cảm ơn bạn',
        thankYouMessage: template.payload.thankYou?.message || '',
        thankYouButtonText: template.payload.thankYou?.buttonText || '',
        thankYouButtonUrl: template.payload.thankYou?.buttonUrl || '',
        triggerMode: template.payload.settings?.triggerMode || 'delay',
        triggerDelay: template.payload.settings?.triggerDelay || 5,
        scrollPercent: template.payload.settings?.scrollPercent,
        frequency: template.payload.settings?.frequency || 'once',
    };
}

function buildPopupPayload(values: PopupFormValues): PopupPayload {
    return {
        name: values.name,
        type: values.type || 'popup',
        category: values.category || 'general',
        design: {
            imageUrl: values.designImageUrl || '',
            width: values.designWidth || 400,
            height: values.designHeight || 600,
            layout: values.designLayout || 'center',
            fields: (values.designFields || []).filter((field) => field?.label),
            buttonText: values.designButtonText || 'Đăng ký ngay',
            buttonColor: values.designButtonColor || '#6366f1',
            customCode: {
                enabled: Boolean(values.customCodeEnabled),
                html: values.customHtml || '',
                css: values.customCss || '',
                js: values.customJs || '',
            },
        },
        thankYou: {
            title: values.thankYouTitle || 'Cảm ơn bạn',
            message: values.thankYouMessage || '',
            buttonText: values.thankYouButtonText || '',
            buttonUrl: values.thankYouButtonUrl || '',
        },
        settings: {
            triggerMode: values.triggerMode || 'delay',
            triggerDelay: values.triggerDelay || 5,
            scrollPercent: values.scrollPercent,
            frequency: values.frequency || 'once',
        },
    };
}

function buildTemplatePayload(template: PopupTemplate): PopupPayload {
    return JSON.parse(JSON.stringify({ ...template.payload, status: 'paused' })) as PopupPayload;
}

function getPopupId(popup?: Pick<PopupRecord, 'id' | '_id'> | null) {
    return popup?.id || popup?._id;
}

function getErrorMessage(error: unknown) {
    return (error as ApiError)?.response?.data?.error?.message || 'Có lỗi xảy ra';
}

function getNumericHeight(height?: number | 'auto') {
    return typeof height === 'number' ? height : 600;
}

function getCategoryLabel(categoryKey?: string) {
    return CATEGORIES.find((item) => item.key === categoryKey)?.label || 'Chung';
}

function normalizeText(value: string) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function getTriggerLabel(settings?: PopupSettings) {
    if (settings?.triggerMode === 'delay') return `Sau ${settings.triggerDelay || 5}s`;
    if (settings?.triggerMode === 'immediate') return 'Hiện ngay';
    if (settings?.triggerMode === 'scroll') return `Cuộn ${settings.scrollPercent || 40}%`;
    if (settings?.triggerMode === 'exit_intent') return 'Rời trang';
    return 'Theo cài đặt';
}

function getFieldIcon(type: PopupFieldType | string) {
    if (type === 'phone') return Phone;
    if (type === 'email') return Mail;
    return UsersRound;
}

function renderPreviewArtwork(mode: string, panelText: string) {
    if (mode === 'flag') {
        return (
            <div style={{
                height: 124,
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                position: 'relative',
            }}>
                <div style={{ width: 4, height: 92, background: '#f8fafc', borderRadius: 999 }} />
                <div style={{
                    position: 'absolute',
                    top: 10,
                    left: '50%',
                    transform: 'translateX(-10%) rotate(8deg)',
                    width: 122,
                    height: 82,
                    borderRadius: '10px 12px 8px 16px',
                    background: '#dc2626',
                    boxShadow: '0 10px 20px rgba(0,0,0,0.15)',
                }}>
                    <div style={{
                        position: 'absolute',
                        left: 46,
                        top: 22,
                        width: 28,
                        height: 28,
                        background: '#facc15',
                        clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
                    }} />
                </div>
            </div>
        );
    }

    if (mode === 'notice') {
        return (
            <div style={{ height: 124, paddingTop: 14 }}>
                <div style={{
                    margin: '0 auto',
                    width: 164,
                    background: 'rgba(255,255,255,0.16)',
                    border: '1px solid rgba(255,255,255,0.28)',
                    borderRadius: 14,
                    padding: 12,
                }}>
                    <div style={{ fontSize: 11, color: '#fff7ed', marginBottom: 8, textAlign: 'center' }}>LỊCH HOẠT ĐỘNG</div>
                    <div style={{ background: '#fff7ed', color: panelText, borderRadius: 8, padding: '6px 8px', fontWeight: 700, textAlign: 'center', marginBottom: 6 }}>30.04.2027</div>
                    <div style={{ background: '#fff7ed', color: panelText, borderRadius: 8, padding: '6px 8px', fontWeight: 700, textAlign: 'center' }}>03.05.2027</div>
                </div>
            </div>
        );
    }

    if (mode === 'gift') {
        return (
            <div style={{
                height: 124,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                <div style={{ position: 'relative', width: 112, height: 96 }}>
                    <div style={{
                        position: 'absolute',
                        bottom: 0,
                        width: 112,
                        height: 68,
                        borderRadius: 16,
                        background: 'rgba(255,255,255,0.22)',
                        border: '1px solid rgba(255,255,255,0.32)',
                    }} />
                    <div style={{ position: 'absolute', left: 49, bottom: 0, width: 14, height: 68, background: '#fde68a', borderRadius: 999 }} />
                    <div style={{ position: 'absolute', top: 22, left: 34, width: 20, height: 20, border: '8px solid #fde68a', borderRadius: '50% 50% 0 50%', transform: 'rotate(45deg)' }} />
                    <div style={{ position: 'absolute', top: 22, right: 34, width: 20, height: 20, border: '8px solid #fde68a', borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)' }} />
                </div>
            </div>
        );
    }

    if (mode === 'form') {
        return (
            <div style={{
                height: 124,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                <div style={{
                    width: 168,
                    background: 'rgba(255,255,255,0.16)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: 14,
                    padding: 12,
                }}>
                    <div style={{ height: 10, background: 'rgba(255,255,255,0.45)', borderRadius: 999, marginBottom: 8 }} />
                    <div style={{ height: 10, background: 'rgba(255,255,255,0.34)', borderRadius: 999, marginBottom: 8 }} />
                    <div style={{ height: 10, background: 'rgba(255,255,255,0.26)', borderRadius: 999, marginBottom: 12 }} />
                    <div style={{ height: 30, background: '#ffffff', borderRadius: 999 }} />
                </div>
            </div>
        );
    }

    if (mode === 'sale') {
        return (
            <div style={{
                height: 124,
                display: 'grid',
                placeItems: 'center',
            }}>
                <div style={{
                    width: 168,
                    minHeight: 90,
                    borderRadius: 16,
                    background: 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(255,255,255,0.88))',
                    border: '1px dashed rgba(245,158,11,0.65)',
                    color: panelText,
                    display: 'grid',
                    placeItems: 'center',
                    textAlign: 'center',
                    fontWeight: 900,
                    boxShadow: '0 12px 26px rgba(15,23,42,0.08)',
                }}>
                    <BadgePercent size={30} />
                    <div style={{ fontSize: 22, lineHeight: 1 }}>-20%</div>
                    <div style={{ fontSize: 11, fontWeight: 800 }}>Mã ưu đãi</div>
                </div>
            </div>
        );
    }

    if (mode === 'coupon') {
        return (
            <div style={{
                height: 124,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
            }}>
                <div style={{
                    width: 132,
                    borderRadius: 16,
                    padding: 12,
                    color: panelText,
                    background: 'linear-gradient(135deg, #eff6ff, #ffffff)',
                    border: '1px solid rgba(37,99,235,0.18)',
                    boxShadow: '0 12px 24px rgba(37,99,235,0.12)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontWeight: 900 }}>
                        <BadgePercent size={22} />
                        Voucher
                    </div>
                    <div style={{ height: 9, borderRadius: 999, background: 'rgba(37,99,235,0.18)', marginBottom: 7 }} />
                    <div style={{ height: 9, borderRadius: 999, background: 'rgba(37,99,235,0.12)', width: '72%' }} />
                </div>
                <ShoppingBag size={38} color={panelText} strokeWidth={1.8} />
            </div>
        );
    }

    if (mode === 'countdown') {
        return (
            <div style={{
                height: 124,
                display: 'grid',
                placeItems: 'center',
                color: panelText,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontWeight: 900 }}>
                    <Clock3 size={18} />
                    Kết thúc sau
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {['01', '42', '18'].map((item, index) => (
                        <div key={item} style={{
                            width: 44,
                            height: 48,
                            borderRadius: 12,
                            display: 'grid',
                            placeItems: 'center',
                            background: '#ffffff',
                            border: '1px solid rgba(154,52,18,0.12)',
                            boxShadow: '0 10px 20px rgba(15,23,42,0.08)',
                        }}>
                            <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1 }}>{item}</div>
                            <div style={{ fontSize: 9, fontWeight: 800, opacity: 0.7 }}>{['Giờ', 'Phút', 'Giây'][index]}</div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (mode === 'calendar') {
        return (
            <div style={{
                height: 124,
                display: 'grid',
                placeItems: 'center',
                color: panelText,
            }}>
                <div style={{
                    width: 150,
                    borderRadius: 16,
                    overflow: 'hidden',
                    background: '#ffffff',
                    border: '1px solid rgba(15,118,110,0.18)',
                    boxShadow: '0 12px 24px rgba(15,118,110,0.12)',
                }}>
                    <div style={{ height: 32, background: '#0f766e', color: '#ecfeff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 12, fontWeight: 900 }}>
                        <CalendarDays size={15} />
                        Tư vấn
                    </div>
                    <div style={{ padding: 12 }}>
                        <div style={{ height: 10, borderRadius: 999, background: 'rgba(15,118,110,0.18)', marginBottom: 8 }} />
                        <div style={{ height: 10, borderRadius: 999, background: 'rgba(15,118,110,0.12)', width: '68%' }} />
                    </div>
                </div>
            </div>
        );
    }

    if (mode === 'sparkle') {
        return (
            <div style={{
                height: 124,
                display: 'grid',
                placeItems: 'center',
                color: panelText,
            }}>
                <div style={{ position: 'relative', width: 156, height: 96 }}>
                    <Sparkles size={34} style={{ position: 'absolute', left: 0, top: 4 }} />
                    <Sparkles size={22} style={{ position: 'absolute', right: 4, top: 8 }} />
                    <div style={{
                        position: 'absolute',
                        left: 20,
                        right: 20,
                        bottom: 0,
                        borderRadius: 18,
                        padding: '16px 12px',
                        background: 'rgba(255,255,255,0.82)',
                        boxShadow: '0 12px 26px rgba(14,165,233,0.14)',
                        textAlign: 'center',
                        fontWeight: 900,
                    }}>
                        2027
                    </div>
                </div>
            </div>
        );
    }

    if (mode === 'survey') {
        return (
            <div style={{
                height: 124,
                display: 'grid',
                placeItems: 'center',
                color: panelText,
            }}>
                <div style={{
                    width: 168,
                    borderRadius: 16,
                    padding: 12,
                    background: '#ffffff',
                    border: '1px solid rgba(124,58,237,0.18)',
                    boxShadow: '0 12px 24px rgba(124,58,237,0.12)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 900, marginBottom: 10 }}>
                        <FileText size={18} />
                        Nhu cầu
                    </div>
                    {[92, 76, 58].map((width) => (
                        <div key={width} style={{ height: 10, borderRadius: 999, background: 'rgba(124,58,237,0.12)', marginBottom: 7, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${width}%`, borderRadius: 999, background: 'rgba(124,58,237,0.42)' }} />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div style={{
            height: 124,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        }}>
            <div style={{
                width: 162,
                padding: 16,
                borderRadius: 16,
                background: 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.28)',
                color: '#fff',
                textAlign: 'center',
                fontWeight: 700,
            }}>
                Ưu đãi đặc biệt
            </div>
        </div>
    );
}

function buildCustomCodeDocument(html?: string, css?: string, js?: string) {
    const safeJs = (js || '').replace(/<\/script/gi, '<\\/script');
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
html, body {
  margin: 0;
  min-height: 100%;
  background: transparent;
}
body {
  display: grid;
  place-items: center;
  padding: 20px;
  box-sizing: border-box;
}
*, *::before, *::after {
  box-sizing: border-box;
}
${css || ''}
</style>
</head>
<body>
${html || '<div style="font: 14px sans-serif; color: #64748b;">Bật custom code rồi dán HTML/CSS để xem preview.</div>'}
<script>
${safeJs}
</script>
</body>
</html>`;
}

function CustomCodePreview({
    enabled,
    html,
    css,
    js,
}: {
    enabled?: boolean;
    html?: string;
    css?: string;
    js?: string;
}) {
    return (
        <div className="popup-code-preview">
            <div className="popup-code-preview-header">
                <span>Live preview</span>
                <Tag color={enabled ? 'green' : 'default'}>{enabled ? 'Đang bật' : 'Đang tắt'}</Tag>
            </div>
            <iframe
                title="Custom popup preview"
                sandbox="allow-scripts allow-forms allow-popups"
                srcDoc={buildCustomCodeDocument(html, css, js)}
            />
        </div>
    );
}

function TemplateCard({
    template,
    loading,
    onUse,
    onCustomize,
}: {
    template: PopupTemplate;
    loading: boolean;
    onUse: (template: PopupTemplate) => void;
    onCustomize: (template: PopupTemplate) => void;
}) {
    const fields = template.payload.design?.fields || [];
    const triggerLabel = getTriggerLabel(template.payload.settings);
    const accentColor = template.preview.accent || template.payload.design?.buttonColor || '#4f46e5';
    const ctaTextColor = ['#facc15', '#f59e0b'].includes(accentColor) ? '#111827' : '#ffffff';
    const requiredCount = fields.filter((field) => field.required).length;
    const categoryLabel = getCategoryLabel(template.category);

    return (
        <article
            className="popup-template-card popup-template-card-v2"
            style={{ '--template-accent': accentColor } as React.CSSProperties}
        >
            <div className="popup-template-preview-stage">
                <div
                    className="popup-template-preview-frame"
                    style={{
                        background: template.preview.theme,
                        color: template.preview.textColor,
                    }}
                >
                    <div className="popup-template-preview-gloss" />
                    <div className="popup-template-preview-top">
                        <span>
                            <Clock3 size={12} />
                            {template.preview.badge}
                        </span>
                        <span className="popup-template-close">×</span>
                    </div>

                    <div className="popup-template-copy">
                        <div className="popup-template-eyebrow">{template.preview.headline}</div>
                        <h3>{template.preview.title}</h3>
                        <p>{template.preview.message}</p>
                    </div>

                    <div className="popup-template-preview-cta" style={{ background: accentColor, color: ctaTextColor }}>
                        {template.preview.cta}
                    </div>

                    <div className="popup-template-art-panel" style={{ background: template.preview.panel, color: template.preview.panelText }}>
                        <div className="popup-template-art-scale">
                            {renderPreviewArtwork(template.preview.imageMode, template.preview.panelText)}
                        </div>
                    </div>
                </div>
                <span className="popup-template-category">{categoryLabel}</span>
            </div>

            <div className="popup-template-body">
                <div className="popup-template-heading">
                    <div>
                        <Text strong className="popup-template-title">{template.name}</Text>
                        <div className="popup-template-goal">
                            <Target size={14} color={accentColor} />
                            <span>{template.meta?.goal || 'Sẵn sàng tùy chỉnh'}</span>
                        </div>
                    </div>
                    <span className="popup-template-type">
                        {template.payload.type === 'notification' ? 'Thông báo' : 'Popup'}
                    </span>
                </div>

                <p className="popup-template-description">{template.description}</p>

                <div className="popup-template-meta-grid">
                    <div>
                        <span>Lịch chạy</span>
                        <strong>{triggerLabel}</strong>
                    </div>
                    <div>
                        <span>Form</span>
                        <strong>{fields.length} trường</strong>
                    </div>
                    <div>
                        <span>Bắt buộc</span>
                        <strong>{requiredCount || 0}</strong>
                    </div>
                </div>

                <div className="popup-template-tags">
                    {template.meta?.bestFor && <Tag>{template.meta.bestFor}</Tag>}
                    {template.meta?.tone && <Tag>{template.meta.tone}</Tag>}
                </div>

                <div className="popup-template-field-list">
                    {fields.slice(0, 3).map((field) => {
                        const FieldIcon = getFieldIcon(field.type);
                        return (
                            <div key={`${template.id}-${field.label}`}>
                                <FieldIcon size={14} color={accentColor} />
                                <span>{field.label}</span>
                                {field.required && <strong>*</strong>}
                            </div>
                        );
                    })}
                    {fields.length > 3 && (
                        <div>
                            <FileText size={14} color={accentColor} />
                            <span>+{fields.length - 3} trường khác</span>
                        </div>
                    )}
                </div>

                <div className="popup-template-actions">
                    <Button type="primary" icon={<Sparkles size={15} />} loading={loading} onClick={() => onUse(template)}>
                        Dùng mẫu
                    </Button>
                    <Button icon={<LayoutTemplate size={15} />} onClick={() => onCustomize(template)}>
                        Chỉnh trước
                    </Button>
                </div>
            </div>
        </article>
    );
}

function PopupCard({
    popup,
    onOpen,
    onToggle,
    onDelete,
}: {
    popup: PopupRecord;
    onOpen: (popup: PopupRecord) => void;
    onToggle: (popup: PopupRecord) => void;
    onDelete: (id: string) => void;
}) {
    const popupId = getPopupId(popup);
    const stats = [
        { label: 'Lượt xem', value: popup.stats?.views || 0, icon: Eye },
        { label: 'Form', value: popup.stats?.submissions || 0, icon: FileText },
        { label: 'Đóng', value: popup.stats?.closes || 0, icon: XCircle },
    ];

    return (
        <div
            onClick={() => onOpen(popup)}
            style={{
                background: '#fff',
                borderRadius: 8,
                border: '1px solid #dde4ef',
                overflow: 'hidden',
                boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 10px 24px rgba(16,24,40,0.05)',
                cursor: 'pointer',
            }}
        >
            <div style={{
                height: 180,
                background: popup.design?.imageUrl
                    ? `url(${popup.design.imageUrl}) center/cover`
                    : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
            }}>
                {!popup.design?.imageUrl && <Megaphone size={46} />}
            </div>
            <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <Text strong style={{ fontSize: 16 }}>{popup.name}</Text>
                    <Tag color={popup.status === 'active' ? 'green' : 'default'} style={{ borderRadius: 999, marginInlineEnd: 0 }}>
                        {popup.status === 'active' ? 'Đang chạy' : 'Tạm dừng'}
                    </Tag>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#64748b', marginBottom: 12, flexWrap: 'wrap' }}>
                    {stats.map((item) => {
                        const Icon = item.icon;
                        return (
                            <span key={item.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700 }}>
                                <Icon size={13} />
                                {item.value} {item.label}
                            </span>
                        );
                    })}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <Button
                        size="small"
                        type={popup.status === 'active' ? 'default' : 'primary'}
                        icon={popup.status === 'active' ? <PauseCircle size={12} /> : <PlayCircle size={12} />}
                        onClick={(e) => { e.stopPropagation(); onToggle(popup); }}
                        style={{ borderRadius: 8, flex: 1 }}
                    >
                        {popup.status === 'active' ? 'Dừng' : 'Bật'}
                    </Button>
                    <Popconfirm title="Xóa popup này?" onConfirm={(e) => { e?.stopPropagation(); if (popupId) onDelete(popupId); }} onCancel={(e) => e?.stopPropagation()}>
                        <Button size="small" danger icon={<Trash2 size={12} />} onClick={(e) => e.stopPropagation()} style={{ borderRadius: 8 }} />
                    </Popconfirm>
                </div>
            </div>
        </div>
    );
}

export default function PopupsPage() {
    const router = useRouter();
    const { workspaceId } = router.query;

    const [popups, setPopups] = useState<PopupRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editing, setEditing] = useState<PopupRecord | null>(null);
    const [saving, setSaving] = useState(false);
    const [templateCreating, setTemplateCreating] = useState<string | null>(null);
    const [form] = Form.useForm<PopupFormValues>();
    const [activeCategory, setActiveCategory] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');

    const fetchPopups = useCallback(async () => {
        if (!workspaceId) return;
        setLoading(true);
        try {
            const res = await popupHttpService.getByWorkspace(workspaceId as string);
            if (res.success) setPopups((res.data as PopupRecord[]) || []);
        } catch {
        }
        setLoading(false);
    }, [workspaceId]);

    useEffect(() => {
        fetchPopups();
    }, [fetchPopups]);

    const openCreate = () => {
        setEditing(null);
        form.resetFields();
        form.setFieldsValue(buildDefaultFormValues());
        setDrawerOpen(true);
    };

    const openCreateFromTemplate = (template: PopupTemplate) => {
        setEditing(null);
        form.resetFields();
        form.setFieldsValue(buildTemplateFormValues(template));
        setDrawerOpen(true);
        message.success('Đã nạp mẫu vào form. Bạn có thể chỉnh sửa trước khi lưu.');
    };

    const openEdit = (popup: PopupRecord) => {
        setEditing(popup);
        form.setFieldsValue({
            name: popup.name,
            type: popup.type,
            category: popup.category,
            designImageUrl: popup.design?.imageUrl || '',
            designWidth: popup.design?.width || 400,
            designHeight: getNumericHeight(popup.design?.height),
            designLayout: popup.design?.layout || 'center',
            designButtonText: popup.design?.buttonText || 'Đăng ký ngay',
            designButtonColor: popup.design?.buttonColor || '#6366f1',
            designFields: popup.design?.fields || [],
            customCodeEnabled: Boolean(popup.design?.customCode?.enabled),
            customHtml: popup.design?.customCode?.html || '',
            customCss: popup.design?.customCode?.css || '',
            customJs: popup.design?.customCode?.js || '',
            thankYouTitle: popup.thankYou?.title || '',
            thankYouMessage: popup.thankYou?.message || '',
            thankYouButtonText: popup.thankYou?.buttonText || '',
            thankYouButtonUrl: popup.thankYou?.buttonUrl || '',
            triggerMode: popup.settings?.triggerMode || 'delay',
            triggerDelay: popup.settings?.triggerDelay || 5,
            scrollPercent: popup.settings?.scrollPercent,
            frequency: popup.settings?.frequency || 'once',
        });
        setDrawerOpen(true);
    };

    const handleSave = async (values: PopupFormValues) => {
        setSaving(true);
        try {
            const payload = buildPopupPayload(values);
            if (editing) {
                const popupId = getPopupId(editing);
                if (!popupId) throw new Error('Không tìm thấy ID popup');
                await popupHttpService.update(workspaceId as string, popupId, payload);
                message.success('Đã cập nhật popup!');
            } else {
                await popupHttpService.create(workspaceId as string, payload);
                message.success('Đã tạo popup!');
            }
            setDrawerOpen(false);
            fetchPopups();
        } catch (err: unknown) {
            message.error(getErrorMessage(err));
        }
        setSaving(false);
    };

    const handleCreateFromTemplate = async (template: PopupTemplate) => {
        if (!workspaceId) return;
        setTemplateCreating(template.id);
        try {
            await popupHttpService.create(workspaceId as string, buildTemplatePayload(template));
            message.success('Đã tạo popup từ template!');
            fetchPopups();
        } catch (err: unknown) {
            message.error(getErrorMessage(err));
        }
        setTemplateCreating(null);
    };

    const handleToggleStatus = async (popup: PopupRecord) => {
        const newStatus = popup.status === 'active' ? 'paused' : 'active';
        try {
            const popupId = getPopupId(popup);
            if (!popupId) throw new Error('Không tìm thấy ID popup');
            await popupHttpService.update(workspaceId as string, popupId, { status: newStatus });
            message.success(newStatus === 'active' ? 'Đã kích hoạt!' : 'Đã tạm dừng!');
            fetchPopups();
        } catch {
            message.error('Lỗi');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            if (!id) throw new Error('Không tìm thấy ID popup');
            await popupHttpService.deletePopup(workspaceId as string, id);
            message.success('Đã xóa!');
            fetchPopups();
        } catch {
            message.error('Lỗi');
        }
    };

    const normalizedSearch = normalizeText(searchTerm.trim());

    const popupStats = useMemo(() => {
        const active = popups.filter((popup) => popup.status === 'active').length;
        const views = popups.reduce((sum, popup) => sum + (popup.stats?.views || 0), 0);
        const submissions = popups.reduce((sum, popup) => sum + (popup.stats?.submissions || 0), 0);
        const conversionRate = views > 0 ? Math.round((submissions / views) * 100) : 0;

        return {
            total: popups.length,
            active,
            paused: Math.max(popups.length - active, 0),
            views,
            submissions,
            conversionRate,
        };
    }, [popups]);

    const visibleTemplates = useMemo(() => {
        return POPUP_TEMPLATES.filter((template) => {
            if (activeCategory !== 'all' && template.category !== activeCategory) return false;
            if (!normalizedSearch) return true;
            const categoryLabel = CATEGORIES.find((item) => item.key === template.category)?.label || '';
            return normalizeText(`${template.name} ${template.description} ${categoryLabel} ${template.meta?.goal || ''} ${template.meta?.bestFor || ''}`).includes(normalizedSearch);
        });
    }, [activeCategory, normalizedSearch]);

    const filteredPopups = useMemo(() => {
        return popups.filter((popup) => {
            if (activeCategory !== 'all' && popup.category !== activeCategory) return false;
            if (statusFilter !== 'all' && popup.status !== statusFilter) return false;
            if (!normalizedSearch) return true;
            const categoryLabel = CATEGORIES.find((item) => item.key === popup.category)?.label || '';
            return normalizeText(`${popup.name || ''} ${popup.type || ''} ${categoryLabel}`).includes(normalizedSearch);
        });
    }, [activeCategory, normalizedSearch, popups, statusFilter]);

    if (!workspaceId) return <AppLayout><Spin /></AppLayout>;

    return (
        <AppLayout>
            <Head><title>Tiện ích Web</title></Head>

            <div className="popup-workbench" style={{ maxWidth: 1480, margin: '0 auto', padding: '28px 28px 44px' }}>
                <div className="popup-page-header popup-hero" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, marginBottom: 18 }}>
                    <div className="popup-hero-copy">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                            <span style={{ width: 38, height: 38, borderRadius: 8, display: 'grid', placeItems: 'center', background: '#eef2ff', color: '#4f46e5' }}>
                                <Sparkles size={22} />
                            </span>
                            <h1 style={{ fontSize: 40, fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: 0 }}>
                                Tiện ích Web
                            </h1>
                        </div>
                        <p style={{ color: '#64748b', fontSize: 16, margin: 0 }}>
                            Chọn template popup theo phong cách Subiz, sau đó tinh chỉnh và xuất bản cho workspace của bạn.
                        </p>
                        <div className="popup-flow-steps">
                            {[
                                { label: 'Chọn mẫu', icon: LayoutTemplate },
                                { label: 'Tùy chỉnh form', icon: FileText },
                                { label: 'Xuất bản', icon: Megaphone },
                            ].map((step, index) => {
                                const Icon = step.icon;
                                return (
                                    <div key={step.label}>
                                        <span>{index + 1}</span>
                                        <Icon size={15} />
                                        {step.label}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className="popup-hero-actions">
                        <Button
                            type="primary"
                            icon={<Plus size={16} />}
                            onClick={openCreate}
                            style={{
                                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                                border: 'none',
                                borderRadius: 8,
                                height: 48,
                                fontWeight: 700,
                                paddingInline: 24,
                                boxShadow: '0 12px 28px rgba(79,70,229,0.28)',
                            }}
                        >
                            Tạo popup thủ công
                        </Button>
                        <div className="popup-hero-note">
                            <strong>{POPUP_TEMPLATES.length}</strong> template có sẵn
                        </div>
                    </div>
                </div>

                <div className="popup-stats-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 12,
                    marginBottom: 16,
                }}>
                    {[
                        { label: 'Popup đang chạy', value: popupStats.active, sub: `${popupStats.paused} tạm dừng`, icon: Activity, color: '#0f766e', bg: '#ecfdf5' },
                        { label: 'Template sẵn dùng', value: POPUP_TEMPLATES.length, sub: `${visibleTemplates.length} phù hợp bộ lọc`, icon: LayoutTemplate, color: '#4f46e5', bg: '#eef2ff' },
                        { label: 'Lượt xem', value: popupStats.views, sub: `${popupStats.submissions} form đã gửi`, icon: MousePointerClick, color: '#0369a1', bg: '#e0f2fe' },
                        { label: 'Tỷ lệ gửi form', value: `${popupStats.conversionRate}%`, sub: `${popupStats.total} popup đã tạo`, icon: Megaphone, color: '#b45309', bg: '#fffbeb' },
                    ].map((item) => {
                        const Icon = item.icon;
                        return (
                            <div
                                key={item.label}
                                className="popup-stat-card"
                                style={{
                                    background: '#fff',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: 8,
                                    padding: 16,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 12,
                                    boxShadow: '0 10px 30px rgba(15,23,42,0.04)',
                                }}
                            >
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0 }}>
                                        {item.label}
                                    </div>
                                    <div style={{ marginTop: 6, fontSize: 26, lineHeight: 1, color: '#0f172a', fontWeight: 900 }}>
                                        {item.value}
                                    </div>
                                    <div style={{ marginTop: 7, fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                                        {item.sub}
                                    </div>
                                </div>
                                <div style={{ width: 42, height: 42, borderRadius: 8, display: 'grid', placeItems: 'center', background: item.bg, color: item.color, flexShrink: 0 }}>
                                    <Icon size={20} />
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="popup-toolbar" style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    marginBottom: 24,
                    flexWrap: 'wrap',
                }}>
                    <Input
                        allowClear
                        prefix={<Search size={16} color="#94a3b8" />}
                        placeholder="Tìm template hoặc popup đã tạo..."
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        style={{ height: 44, maxWidth: 520, borderRadius: 8, flex: '1 1 320px' }}
                    />
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {[
                            { key: 'all', label: 'Tất cả' },
                            { key: 'active', label: 'Đang chạy' },
                            { key: 'paused', label: 'Tạm dừng' },
                        ].map((item) => (
                            <button
                                key={item.key}
                                type="button"
                                className={`popup-status-pill ${statusFilter === item.key ? 'is-active' : ''}`}
                                onClick={() => setStatusFilter(item.key as typeof statusFilter)}
                                style={{
                                    height: 36,
                                    padding: '0 13px',
                                    borderRadius: 999,
                                    border: statusFilter === item.key ? '1px solid #4f46e5' : '1px solid #e5e7eb',
                                    background: statusFilter === item.key ? '#eef2ff' : '#fff',
                                    color: statusFilter === item.key ? '#4338ca' : '#475569',
                                    fontSize: 13,
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                }}
                            >
                                {item.label}
                            </button>
                        ))}
                        <Button
                            icon={<RefreshCw size={15} />}
                            onClick={fetchPopups}
                            loading={loading}
                            style={{ height: 36, borderRadius: 999, fontWeight: 800 }}
                        >
                            Làm mới
                        </Button>
                    </div>
                </div>

                <div className="popup-content-grid" style={{ display: 'grid', gridTemplateColumns: '240px minmax(0, 1fr)', gap: 28, alignItems: 'start' }}>
                    <div className="popup-category-rail" style={{ position: 'sticky', top: 96 }}>
                        <div className="popup-category-card" style={{
                            background: '#fff',
                            borderRadius: 8,
                            border: '1px solid #dde4ef',
                            padding: 14,
                            boxShadow: '0 10px 30px rgba(15,23,42,0.04)',
                        }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 10, paddingInline: 8 }}>
                                DANH MỤC TEMPLATE
                            </div>
                            {CATEGORIES.map((category) => {
                                const count = category.key === 'all'
                                    ? POPUP_TEMPLATES.length
                                    : POPUP_TEMPLATES.filter((template) => template.category === category.key).length;
                                const active = activeCategory === category.key;
                                return (
                                    <button
                                        key={category.key}
                                        type="button"
                                        className={`popup-category-item ${active ? 'is-active' : ''}`}
                                        onClick={() => setActiveCategory(category.key)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: 10,
                                            padding: '11px 12px',
                                            borderRadius: 8,
                                            cursor: 'pointer',
                                            marginBottom: 4,
                                            background: active ? 'linear-gradient(135deg, #4f46e5, #7c3aed)' : 'transparent',
                                            color: active ? '#fff' : '#334155',
                                            fontWeight: active ? 700 : 500,
                                        }}
                                    >
                                        <span>{category.label}</span>
                                        {count > 0 && (
                                            <span style={{
                                                minWidth: 24,
                                                height: 24,
                                                borderRadius: 999,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                paddingInline: 8,
                                                fontSize: 12,
                                                background: active ? 'rgba(255,255,255,0.18)' : '#eef2ff',
                                                color: active ? '#fff' : '#4f46e5',
                                            }}>
                                                {count}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
                        ) : (
                            <>
                                <div style={{ marginBottom: 22 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                                        <Title level={3} style={{ margin: 0 }}>
                                            {popups.length === 0 ? 'Bắt đầu từ template mẫu' : 'Thư viện template popup'}
                                        </Title>
                                        {activeCategory !== 'all' && (
                                            <Tag color="blue" style={{ borderRadius: 999, marginInlineEnd: 0 }}>
                                                {CATEGORIES.find((item) => item.key === activeCategory)?.label}
                                            </Tag>
                                        )}
                                    </div>
                                    <div style={{ color: '#64748b', fontSize: 15 }}>
                                        Duyệt mẫu popup như Subiz, chọn mẫu phù hợp rồi tạo ngay hoặc mở ra để tinh chỉnh chi tiết.
                                    </div>
                                </div>

                                {visibleTemplates.length === 0 ? (
                                    <Empty description="Không tìm thấy template phù hợp" style={{ padding: 60 }} />
                                ) : (
                                    <div className="popup-template-grid" style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                        gap: 16,
                                        marginBottom: 32,
                                    }}>
                                        {visibleTemplates.map((template) => (
                                            <TemplateCard
                                                key={template.id}
                                                template={template}
                                                loading={templateCreating === template.id}
                                                onUse={handleCreateFromTemplate}
                                                onCustomize={openCreateFromTemplate}
                                            />
                                        ))}
                                    </div>
                                )}

                                {popups.length > 0 && (
                                    <>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: 16,
                                            margin: '12px 0 18px',
                                        }}>
                                            <div>
                                                <Title level={4} style={{ margin: 0 }}>Popup đã tạo</Title>
                                                <div style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
                                                    Các popup thật của workspace. Bấm vào card để chỉnh sửa tiếp.
                                                </div>
                                            </div>
                                            <Tag style={{ borderRadius: 999, paddingInline: 12, marginInlineEnd: 0 }}>
                                                {filteredPopups.length} popup
                                            </Tag>
                                        </div>

                                        {filteredPopups.length === 0 ? (
                                            <Empty description="Không có popup phù hợp bộ lọc" style={{ padding: 56 }} />
                                        ) : (
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18 }}>
                                                {filteredPopups.map((popup) => (
                                                    <PopupCard
                                                        key={getPopupId(popup) || popup.name}
                                                        popup={popup}
                                                        onOpen={openEdit}
                                                        onToggle={handleToggleStatus}
                                                        onDelete={handleDelete}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                .popup-hero {
                    padding: 22px 0 4px;
                }

                .popup-hero-copy {
                    min-width: 0;
                }

                .popup-flow-steps {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-top: 16px;
                }

                .popup-flow-steps div {
                    display: inline-flex;
                    align-items: center;
                    gap: 7px;
                    min-height: 32px;
                    padding: 0 11px;
                    border: 1px solid #dde4ef;
                    border-radius: 999px;
                    background: #fff;
                    color: #475569;
                    font-size: 13px;
                    font-weight: 800;
                    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
                }

                .popup-flow-steps span {
                    display: grid;
                    width: 20px;
                    height: 20px;
                    place-items: center;
                    border-radius: 999px;
                    background: #eef2ff;
                    color: #4f46e5;
                    font-size: 11px;
                    font-weight: 900;
                }

                .popup-hero-actions {
                    display: grid;
                    justify-items: end;
                    gap: 10px;
                    flex-shrink: 0;
                }

                .popup-hero-note {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    min-height: 30px;
                    padding: 0 11px;
                    border: 1px solid #dde4ef;
                    border-radius: 999px;
                    background: #fff;
                    color: #64748b;
                    font-size: 12px;
                    font-weight: 800;
                }

                .popup-hero-note strong {
                    color: #0f172a;
                    font-weight: 950;
                }

                .popup-stat-card {
                    transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
                }

                .popup-stat-card:hover {
                    transform: translateY(-2px);
                    border-color: #cbd5e1 !important;
                    box-shadow: 0 14px 34px rgba(15,23,42,0.08) !important;
                }

                .popup-toolbar {
                    padding: 12px;
                    border: 1px solid #dde4ef;
                    border-radius: 8px;
                    background: rgba(255,255,255,0.78);
                    box-shadow: 0 1px 2px rgba(16,24,40,0.04);
                    backdrop-filter: blur(12px);
                }

                .popup-status-pill {
                    transition: border-color 160ms ease, background 160ms ease, color 160ms ease, box-shadow 160ms ease;
                }

                .popup-status-pill:hover {
                    border-color: #cbd5e1 !important;
                    background: #f8fafc !important;
                    box-shadow: 0 1px 2px rgba(16,24,40,0.05);
                }

                .popup-status-pill.is-active:hover {
                    border-color: #4f46e5 !important;
                    background: #eef2ff !important;
                }

                .popup-category-card {
                    overflow: hidden;
                }

                .popup-category-item {
                    width: 100%;
                    border: 1px solid transparent;
                    text-align: left;
                    transition: border-color 160ms ease, background 160ms ease, color 160ms ease, transform 160ms ease;
                }

                .popup-category-item:hover {
                    border-color: #e2e8f0;
                    background: #f8fafc !important;
                    color: #0f172a !important;
                    transform: translateX(2px);
                }

                .popup-category-item.is-active:hover {
                    background: linear-gradient(135deg, #4f46e5, #7c3aed) !important;
                    color: #fff !important;
                }

                .popup-category-item:focus-visible,
                .popup-status-pill:focus-visible {
                    outline: 3px solid rgba(79,70,229,0.22);
                    outline-offset: 2px;
                }

                .popup-template-card-v2 {
                    --template-accent: #4f46e5;
                    display: flex;
                    flex-direction: column;
                    min-height: 100%;
                    overflow: hidden;
                    border: 1px solid #dde4ef;
                    border-radius: 8px;
                    background: #fff;
                    box-shadow: 0 1px 2px rgba(16,24,40,0.04), 0 10px 24px rgba(16,24,40,0.05);
                    transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
                }

                .popup-template-card-v2:hover {
                    transform: translateY(-3px);
                    border-color: #cbd5e1;
                    box-shadow: 0 18px 42px rgba(16, 24, 40, 0.12);
                }

                .popup-template-preview-stage {
                    position: relative;
                    display: grid;
                    place-items: center;
                    min-height: 260px;
                    padding: 16px;
                    border-bottom: 1px solid #eef2f7;
                    background:
                        radial-gradient(circle at 20% 10%, rgba(79,70,229,0.12), transparent 26%),
                        linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%);
                }

                .popup-template-preview-frame {
                    position: relative;
                    width: min(196px, 80%);
                    height: 232px;
                    overflow: hidden;
                    border-radius: 16px;
                    box-shadow: 0 18px 38px rgba(15,23,42,0.18);
                }

                .popup-template-preview-gloss {
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(135deg, rgba(255,255,255,0.17), rgba(255,255,255,0) 45%);
                    pointer-events: none;
                }

                .popup-template-preview-top {
                    position: relative;
                    z-index: 1;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                    padding: 13px 14px 0;
                }

                .popup-template-preview-top span:first-child {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    min-height: 23px;
                    padding: 0 8px;
                    border: 1px solid rgba(255,255,255,0.18);
                    border-radius: 999px;
                    background: rgba(255,255,255,0.16);
                    font-size: 11px;
                    font-weight: 850;
                }

                .popup-template-close {
                    display: grid;
                    width: 24px;
                    height: 24px;
                    place-items: center;
                    border-radius: 999px;
                    background: rgba(0,0,0,0.28);
                    color: #fff;
                    font-size: 17px;
                    font-weight: 850;
                }

                .popup-template-copy {
                    position: relative;
                    z-index: 1;
                    padding: 12px 16px 0;
                }

                .popup-template-eyebrow {
                    margin-bottom: 5px;
                    font-size: 13px;
                    font-weight: 750;
                    line-height: 1.2;
                }

                .popup-template-copy h3 {
                    display: -webkit-box;
                    min-height: 48px;
                    margin: 0 0 8px;
                    overflow: hidden;
                    -webkit-box-orient: vertical;
                    -webkit-line-clamp: 2;
                    font-size: 23px;
                    font-weight: 950;
                    line-height: 1.03;
                }

                .popup-template-copy p {
                    display: -webkit-box;
                    margin: 0;
                    overflow: hidden;
                    -webkit-box-orient: vertical;
                    -webkit-line-clamp: 2;
                    font-size: 12px;
                    line-height: 1.45;
                    opacity: 0.95;
                }

                .popup-template-preview-cta {
                    position: relative;
                    z-index: 1;
                    width: max-content;
                    max-width: calc(100% - 32px);
                    margin: 12px auto 0;
                    padding: 8px 14px;
                    border-radius: 999px;
                    box-shadow: 0 10px 22px rgba(0,0,0,0.16);
                    font-size: 12px;
                    font-weight: 850;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .popup-template-art-panel {
                    position: absolute;
                    left: 13px;
                    right: 13px;
                    bottom: 13px;
                    height: 68px;
                    overflow: hidden;
                    border-radius: 12px;
                }

                .popup-template-art-scale {
                    width: 142%;
                    margin-left: -21%;
                    transform: scale(0.56);
                    transform-origin: top center;
                }

                .popup-template-category {
                    position: absolute;
                    left: 14px;
                    bottom: 14px;
                    z-index: 2;
                    display: inline-flex;
                    align-items: center;
                    min-height: 26px;
                    padding: 0 10px;
                    border: 1px solid rgba(255,255,255,0.68);
                    border-radius: 999px;
                    background: rgba(255,255,255,0.86);
                    color: #334155;
                    font-size: 12px;
                    font-weight: 850;
                    box-shadow: 0 10px 24px rgba(15,23,42,0.1);
                }

                .popup-template-body {
                    display: flex;
                    flex: 1;
                    flex-direction: column;
                    gap: 12px;
                    padding: 16px;
                }

                .popup-template-heading {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: 12px;
                }

                .popup-template-title {
                    display: -webkit-box !important;
                    overflow: hidden;
                    -webkit-box-orient: vertical;
                    -webkit-line-clamp: 2;
                    color: #0f172a !important;
                    font-size: 16px !important;
                    line-height: 1.25 !important;
                }

                .popup-template-goal {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    margin-top: 6px;
                    color: #475569;
                    font-size: 12px;
                    font-weight: 800;
                }

                .popup-template-goal span {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .popup-template-type {
                    min-height: 26px;
                    padding: 4px 8px;
                    border: 1px solid #e2e8f0;
                    border-radius: 999px;
                    background: #f8fafc;
                    color: #475569;
                    font-size: 11px;
                    font-weight: 850;
                    white-space: nowrap;
                }

                .popup-template-description {
                    display: -webkit-box;
                    min-height: 42px;
                    margin: 0;
                    overflow: hidden;
                    -webkit-box-orient: vertical;
                    -webkit-line-clamp: 2;
                    color: #64748b;
                    font-size: 13px;
                    line-height: 1.55;
                }

                .popup-template-meta-grid {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 8px;
                }

                .popup-template-meta-grid div {
                    min-width: 0;
                    padding: 9px 10px;
                    border: 1px solid #eef2f7;
                    border-radius: 8px;
                    background: #f8fafc;
                }

                .popup-template-meta-grid span {
                    display: block;
                    color: #94a3b8;
                    font-size: 10px;
                    font-weight: 850;
                    text-transform: uppercase;
                }

                .popup-template-meta-grid strong {
                    display: block;
                    margin-top: 4px;
                    overflow: hidden;
                    color: #0f172a;
                    font-size: 12px;
                    font-weight: 900;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .popup-template-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                    min-height: 26px;
                }

                .popup-template-tags .ant-tag {
                    margin: 0;
                    border-radius: 999px;
                    color: #334155;
                    font-size: 11px;
                    font-weight: 750;
                }

                .popup-template-field-list {
                    display: grid;
                    gap: 7px;
                    margin-top: auto;
                }

                .popup-template-field-list div {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    height: 32px;
                    padding: 0 10px;
                    border: 1px solid #eef2f7;
                    border-radius: 8px;
                    background: #fff;
                    color: #475569;
                    font-size: 12px;
                    font-weight: 750;
                }

                .popup-template-field-list span {
                    min-width: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .popup-template-field-list strong {
                    margin-left: auto;
                    color: #ef4444;
                }

                .popup-template-actions {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) auto;
                    gap: 10px;
                    padding-top: 2px;
                }

                .popup-template-actions .ant-btn {
                    height: 40px;
                    border-radius: 8px;
                    font-weight: 850;
                }

                .popup-drawer-title {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    min-width: 0;
                }

                .popup-drawer-title > span {
                    display: grid;
                    width: 40px;
                    height: 40px;
                    place-items: center;
                    border-radius: 8px;
                    background: #eef2ff;
                    color: #4f46e5;
                    flex-shrink: 0;
                }

                .popup-drawer-title strong {
                    display: block;
                    overflow: hidden;
                    color: #0f172a;
                    font-size: 16px;
                    font-weight: 900;
                    line-height: 1.25;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .popup-drawer-title p {
                    margin: 3px 0 0;
                    color: #64748b;
                    font-size: 12px;
                    font-weight: 650;
                    line-height: 1.4;
                }

                .popup-editor-drawer .ant-drawer-header {
                    border-bottom: 1px solid #eef2f7;
                    padding: 16px 20px;
                }

                .popup-editor-drawer .ant-drawer-body {
                    background: #f8fafc;
                    padding: 16px;
                }

                .popup-editor-tabs .ant-tabs-nav {
                    margin-bottom: 14px;
                }

                .popup-editor-tabs .ant-tabs-tab {
                    font-weight: 800;
                }

                .popup-editor-pane {
                    display: grid;
                    gap: 14px;
                }

                .popup-editor-section {
                    padding: 16px;
                    border: 1px solid #dde4ef;
                    border-radius: 8px;
                    background: #fff;
                    box-shadow: 0 1px 2px rgba(16,24,40,0.04);
                }

                .popup-editor-section-title {
                    display: flex;
                    align-items: flex-start;
                    gap: 11px;
                    margin-bottom: 14px;
                }

                .popup-editor-section-title > span {
                    display: grid;
                    width: 34px;
                    height: 34px;
                    place-items: center;
                    border-radius: 8px;
                    background: #eef2ff;
                    color: #4f46e5;
                    flex-shrink: 0;
                }

                .popup-editor-section-title h3 {
                    margin: 0;
                    color: #0f172a;
                    font-size: 15px;
                    font-weight: 900;
                    line-height: 1.25;
                }

                .popup-editor-section-title p {
                    margin: 4px 0 0;
                    color: #64748b;
                    font-size: 12px;
                    line-height: 1.5;
                }

                .popup-editor-form .ant-form-item-label > label {
                    color: #475569;
                    font-size: 13px;
                    font-weight: 800;
                }

                .popup-editor-form .ant-input,
                .popup-editor-form .ant-select-selector,
                .popup-editor-form .ant-input-number,
                .popup-editor-form textarea {
                    border-radius: 8px !important;
                }

                .popup-editor-grid {
                    display: grid;
                    gap: 12px;
                }

                .popup-editor-grid.two {
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }

                .popup-editor-grid.cta {
                    grid-template-columns: minmax(0, 1fr) 92px;
                    align-items: end;
                }

                .popup-color-input {
                    width: 100% !important;
                    height: 38px;
                    padding: 3px !important;
                }

                .popup-code-pane {
                    grid-template-columns: minmax(0, 1fr);
                }

                .popup-code-toolbar {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    margin-bottom: 14px;
                    padding: 12px;
                    border: 1px solid #e5eaf3;
                    border-radius: 8px;
                    background: #f8fafc;
                }

                .popup-code-toolbar > div {
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                    justify-content: flex-end;
                }

                .popup-code-toggle {
                    margin-bottom: 0;
                }

                .popup-code-textarea {
                    font-family: "JetBrains Mono", "Fira Code", Consolas, monospace;
                    font-size: 12px;
                    line-height: 1.6;
                    white-space: pre;
                    tab-size: 2;
                }

                .popup-code-preview {
                    overflow: hidden;
                    border: 1px solid #dde4ef;
                    border-radius: 8px;
                    background: #0f172a;
                }

                .popup-code-preview-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 10px;
                    padding: 10px 12px;
                    border-bottom: 1px solid rgba(255,255,255,0.08);
                    color: #e2e8f0;
                    font-size: 12px;
                    font-weight: 850;
                }

                .popup-code-preview iframe {
                    display: block;
                    width: 100%;
                    height: 360px;
                    border: 0;
                    background:
                        linear-gradient(45deg, rgba(148,163,184,0.10) 25%, transparent 25%),
                        linear-gradient(-45deg, rgba(148,163,184,0.10) 25%, transparent 25%),
                        linear-gradient(45deg, transparent 75%, rgba(148,163,184,0.10) 75%),
                        linear-gradient(-45deg, transparent 75%, rgba(148,163,184,0.10) 75%);
                    background-color: #f8fafc;
                    background-position: 0 0, 0 10px, 10px -10px, -10px 0;
                    background-size: 20px 20px;
                }

                .popup-field-row {
                    display: grid;
                    grid-template-columns: 116px minmax(0, 1fr) minmax(0, 1fr) 120px 36px;
                    gap: 8px;
                    align-items: start;
                    margin-bottom: 8px;
                    padding: 10px;
                    border: 1px solid #eef2f7;
                    border-radius: 8px;
                    background: #f8fafc;
                }

                .popup-field-row .ant-form-item {
                    margin-bottom: 0;
                }

                .popup-field-required {
                    padding-top: 30px;
                }

                .popup-field-required .ant-switch {
                    min-width: 82px;
                }

                .popup-field-row .ant-btn {
                    margin-top: 25px;
                }

                .popup-add-field-button {
                    height: 40px;
                    border-radius: 8px;
                    font-weight: 850;
                }

                .popup-radio-grid {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 8px;
                    width: 100%;
                }

                .popup-radio-grid .ant-radio-wrapper {
                    min-height: 42px;
                    margin: 0;
                    padding: 0 12px;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    background: #f8fafc;
                    color: #334155;
                    font-weight: 750;
                }

                @media (max-width: 1180px) {
                    .popup-content-grid {
                        grid-template-columns: 1fr !important;
                    }

                    .popup-category-rail {
                        position: static !important;
                    }
                }

                @media (max-width: 720px) {
                    .popup-workbench {
                        padding: 20px 14px 40px !important;
                    }

                    .popup-page-header {
                        flex-direction: column !important;
                        align-items: stretch !important;
                    }

                    .popup-page-header .ant-btn {
                        width: 100%;
                    }

                    .popup-stats-grid {
                        grid-template-columns: 1fr !important;
                    }

                    .popup-template-grid {
                        grid-template-columns: 1fr !important;
                    }

                    .popup-flow-steps,
                    .popup-hero-actions {
                        justify-items: stretch;
                    }

                    .popup-code-toolbar {
                        align-items: stretch;
                        flex-direction: column;
                    }

                    .popup-code-toolbar > div {
                        justify-content: stretch;
                    }

                    .popup-code-toolbar .ant-btn {
                        flex: 1;
                    }

                    .popup-code-preview iframe {
                        height: 300px;
                    }

                    .popup-editor-grid.two,
                    .popup-editor-grid.cta,
                    .popup-radio-grid,
                    .popup-field-row {
                        grid-template-columns: 1fr !important;
                    }

                    .popup-field-required,
                    .popup-field-row .ant-btn {
                        padding-top: 0;
                        margin-top: 0;
                    }
                }
            `}</style>

            <Drawer
                title={
                    <div className="popup-drawer-title">
                        <span>
                            {editing ? <LayoutTemplate size={20} /> : <Plus size={20} />}
                        </span>
                        <div>
                            <strong>{editing ? editing.name : 'Tạo popup mới'}</strong>
                            <p>{editing ? 'Tinh chỉnh nội dung, form và điều kiện hiển thị.' : 'Bắt đầu từ template hoặc tạo thủ công rồi xuất bản.'}</p>
                        </div>
                    </div>
                }
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                width={880}
                className="popup-editor-drawer"
                destroyOnClose
                extra={
                    <Button
                        type="primary"
                        loading={saving}
                        onClick={() => form.submit()}
                        style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', border: 'none', fontWeight: 700, borderRadius: 8 }}
                    >
                        {editing ? 'Lưu thay đổi' : 'Xuất bản'}
                    </Button>
                }
            >
                <Form form={form} layout="vertical" onFinish={handleSave} requiredMark={false} className="popup-editor-form">
                    <Tabs className="popup-editor-tabs" defaultActiveKey="design" items={[
                        {
                            key: 'design', label: 'Thiết kế',
                            children: (
                                <div className="popup-editor-pane">
                                    <section className="popup-editor-section">
                                        <div className="popup-editor-section-title">
                                            <span><LayoutTemplate size={17} /></span>
                                            <div>
                                                <h3>Nội dung chính</h3>
                                                <p>Tên, loại popup và nhóm template để quản lý trong thư viện.</p>
                                            </div>
                                        </div>
                                    <Form.Item label="Tên popup" name="name" rules={[{ required: true, message: 'Nhập tên' }]}>
                                        <Input placeholder="VD: Form khuyến mãi dịp Quốc Khánh" />
                                    </Form.Item>
                                    <div className="popup-editor-grid two">
                                        <Form.Item label="Loại" name="type">
                                            <Select options={[
                                                { value: 'popup', label: 'Popup' },
                                                { value: 'notification', label: 'Thông báo' },
                                            ]} />
                                        </Form.Item>
                                        <Form.Item label="Danh mục" name="category">
                                            <Select options={CATEGORIES.filter((item) => item.key !== 'all').map((item) => ({ value: item.key, label: item.label }))} />
                                        </Form.Item>
                                    </div>
                                    </section>

                                    <section className="popup-editor-section">
                                        <div className="popup-editor-section-title">
                                            <span><Eye size={17} /></span>
                                            <div>
                                                <h3>Hiển thị</h3>
                                                <p>Kích thước và hình ảnh được dùng khi popup render trên website.</p>
                                            </div>
                                        </div>
                                    <Form.Item label="Hình ảnh (URL)" name="designImageUrl" extra="400 × 600 px khuyến nghị">
                                        <Input placeholder="https://example.com/banner.jpg" />
                                    </Form.Item>
                                    <div className="popup-editor-grid two">
                                        <Form.Item label="Chiều rộng" name="designWidth">
                                            <InputNumber min={200} max={800} suffix="px" style={{ width: '100%' }} />
                                        </Form.Item>
                                        <Form.Item label="Chiều cao" name="designHeight">
                                            <InputNumber min={200} max={1200} suffix="px" style={{ width: '100%' }} />
                                        </Form.Item>
                                    </div>
                                    </section>

                                    <section className="popup-editor-section">
                                        <div className="popup-editor-section-title">
                                            <span><FileText size={17} /></span>
                                            <div>
                                                <h3>Trường thu thập</h3>
                                                <p>Các trường khách sẽ điền trước khi gửi form.</p>
                                            </div>
                                        </div>
                                    <Form.List name="designFields">
                                        {(fields, { add, remove }) => (
                                            <>
                                                {fields.map(({ key, name, ...rest }) => (
                                                    <div key={key} className="popup-field-row">
                                                        <Form.Item {...rest} name={[name, 'type']} className="popup-field-type">
                                                            <Select options={[
                                                                { value: 'text', label: 'Văn bản' },
                                                                { value: 'email', label: 'Email' },
                                                                { value: 'phone', label: 'SĐT' },
                                                            ]} />
                                                        </Form.Item>
                                                        <Form.Item {...rest} name={[name, 'label']}>
                                                            <Input placeholder="Label" />
                                                        </Form.Item>
                                                        <Form.Item {...rest} name={[name, 'placeholder']}>
                                                            <Input placeholder="Placeholder" />
                                                        </Form.Item>
                                                        <Form.Item {...rest} name={[name, 'required']} valuePropName="checked" className="popup-field-required">
                                                            <Switch size="small" checkedChildren="Bắt buộc" unCheckedChildren="Tùy chọn" />
                                                        </Form.Item>
                                                        <Button danger type="text" icon={<MinusCircleOutlined />} onClick={() => remove(name)} />
                                                    </div>
                                                ))}
                                                <Button type="dashed" onClick={() => add({ type: 'text', label: '', placeholder: '' })} block icon={<PlusOutlined />} className="popup-add-field-button">
                                                    Thêm trường
                                                </Button>
                                            </>
                                        )}
                                    </Form.List>
                                    </section>

                                    <section className="popup-editor-section">
                                        <div className="popup-editor-section-title">
                                            <span><MousePointerClick size={17} /></span>
                                            <div>
                                                <h3>Nút hành động</h3>
                                                <p>CTA chính trong popup, nên ngắn và nói rõ lợi ích.</p>
                                            </div>
                                        </div>
                                    <div className="popup-editor-grid cta">
                                        <Form.Item label="Văn bản nút" name="designButtonText">
                                            <Input placeholder="Đăng ký ngay" />
                                        </Form.Item>
                                        <Form.Item label="Màu nút" name="designButtonColor">
                                            <Input type="color" className="popup-color-input" />
                                        </Form.Item>
                                    </div>
                                    </section>

                                    <section className="popup-editor-section">
                                        <div className="popup-editor-section-title">
                                            <span><Sparkles size={17} /></span>
                                            <div>
                                                <h3>Trang cảm ơn</h3>
                                                <p>Thông báo sau khi khách gửi form thành công.</p>
                                            </div>
                                        </div>
                                    <Form.Item label="Tiêu đề" name="thankYouTitle">
                                        <Input placeholder="Cảm ơn bạn" />
                                    </Form.Item>
                                    <Form.Item label="Nội dung" name="thankYouMessage">
                                        <Input.TextArea rows={2} placeholder="Chúng tôi đã nhận thông tin và sẽ liên hệ sớm." />
                                    </Form.Item>
                                    <Form.Item label="Nút chuyển hướng (tùy chọn)" name="thankYouButtonText">
                                        <Input placeholder="Xem sản phẩm" />
                                    </Form.Item>
                                    <Form.Item label="URL chuyển hướng" name="thankYouButtonUrl">
                                        <Input placeholder="https://example.com/products" />
                                    </Form.Item>
                                    </section>
                                </div>
                            ),
                        },
                        {
                            key: 'code', label: 'Dán code',
                            children: (
                                <div className="popup-editor-pane popup-code-pane">
                                    <section className="popup-editor-section">
                                        <div className="popup-editor-section-title">
                                            <span><Code2 size={17} /></span>
                                            <div>
                                                <h3>Custom code</h3>
                                                <p>Dán HTML, CSS và JavaScript riêng để tự thiết kế popup theo brand.</p>
                                            </div>
                                        </div>
                                        <div className="popup-code-toolbar">
                                            <Form.Item name="customCodeEnabled" valuePropName="checked" className="popup-code-toggle">
                                                <Switch checkedChildren="Bật custom" unCheckedChildren="Tắt custom" />
                                            </Form.Item>
                                            <div>
                                                <Button
                                                    icon={<Sparkles size={14} />}
                                                    onClick={() => form.setFieldsValue({
                                                        customCodeEnabled: true,
                                                        customHtml: CUSTOM_CODE_STARTER_HTML,
                                                        customCss: CUSTOM_CODE_STARTER_CSS,
                                                        customJs: CUSTOM_CODE_STARTER_JS,
                                                    })}
                                                >
                                                    Dán mẫu starter
                                                </Button>
                                                <Button
                                                    icon={<Trash2 size={14} />}
                                                    onClick={() => form.setFieldsValue({
                                                        customCodeEnabled: false,
                                                        customHtml: '',
                                                        customCss: '',
                                                        customJs: '',
                                                    })}
                                                >
                                                    Xóa code
                                                </Button>
                                            </div>
                                        </div>
                                        <Form.Item label="HTML" name="customHtml" extra="Không cần thẻ html/body. Có thể dùng form, input, button hoặc ảnh.">
                                            <Input.TextArea
                                                rows={8}
                                                className="popup-code-textarea"
                                                placeholder="<div class=&quot;my-popup&quot;>...</div>"
                                            />
                                        </Form.Item>
                                        <Form.Item label="CSS" name="customCss" extra="Nên prefix class riêng để không ảnh hưởng CSS của website.">
                                            <Input.TextArea
                                                rows={10}
                                                className="popup-code-textarea"
                                                placeholder=".my-popup { padding: 24px; }"
                                            />
                                        </Form.Item>
                                        <Form.Item label="JavaScript" name="customJs" extra="Chỉ dán script bạn tin tưởng vì code sẽ chạy trên website khi popup bật.">
                                            <Input.TextArea
                                                rows={5}
                                                className="popup-code-textarea"
                                                placeholder="console.log('popup ready')"
                                            />
                                        </Form.Item>
                                    </section>

                                    <section className="popup-editor-section">
                                        <div className="popup-editor-section-title">
                                            <span><Eye size={17} /></span>
                                            <div>
                                                <h3>Preview</h3>
                                                <p>Xem nhanh HTML/CSS/JS trước khi lưu và xuất bản.</p>
                                            </div>
                                        </div>
                                        <Form.Item
                                            noStyle
                                            shouldUpdate={(prev, cur) => (
                                                prev.customCodeEnabled !== cur.customCodeEnabled
                                                || prev.customHtml !== cur.customHtml
                                                || prev.customCss !== cur.customCss
                                                || prev.customJs !== cur.customJs
                                            )}
                                        >
                                            {({ getFieldValue }) => (
                                                <CustomCodePreview
                                                    enabled={getFieldValue('customCodeEnabled')}
                                                    html={getFieldValue('customHtml')}
                                                    css={getFieldValue('customCss')}
                                                    js={getFieldValue('customJs')}
                                                />
                                            )}
                                        </Form.Item>
                                    </section>
                                </div>
                            ),
                        },
                        {
                            key: 'settings', label: 'Điều kiện',
                            children: (
                                <div className="popup-editor-pane">
                                    <section className="popup-editor-section">
                                        <div className="popup-editor-section-title">
                                            <span><Clock3 size={17} /></span>
                                            <div>
                                                <h3>Điều kiện chạy popup</h3>
                                                <p>Chọn thời điểm popup xuất hiện để không làm phiền khách truy cập.</p>
                                            </div>
                                        </div>
                                    <Form.Item label="Kích hoạt khi" name="triggerMode">
                                        <Radio.Group className="popup-radio-grid">
                                            <Radio value="immediate">Ngay lập tức</Radio>
                                            <Radio value="delay">Sau N giây</Radio>
                                            <Radio value="scroll">Cuộn % trang</Radio>
                                            <Radio value="exit_intent">Khi rời trang</Radio>
                                        </Radio.Group>
                                    </Form.Item>
                                    <Form.Item noStyle shouldUpdate={(prev, cur) => prev.triggerMode !== cur.triggerMode}>
                                        {({ getFieldValue }) => (
                                            getFieldValue('triggerMode') === 'delay' && (
                                                <Form.Item label="Số giây" name="triggerDelay">
                                                    <InputNumber min={0} suffix="giây" />
                                                </Form.Item>
                                            )
                                        )}
                                    </Form.Item>
                                    <Form.Item noStyle shouldUpdate={(prev, cur) => prev.triggerMode !== cur.triggerMode}>
                                        {({ getFieldValue }) => (
                                            getFieldValue('triggerMode') === 'scroll' && (
                                                <Form.Item label="Cuộn % trang" name="scrollPercent">
                                                    <InputNumber min={0} max={100} suffix="%" />
                                                </Form.Item>
                                            )
                                        )}
                                    </Form.Item>
                                    </section>

                                    <section className="popup-editor-section">
                                        <div className="popup-editor-section-title">
                                            <span><RefreshCw size={17} /></span>
                                            <div>
                                                <h3>Tần suất</h3>
                                                <p>Kiểm soát số lần hiển thị để giữ trải nghiệm website gọn gàng.</p>
                                            </div>
                                        </div>
                                    <Form.Item label="Hiển thị" name="frequency">
                                        <Radio.Group className="popup-radio-grid">
                                            <Radio value="once">1 lần duy nhất</Radio>
                                            <Radio value="every_visit">Mỗi lượt truy cập</Radio>
                                            <Radio value="every_day">Mỗi ngày 1 lần</Radio>
                                        </Radio.Group>
                                    </Form.Item>
                                    </section>
                                </div>
                            ),
                        },
                        {
                            key: 'stats', label: 'Thống kê',
                            children: editing ? (
                                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                    {[
                                        { label: 'Lượt xem', value: editing.stats?.views || 0, icon: Eye, color: '#6366f1' },
                                        { label: 'Đã gửi form', value: editing.stats?.submissions || 0, icon: FileText, color: '#22c55e' },
                                        { label: 'Đã đóng', value: editing.stats?.closes || 0, icon: XCircle, color: '#ef4444' },
                                    ].map((item) => (
                                        (() => {
                                            const Icon = item.icon;
                                            return (
                                                <div key={item.label} style={{ flex: 1, minWidth: 140, padding: 20, borderRadius: 8, background: '#f8f9fb', textAlign: 'center' }}>
                                                    <div style={{ fontSize: 28, fontWeight: 700, color: item.color }}>{item.value}</div>
                                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b', marginTop: 4 }}>
                                                        <Icon size={14} />
                                                        {item.label}
                                                    </div>
                                                </div>
                                            );
                                        })()
                                    ))}
                                </div>
                            ) : (
                                <Empty description="Chỉ có khi chỉnh sửa popup đã tạo" />
                            ),
                        },
                    ]} />
                </Form>
            </Drawer>
        </AppLayout>
    );
}
