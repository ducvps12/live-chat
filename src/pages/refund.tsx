import LegalDocument, { type LegalSection } from '../components/legal/LegalDocument';
import StaticPageLayout from '../components/layout/StaticPageLayout';

const sections: LegalSection[] = [
    { id: 'scope', title: 'Phạm vi', paragraphs: ['Chính sách này áp dụng cho gói NemarkChat thanh toán trực tiếp cho NemarkChat. Khoản phí trả cho nền tảng tích hợp, ngân hàng, nhà mạng hoặc đối tác khác chịu chính sách của bên đó.'] },
    { id: 'trial', title: 'Dùng thử trước khi mua', paragraphs: ['Chúng tôi cung cấp gói dùng thử hoặc demo tính năng để bạn đánh giá độ phù hợp. Bạn nên kiểm tra kênh, quota, AI, thiết bị và yêu cầu nội bộ trước khi thanh toán gói dài hạn.'] },
    { id: 'eligible', title: 'Trường hợp được xem xét hoàn tiền', bullets: ['Giao dịch bị ghi nhận trùng do lỗi hệ thống.', 'Thanh toán trái phép được xác minh và thông báo kịp thời.', 'Dịch vụ trả phí không được kích hoạt do lỗi từ NemarkChat và không thể khắc phục trong thời gian hợp lý.', 'Trường hợp khác mà pháp luật bắt buộc hoặc hai bên có thỏa thuận bằng văn bản.'] },
    { id: 'excluded', title: 'Trường hợp thông thường không hoàn tiền', bullets: ['Đã sử dụng gói, quota, agent, AI hoặc kênh trong chu kỳ.', 'Thay đổi nhu cầu, ngừng kinh doanh hoặc quên hủy gia hạn.', 'Tài khoản bị giới hạn do vi phạm Điều khoản/Chính sách sử dụng.', 'Sự cố chỉ phát sinh từ thiết bị, mạng hoặc nền tảng tích hợp của khách hàng.'] },
    { id: 'request', title: 'Cách gửi yêu cầu', paragraphs: ['Gửi yêu cầu tới billing@nemarkchat.com trong vòng 07 ngày kể từ giao dịch, kèm email tài khoản, mã workspace, mã hóa đơn/giao dịch, số tiền, lý do và bằng chứng liên quan. Không gửi mật khẩu, OTP hoặc thông tin thẻ đầy đủ.'] },
    { id: 'review', title: 'Đánh giá và thời gian xử lý', paragraphs: ['Chúng tôi xác nhận tiếp nhận và có thể yêu cầu bổ sung thông tin. Khi được chấp thuận, khoản hoàn được thực hiện về phương thức phù hợp; thời gian tiền về phụ thuộc ngân hàng/cổng thanh toán và không nằm hoàn toàn trong kiểm soát của NemarkChat.'] },
    { id: 'cancel', title: 'Hủy gia hạn', paragraphs: ['Hủy gia hạn ngăn chu kỳ tiếp theo nhưng không tự động hoàn phần thời gian còn lại của chu kỳ hiện tại. Workspace tiếp tục dùng đến ngày hết hạn, trừ khi bị chấm dứt vì lý do bảo mật hoặc vi phạm.'] },
    { id: 'enterprise', title: 'Hợp đồng doanh nghiệp', paragraphs: ['Với gói Enterprise, điều khoản thanh toán, tín dụng dịch vụ, nghiệm thu và hoàn phí trong báo giá/hợp đồng ký riêng được ưu tiên áp dụng.'] },
];

export default function RefundPage() {
    return <StaticPageLayout title="Chính sách hoàn tiền" description="Điều kiện và quy trình yêu cầu hoàn tiền dịch vụ NemarkChat"><LegalDocument eyebrow="Billing Policy" title="Chính sách hoàn tiền" summary="Quy định trường hợp được xem xét, trường hợp loại trừ và quy trình xử lý yêu cầu hoàn tiền cho gói NemarkChat." updatedAt="15/07/2026" sections={sections} /></StaticPageLayout>;
}
