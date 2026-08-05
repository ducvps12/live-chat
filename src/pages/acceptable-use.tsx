import LegalDocument, { type LegalSection } from '../components/legal/LegalDocument';
import StaticPageLayout from '../components/layout/StaticPageLayout';

const sections: LegalSection[] = [
    { id: 'principles', title: 'Nguyên tắc chung', paragraphs: ['Chỉ sử dụng NemarkChat cho mục đích hợp pháp, minh bạch và có quyền đối với dữ liệu/kênh được kết nối. Hoạt động của một workspace không được gây hại cho người dùng khác, nền tảng hoặc nhà cung cấp tích hợp.'] },
    { id: 'illegal', title: 'Nội dung và hành vi bị cấm', bullets: ['Lừa đảo, mạo danh, đe dọa, quấy rối hoặc xâm phạm quyền của người khác.', 'Phát tán mã độc, nội dung bất hợp pháp hoặc hướng dẫn thực hiện hành vi phạm pháp.', 'Thu thập, mua bán hoặc tiết lộ dữ liệu cá nhân trái phép.', 'Gửi nội dung vi phạm sở hữu trí tuệ, bí mật kinh doanh hoặc quyền riêng tư.'] },
    { id: 'messaging', title: 'Tin nhắn, chiến dịch và chống spam', paragraphs: ['Bạn phải có căn cứ phù hợp để liên hệ người nhận, nhận diện người gửi và cung cấp cách từ chối khi cần. Không dùng campaign, bot hay nhiều workspace để né giới hạn, tiếp tục gửi cho người đã từ chối hoặc tạo lưu lượng gây ảnh hưởng kênh.'] },
    { id: 'security', title: 'Bảo mật và truy cập', bullets: ['Không thăm dò, khai thác hoặc vượt qua kiểm soát truy cập/quota.', 'Không chia sẻ, bán hoặc cho thuê tài khoản trái phép.', 'Không tự động hóa request ngoài API/tính năng được công bố.', 'Không can thiệp log, audit, tính cước hoặc phép đo sử dụng.'] },
    { id: 'ai', title: 'Sử dụng AI có trách nhiệm', paragraphs: ['Không cấu hình AI để giả danh con người trong tình huống dễ gây nhầm lẫn nghiêm trọng, tạo quyết định phân biệt đối xử hoặc đưa tư vấn chuyên môn có rủi ro cao mà không có người kiểm duyệt. Bạn chịu trách nhiệm với prompt, Kho tri thức, output được gửi và cơ chế tiếp quản.'] },
    { id: 'channels', title: 'Điều khoản của kênh', paragraphs: ['Lưu lượng qua Zalo, Facebook, Google, email và dịch vụ khác phải tuân thủ policy của từng bên. Việc một tính năng kỹ thuật cho phép gửi không đồng nghĩa với việc hành vi đó được nền tảng nguồn hoặc pháp luật cho phép.'] },
    { id: 'limits', title: 'Tài nguyên và giới hạn hợp lý', paragraphs: ['Không tạo tải bất thường, scrape, vòng lặp webhook, tệp quá mức hoặc request có mục đích làm suy giảm dịch vụ. Khi cần lưu lượng lớn, hãy liên hệ để thống nhất quota và kiến trúc phù hợp.'] },
    { id: 'enforcement', title: 'Xử lý vi phạm', paragraphs: ['Tùy mức độ, NemarkChat có thể cảnh báo, giới hạn tính năng, chặn nội dung, tạm ngừng tích hợp/workspace hoặc chấm dứt tài khoản. Trường hợp rủi ro tức thời có thể được xử lý trước khi thông báo.'] },
    { id: 'report', title: 'Báo cáo lạm dụng', paragraphs: ['Gửi bằng chứng, workspace/kênh liên quan và thời gian xảy ra tới abuse@nemarkchat.com. Chúng tôi có thể yêu cầu thêm thông tin và sẽ hạn chế tiết lộ chi tiết điều tra để bảo vệ các bên.'] },
];

export default function AcceptableUsePage() {
    return <StaticPageLayout title="Chính sách sử dụng" description="Các hành vi được phép và bị cấm khi sử dụng NemarkChat"><LegalDocument eyebrow="Acceptable Use" title="Chính sách sử dụng chấp nhận được" summary="Những nguyên tắc bảo vệ khách hàng cuối, kênh tích hợp và hạ tầng chung khi dùng inbox, campaign, automation và AI." updatedAt="15/07/2026" sections={sections} /></StaticPageLayout>;
}
