import LegalDocument, { type LegalSection } from '../components/legal/LegalDocument';
import StaticPageLayout from '../components/layout/StaticPageLayout';

const sections: LegalSection[] = [
    { id: 'program', title: 'Chương trình bảo mật', paragraphs: ['NemarkChat áp dụng biện pháp kỹ thuật và tổ chức theo rủi ro của nền tảng CSKH đa tenant. Kiểm soát được rà soát khi kiến trúc, provider hoặc mức độ nhạy cảm của dữ liệu thay đổi.'] },
    { id: 'access', title: 'Danh tính và truy cập', bullets: ['Mật khẩu được băm; phiên đăng nhập có thời hạn và có thể thu hồi.', 'RBAC tách quyền admin hệ thống, owner/admin workspace và agent.', 'Truy cập vận hành được giới hạn theo nhu cầu công việc và được ghi nhận khi phù hợp.', 'Secret API/OAuth được che trên giao diện quản trị và không đưa vào bundle frontend.'] },
    { id: 'transport', title: 'Mạng và truyền dữ liệu', paragraphs: ['Lưu lượng production đi qua HTTPS/TLS tại Cloudflare và Nginx. API, Socket.IO và webhook được định tuyến qua domain đã cấu hình; port nội bộ không được coi là giao diện công khai.'] },
    { id: 'application', title: 'Bảo mật ứng dụng', bullets: ['Xác thực, kiểm tra vai trò và phạm vi workspace tại API.', 'Validation, chống lặp webhook/message và giới hạn request tại bề mặt công khai.', 'Dependency/build được kiểm tra trước release và lỗi server không trả stack trace ở production.', 'AI gateway yêu cầu bearer token với client ngoài; provider key chỉ nằm ở server.'] },
    { id: 'availability', title: 'Khả dụng, sao lưu và khôi phục', paragraphs: ['Dịch vụ có health check cho web/API, database và AI provider. Dữ liệu cần được sao lưu định kỳ và kiểm thử khôi phục; thời gian khôi phục thực tế phụ thuộc gói, phạm vi sự cố và thỏa thuận SLA riêng.'] },
    { id: 'incident', title: 'Xử lý sự cố', paragraphs: ['Khi phát hiện sự cố, chúng tôi ưu tiên cô lập, bảo toàn bằng chứng, đánh giá phạm vi, khắc phục và thông báo cho bên bị ảnh hưởng theo nghĩa vụ pháp lý hoặc hợp đồng. Khách hàng cần cung cấp đầu mối bảo mật cập nhật.'] },
    { id: 'customer', title: 'Trách nhiệm của khách hàng', bullets: ['Bật các kiểm soát tài khoản phù hợp và thu hồi thành viên không còn nhiệm vụ.', 'Không chia sẻ token, cookie phiên hoặc mật khẩu qua kênh không an toàn.', 'Chỉ kết nối dữ liệu/kênh mà tổ chức có quyền sử dụng.', 'Kiểm duyệt phản hồi AI cho quy trình có rủi ro cao.'] },
    { id: 'report', title: 'Báo cáo lỗ hổng', paragraphs: ['Gửi mô tả, bước tái hiện và mức ảnh hưởng tới security@nemarkchat.com. Không truy cập dữ liệu người khác, làm gián đoạn production hoặc công khai lỗ hổng trước khi hai bên có thời gian hợp lý để khắc phục.'] },
];

export default function SecurityPage() {
    return <StaticPageLayout title="Bảo mật" description="Tổng quan biện pháp bảo mật và quy trình báo cáo lỗ hổng NemarkChat"><LegalDocument eyebrow="Trust Center" title="Bảo mật tại NemarkChat" summary="Tổng quan các lớp bảo vệ tài khoản, workspace, API, hạ tầng và AI cùng trách nhiệm phối hợp của khách hàng." updatedAt="15/07/2026" sections={sections} /></StaticPageLayout>;
}
