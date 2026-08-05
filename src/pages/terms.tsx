import LegalDocument, { type LegalSection } from '../components/legal/LegalDocument';
import StaticPageLayout from '../components/layout/StaticPageLayout';

const sections: LegalSection[] = [
    { id: 'acceptance', title: 'Chấp nhận và phạm vi điều khoản', paragraphs: ['Bằng việc tạo tài khoản, mua gói hoặc tiếp tục sử dụng NemarkChat, bạn xác nhận có thẩm quyền đại diện cho tổ chức của mình và đồng ý với Điều khoản này, Chính sách quyền riêng tư, Chính sách sử dụng chấp nhận được và các điều kiện của gói đã chọn.'] },
    { id: 'service', title: 'Dịch vụ NemarkChat', paragraphs: ['NemarkChat cung cấp workspace CSKH đa kênh, inbox, CRM, báo cáo, tự động hóa, tích hợp và tính năng AI. Tính năng, quota và mức hỗ trợ phụ thuộc gói; bản beta hoặc tích hợp bên thứ ba có thể thay đổi khi nền tảng nguồn thay đổi.'] },
    { id: 'account', title: 'Tài khoản và workspace', bullets: ['Cung cấp thông tin chính xác và cập nhật.', 'Bảo mật thông tin đăng nhập, không dùng chung tài khoản cá nhân.', 'Phân quyền thành viên theo nguyên tắc tối thiểu cần thiết.', 'Thông báo ngay khi nghi ngờ tài khoản, token hoặc kênh tích hợp bị xâm nhập.'] },
    { id: 'customer-data', title: 'Dữ liệu khách hàng', paragraphs: ['Bạn giữ quyền đối với dữ liệu đưa vào workspace và cho NemarkChat quyền xử lý dữ liệu đó trong phạm vi cần thiết để cung cấp, bảo vệ và hỗ trợ dịch vụ. Bạn chịu trách nhiệm có căn cứ hợp lệ để thu thập, đồng bộ và sử dụng dữ liệu từ khách hàng cuối hoặc kênh bên thứ ba.'] },
    { id: 'channels', title: 'Kênh và dịch vụ bên thứ ba', paragraphs: ['Việc kết nối Zalo, Facebook, Google, email, ngân hàng hoặc dịch vụ khác còn chịu điều khoản của nhà cung cấp tương ứng. Bạn chịu trách nhiệm với quyền truy cập đã cấp; NemarkChat không kiểm soát thay đổi API, giới hạn hay gián đoạn từ các bên này.'] },
    { id: 'ai', title: 'Tính năng AI', paragraphs: ['AI có thể tạo nội dung không chính xác hoặc không phù hợp. Bạn phải cấu hình Kho tri thức, quy tắc, giới hạn và cơ chế agent kiểm duyệt/takeover phù hợp. Không dùng phản hồi AI làm tư vấn y tế, pháp lý, tài chính hoặc quyết định có ảnh hưởng đáng kể nếu không có người đủ chuyên môn xem xét.'] },
    { id: 'billing', title: 'Gói, quota và thanh toán', paragraphs: ['Phí, chu kỳ, quota agent/hội thoại/AI và ngày gia hạn hiển thị tại trang thanh toán hoặc báo giá. Thuế và phí ngân hàng áp dụng theo quy định. Khi vượt quota, tính năng có thể bị giới hạn cho đến khi nâng gói hoặc bước sang chu kỳ mới. Chính sách hoàn tiền được công bố riêng tại /refund.'] },
    { id: 'acceptable-use', title: 'Sử dụng chấp nhận được', paragraphs: ['Bạn không được dùng dịch vụ để spam, lừa đảo, xâm phạm quyền, phát tán mã độc, truy cập trái phép, né quota hoặc xử lý dữ liệu mà không có căn cứ. Danh sách chi tiết tại /acceptable-use là một phần của Điều khoản này.'] },
    { id: 'availability', title: 'Khả dụng và hỗ trợ', paragraphs: ['Chúng tôi nỗ lực duy trì dịch vụ ổn định và thông báo bảo trì quan trọng. SLA chỉ áp dụng khi được ghi rõ trong gói hoặc hợp đồng riêng. Sự cố từ Internet, Cloudflare, điện/lưới, thiết bị khách hàng hoặc nền tảng tích hợp nằm ngoài phạm vi kiểm soát trực tiếp.'] },
    { id: 'ip', title: 'Quyền sở hữu trí tuệ', paragraphs: ['NemarkChat và thành phần nền tảng thuộc Nemark Digital hoặc bên cấp phép. Bạn không được sao chép, bán lại, dịch ngược hoặc dùng nhãn hiệu ngoài phạm vi cho phép. Phản hồi góp ý có thể được dùng để cải tiến sản phẩm mà không làm lộ dữ liệu bí mật của bạn.'] },
    { id: 'suspension', title: 'Tạm ngừng và chấm dứt', paragraphs: ['Bạn có thể ngừng gia hạn hoặc yêu cầu đóng tài khoản. Chúng tôi có thể hạn chế dịch vụ ngay để ngăn rủi ro bảo mật, vi phạm pháp luật, lạm dụng hoặc nợ quá hạn; khi hợp lý, chúng tôi sẽ thông báo và tạo cơ hội khắc phục. Việc xuất/xóa dữ liệu thực hiện theo policy và nghĩa vụ lưu trữ.'] },
    { id: 'liability', title: 'Bảo đảm và giới hạn trách nhiệm', paragraphs: ['Dịch vụ được cung cấp theo trạng thái hiện có trong phạm vi pháp luật cho phép. Không bên nào chịu trách nhiệm cho thiệt hại gián tiếp hoặc mất lợi nhuận ngoài khả năng dự liệu hợp lý. Giới hạn cụ thể không loại trừ trách nhiệm không thể loại trừ theo pháp luật áp dụng hoặc thỏa thuận doanh nghiệp riêng.'] },
    { id: 'law', title: 'Luật áp dụng và giải quyết tranh chấp', paragraphs: ['Các bên ưu tiên thương lượng thiện chí. Nếu không giải quyết được, tranh chấp được xử lý theo pháp luật Việt Nam và cơ quan có thẩm quyền, trừ khi hợp đồng riêng quy định cơ chế khác.'] },
    { id: 'changes', title: 'Thay đổi và liên hệ', paragraphs: ['Thay đổi quan trọng sẽ được thông báo trước một khoảng thời gian hợp lý. Việc tiếp tục dùng dịch vụ sau ngày hiệu lực thể hiện chấp nhận bản cập nhật. Câu hỏi về hợp đồng gửi legal@nemarkchat.com; hỗ trợ vận hành gửi support@nemarkchat.com.'] },
];

export default function TermsPage() {
    return (
        <StaticPageLayout title="Điều khoản dịch vụ" description="Điều khoản điều chỉnh việc đăng ký, sử dụng và thanh toán dịch vụ NemarkChat.">
            <LegalDocument eyebrow="Thỏa thuận dịch vụ" title="Điều khoản dịch vụ" summary="Điều khoản này xác định quyền, trách nhiệm và giới hạn áp dụng cho tài khoản, workspace, tích hợp, AI và gói dịch vụ NemarkChat." updatedAt="15/07/2026" sections={sections} />
        </StaticPageLayout>
    );
}
