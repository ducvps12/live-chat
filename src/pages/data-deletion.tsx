import LegalDocument, { type LegalSection } from '../components/legal/LegalDocument';
import StaticPageLayout from '../components/layout/StaticPageLayout';

const sections: LegalSection[] = [
    {
        id: 'request',
        title: 'Cách gửi yêu cầu xóa dữ liệu',
        paragraphs: [
            'Gửi email tới privacy@nemarkchat.com với tiêu đề “Yêu cầu xóa dữ liệu”. Trong email, hãy cung cấp địa chỉ email dùng cho tài khoản NemarkChat hoặc tên workspace và kênh Facebook liên quan. Không gửi mật khẩu, access token hay App Secret.',
        ],
    },
    {
        id: 'facebook',
        title: 'Gỡ quyền truy cập Facebook',
        bullets: [
            'Mở Facebook → Cài đặt & quyền riêng tư → Cài đặt → Ứng dụng và trang web.',
            'Chọn NemarkChat và bấm Gỡ để thu hồi quyền truy cập của ứng dụng.',
            'Việc gỡ quyền ngăn truy cập mới; để xóa bản ghi đã đồng bộ trước đó, hãy gửi thêm yêu cầu theo mục 1.',
        ],
    },
    {
        id: 'verification',
        title: 'Xác minh yêu cầu',
        paragraphs: [
            'Để tránh xóa nhầm dữ liệu, NemarkChat có thể yêu cầu xác minh quyền sở hữu tài khoản, workspace hoặc Fanpage. Chúng tôi chỉ yêu cầu thông tin tối thiểu cần thiết và không bao giờ yêu cầu mật khẩu Facebook.',
        ],
    },
    {
        id: 'scope',
        title: 'Dữ liệu được xử lý',
        paragraphs: [
            'Sau khi xác minh, chúng tôi sẽ xóa hoặc ẩn danh dữ liệu thuộc phạm vi hợp lệ, gồm liên kết tài khoản Facebook, token tích hợp, hồ sơ Fanpage, hội thoại và dữ liệu khách hàng đã đồng bộ theo yêu cầu. Một số bản ghi bảo mật, hóa đơn, giao dịch hoặc audit có thể phải tiếp tục lưu theo nghĩa vụ pháp lý.',
        ],
    },
    {
        id: 'timeline',
        title: 'Thời gian và xác nhận hoàn tất',
        paragraphs: [
            'Yêu cầu hợp lệ thường được xử lý trong vòng 30 ngày. Nếu yêu cầu phức tạp hoặc cần phối hợp với chủ workspace, chúng tôi sẽ thông báo tiến độ qua email. Khi hoàn tất, người yêu cầu sẽ nhận được xác nhận tại địa chỉ email đã dùng để gửi yêu cầu.',
        ],
    },
    {
        id: 'contact',
        title: 'Liên hệ',
        paragraphs: [
            'Yêu cầu xóa dữ liệu và câu hỏi về quyền riêng tư gửi tới privacy@nemarkchat.com. Hỗ trợ kỹ thuật chung gửi tới support@nemarkchat.com.',
        ],
    },
];

export default function DataDeletionPage() {
    return (
        <StaticPageLayout
            title="Hướng dẫn xóa dữ liệu"
            description="Cách thu hồi quyền Facebook và yêu cầu NemarkChat xóa dữ liệu tài khoản, Fanpage hoặc hội thoại liên quan."
        >
            <LegalDocument
                eyebrow="Data Deletion"
                title="Hướng dẫn xóa dữ liệu người dùng"
                summary="Bạn có thể thu hồi quyền Facebook và yêu cầu xóa dữ liệu đã được NemarkChat xử lý theo các bước dưới đây."
                updatedAt="04/08/2026"
                sections={sections}
            />
        </StaticPageLayout>
    );
}
