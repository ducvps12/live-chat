import LegalDocument, { type LegalSection } from '../components/legal/LegalDocument';
import StaticPageLayout from '../components/layout/StaticPageLayout';

const sections: LegalSection[] = [
    {
        id: 'scope', title: 'Phạm vi và vai trò xử lý dữ liệu',
        paragraphs: [
            'Chính sách này áp dụng khi bạn truy cập nemarkchat.com, tạo tài khoản hoặc sử dụng workspace NemarkChat. Với dữ liệu tài khoản và thanh toán, NemarkChat quyết định mục đích xử lý. Với nội dung hội thoại do khách hàng doanh nghiệp đưa vào hệ thống, khách hàng doanh nghiệp quyết định mục đích và NemarkChat xử lý theo chỉ dẫn của họ.',
        ],
    },
    {
        id: 'data', title: 'Dữ liệu chúng tôi thu thập',
        bullets: [
            'Thông tin tài khoản: họ tên, email, số điện thoại, ảnh đại diện, vai trò và workspace.',
            'Nội dung dịch vụ: hội thoại, tệp đính kèm, thông tin khách hàng, sản phẩm, đơn hàng, kịch bản và Kho tri thức.',
            'Dữ liệu tích hợp: định danh kênh, token kết nối và metadata từ Zalo, Facebook, email hoặc website theo quyền bạn cấp.',
            'Dữ liệu kỹ thuật: địa chỉ IP, user-agent, phiên đăng nhập, log lỗi, thời gian truy cập và sự kiện bảo mật.',
            'Dữ liệu thanh toán: gói dịch vụ, hóa đơn, trạng thái đối soát; NemarkChat không yêu cầu lưu số thẻ ngân hàng đầy đủ.',
        ],
    },
    {
        id: 'purpose', title: 'Mục đích và căn cứ xử lý',
        paragraphs: ['Chúng tôi xử lý dữ liệu để thực hiện hợp đồng dịch vụ, bảo vệ hệ thống, hỗ trợ khách hàng, đối soát thanh toán, tuân thủ nghĩa vụ pháp lý và cải tiến sản phẩm. Hoạt động tiếp thị cần sự đồng ý hoặc có cơ chế từ chối phù hợp.'],
    },
    {
        id: 'ai', title: 'AI và dữ liệu hội thoại',
        paragraphs: [
            'Khi tính năng AI được bật, nội dung cần thiết của hội thoại, kịch bản và Kho tri thức có thể được gửi tới provider AI do quản trị viên hệ thống lựa chọn để tạo phản hồi. NemarkChat giới hạn context theo nhu cầu của yêu cầu và không dùng dữ liệu workspace để huấn luyện mô hình dùng chung nếu không có thỏa thuận riêng.',
            'Khách hàng doanh nghiệp chịu trách nhiệm thông báo cho người nhắn tin về việc dùng AI khi pháp luật hoặc ngữ cảnh yêu cầu, đồng thời cấu hình cơ chế agent tiếp quản với các tình huống cần con người xử lý.',
        ],
    },
    {
        id: 'sharing', title: 'Bên nhận và nhà cung cấp phụ trợ',
        paragraphs: ['Dữ liệu chỉ được chia sẻ cho nhân sự được phân quyền, nhà cung cấp hạ tầng/provider cần thiết để vận hành dịch vụ, cơ quan có thẩm quyền theo yêu cầu hợp pháp hoặc bên tiếp nhận trong giao dịch tái cấu trúc có biện pháp bảo vệ tương đương. Chúng tôi không bán dữ liệu cá nhân.'],
    },
    {
        id: 'retention', title: 'Thời hạn lưu trữ và xóa',
        paragraphs: ['Dữ liệu được giữ trong thời gian tài khoản hoạt động và khoảng thời gian hợp lý sau khi chấm dứt để sao lưu, giải quyết tranh chấp và tuân thủ pháp luật. Chủ workspace có thể yêu cầu xuất hoặc xóa dữ liệu; một số bản ghi hóa đơn, giao dịch và audit có thể phải giữ lâu hơn theo nghĩa vụ pháp lý.'],
    },
    {
        id: 'security', title: 'Bảo vệ dữ liệu',
        bullets: [
            'TLS cho kết nối web/API và mật khẩu được băm trước khi lưu.',
            'Phân quyền theo tài khoản, vai trò và workspace; phiên có thể bị thu hồi.',
            'Secret tích hợp được hạn chế hiển thị và chỉ dùng cho mục đích kết nối đã cấu hình.',
            'Log vận hành, sao lưu và quy trình xử lý sự cố được duy trì theo mức độ rủi ro.',
        ],
    },
    {
        id: 'rights', title: 'Quyền của chủ thể dữ liệu',
        paragraphs: ['Tùy trường hợp và pháp luật áp dụng, bạn có thể yêu cầu được biết, truy cập, sửa, rút lại sự đồng ý, hạn chế, phản đối, xóa hoặc nhận bản sao dữ liệu. Nếu bạn là người liên hệ của một khách hàng doanh nghiệp, trước hết hãy gửi yêu cầu cho doanh nghiệp đó; NemarkChat sẽ hỗ trợ họ xử lý yêu cầu hợp lệ.'],
    },
    {
        id: 'cookies', title: 'Cookie và phiên đăng nhập',
        paragraphs: ['Cookie cần thiết được dùng để duy trì phiên, chống lạm dụng và ghi nhớ cấu hình. Cookie đo lường hoặc tiếp thị, nếu được bổ sung, sẽ được quản lý theo cơ chế đồng ý phù hợp. Chặn cookie cần thiết có thể làm đăng nhập hoặc workspace không hoạt động.'],
    },
    {
        id: 'contact', title: 'Thay đổi và liên hệ',
        paragraphs: ['Khi có thay đổi quan trọng, chúng tôi sẽ thông báo trên dịch vụ hoặc qua email trước thời điểm áp dụng hợp lý. Yêu cầu quyền riêng tư gửi tới privacy@nemarkchat.com; yêu cầu hỗ trợ chung gửi tới support@nemarkchat.com.'],
    },
];

export default function PrivacyPage() {
    return (
        <StaticPageLayout title="Chính sách quyền riêng tư" description="Cách NemarkChat thu thập, sử dụng, bảo vệ và hỗ trợ quyền đối với dữ liệu cá nhân.">
            <LegalDocument eyebrow="Dữ liệu cá nhân" title="Chính sách quyền riêng tư" summary="Tài liệu này giải thích dữ liệu nào được xử lý khi sử dụng NemarkChat, vì sao chúng tôi cần dữ liệu đó và cách bạn thực hiện quyền của mình." updatedAt="15/07/2026" sections={sections} />
        </StaticPageLayout>
    );
}
