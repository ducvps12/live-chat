import { ReactElement } from 'react';
import { useRouter } from 'next/router';
import type { NextPageWithLayout } from '../_app';
import PublicLayout from '@/components/layout/PublicLayout';
import SeoHead from '@/components/common/SeoHead';
import Link from 'next/link';

// Policy data với nội dung chi tiết
const policiesData: Record<string, PolicyDetail> = {
    'terms-of-service': {
        icon: 'gavel',
        iconColor: 'blue',
        title: 'Điều khoản sử dụng',
        date: '01/01/2024',
        description: 'Điều khoản và điều kiện sử dụng dịch vụ Nemark Inbox',
        sections: [
            {
                title: '1. Giới thiệu',
                content: `Chào mừng bạn đến với Nemark Inbox. Bằng việc truy cập và sử dụng dịch vụ của chúng tôi, bạn đồng ý tuân thủ các điều khoản và điều kiện được nêu trong tài liệu này.

Nemark Inbox là nền tảng live chat hỗ trợ doanh nghiệp tương tác với khách hàng một cách hiệu quả. Chúng tôi cam kết cung cấp dịch vụ chất lượng cao với độ tin cậy và bảo mật tối đa.`
            },
            {
                title: '2. Quy định về tài khoản & trách nhiệm',
                content: `**2.1. Đăng ký tài khoản**
- Bạn phải cung cấp thông tin chính xác và đầy đủ khi đăng ký
- Mỗi người chỉ được sở hữu một tài khoản chính
- Bạn có trách nhiệm bảo mật thông tin đăng nhập của mình

**2.2. Trách nhiệm người dùng**
- Không sử dụng dịch vụ cho mục đích bất hợp pháp
- Không spam hoặc gửi tin nhắn rác qua hệ thống
- Tuân thủ các quy định về bảo vệ dữ liệu cá nhân
- Không chia sẻ tài khoản cho bên thứ ba`
            },
            {
                title: '3. Chính sách thanh toán & hoàn tiền',
                content: `**3.1. Thanh toán**
- Các gói dịch vụ được tính phí theo tháng hoặc năm
- Thanh toán được xử lý qua các cổng thanh toán bảo mật
- Hóa đơn sẽ được gửi qua email đã đăng ký

**3.2. Hoàn tiền**
- Hoàn tiền 100% trong vòng 7 ngày đầu tiên nếu không hài lòng
- Sau 7 ngày, hoàn tiền theo tỷ lệ thời gian còn lại
- Không hoàn tiền cho các vi phạm điều khoản dịch vụ`
            },
            {
                title: '4. Điều kiện chấm dứt hợp đồng',
                content: `**4.1. Hủy bởi người dùng**
- Bạn có thể hủy tài khoản bất kỳ lúc nào
- Dữ liệu sẽ được lưu trữ 30 ngày trước khi xóa vĩnh viễn

**4.2. Hủy bởi Nemark**
- Vi phạm điều khoản sử dụng
- Hoạt động gian lận hoặc bất hợp pháp
- Không thanh toán sau 30 ngày quá hạn`
            },
            {
                title: '5. Giới hạn trách nhiệm',
                content: `Nemark Inbox không chịu trách nhiệm về:
- Thiệt hại gián tiếp do gián đoạn dịch vụ
- Nội dung được tạo bởi người dùng
- Tổn thất do hành vi của bên thứ ba

Trách nhiệm tối đa của chúng tôi không vượt quá số tiền bạn đã thanh toán trong 12 tháng gần nhất.`
            }
        ]
    },
    'privacy-policy': {
        icon: 'shield_lock',
        iconColor: 'primary',
        title: 'Chính sách bảo mật',
        date: '15/02/2024',
        description: 'Cách chúng tôi thu thập, sử dụng và bảo vệ dữ liệu của bạn',
        sections: [
            {
                title: '1. Dữ liệu chúng tôi thu thập',
                content: `**1.1. Thông tin bạn cung cấp trực tiếp**
- Thông tin đăng ký: Tên, email, số điện thoại, công ty
- Thông tin thanh toán: Thông tin thẻ, địa chỉ thanh toán
- Nội dung chat: Tin nhắn giữa bạn và khách hàng

**1.2. Thông tin thu thập tự động**
- Log truy cập: IP, thời gian, thiết bị, trình duyệt
- Cookie và tracking: Phân tích hành vi sử dụng
- Thông tin kỹ thuật: Hệ điều hành, phiên bản app`
            },
            {
                title: '2. Cách chúng tôi sử dụng dữ liệu',
                content: `**2.1. Cung cấp dịch vụ**
- Xử lý và lưu trữ tin nhắn chat
- Quản lý tài khoản và xác thực
- Gửi thông báo quan trọng về dịch vụ

**2.2. Cải thiện dịch vụ**
- Phân tích để nâng cao trải nghiệm người dùng
- Phát triển tính năng mới dựa trên feedback
- Tối ưu hóa hiệu suất hệ thống

**2.3. Marketing (có sự đồng ý)**
- Gửi tin tức và cập nhật sản phẩm
- Thông báo chương trình ưu đãi`
            },
            {
                title: '3. Quyền riêng tư của bạn (GDPR/CCPA)',
                content: `**3.1. Quyền của bạn theo GDPR**
- **Quyền truy cập**: Yêu cầu bản sao dữ liệu cá nhân
- **Quyền chỉnh sửa**: Cập nhật thông tin không chính xác
- **Quyền xóa**: Yêu cầu xóa dữ liệu ("right to be forgotten")
- **Quyền hạn chế**: Giới hạn xử lý dữ liệu
- **Quyền di chuyển**: Nhận dữ liệu ở định dạng có thể đọc được

**3.2. Quyền theo CCPA (California)**
- Biết dữ liệu nào được thu thập và mục đích
- Yêu cầu xóa thông tin cá nhân
- Từ chối bán thông tin cá nhân
- Không bị phân biệt đối xử khi thực hiện quyền`
            },
            {
                title: '4. Bảo mật dữ liệu',
                content: `**4.1. Biện pháp kỹ thuật**
- Mã hóa TLS/SSL cho tất cả dữ liệu truyền tải
- Mã hóa AES-256 cho dữ liệu lưu trữ
- Xác thực đa yếu tố (2FA)
- Kiểm tra bảo mật định kỳ

**4.2. Biện pháp tổ chức**
- Đào tạo nhân viên về bảo mật
- Kiểm soát truy cập dựa trên vai trò
- Quy trình ứng phó sự cố bảo mật`
            },
            {
                title: '5. Liên hệ về quyền riêng tư',
                content: `Nếu bạn có câu hỏi về chính sách bảo mật hoặc muốn thực hiện các quyền của mình, vui lòng liên hệ:

**Email**: privacy@nemark.com
**Địa chỉ**: [Địa chỉ công ty]

Chúng tôi cam kết phản hồi trong vòng 30 ngày.`
            }
        ]
    },
    'cookie-policy': {
        icon: 'cookie',
        iconColor: 'orange',
        title: 'Chính sách Cookie',
        date: '01/01/2024',
        description: 'Thông tin về cách chúng tôi sử dụng cookie và công nghệ theo dõi',
        sections: [
            {
                title: '1. Cookie là gì?',
                content: `Cookie là các tệp văn bản nhỏ được lưu trữ trên thiết bị của bạn khi truy cập website. Chúng giúp website nhớ các tùy chọn của bạn và cải thiện trải nghiệm sử dụng.

Nemark Inbox sử dụng cookie và công nghệ tương tự để cung cấp, bảo vệ và cải thiện dịch vụ của chúng tôi.`
            },
            {
                title: '2. Các loại cookie được sử dụng',
                content: `**2.1. Cookie thiết yếu** ⚙️
- Cookie xác thực phiên đăng nhập
- Cookie bảo mật CSRF
- Cookie cân bằng tải
*Không thể tắt vì cần thiết cho hoạt động của website*

**2.2. Cookie hiệu suất** 📊
- Google Analytics để phân tích lưu lượng
- Tracking thời gian tải trang
- Giám sát lỗi ứng dụng

**2.3. Cookie chức năng** 🔧
- Lưu tùy chọn ngôn ngữ
- Nhớ cài đặt giao diện (dark mode)
- Lưu lịch sử chat gần đây

**2.4. Cookie marketing** 📢
- Facebook Pixel (nếu được bật)
- Google Ads remarketing
- LinkedIn Insight Tag`
            },
            {
                title: '3. Thời gian lưu trữ cookie',
                content: `| Loại Cookie | Thời gian lưu trữ |
|-------------|-------------------|
| Session cookies | Xóa khi đóng trình duyệt |
| Xác thực | 30 ngày |
| Tùy chọn | 1 năm |
| Analytics | 2 năm |
| Marketing | 90 ngày |

Bạn có thể xóa cookie bất kỳ lúc nào thông qua cài đặt trình duyệt.`
            },
            {
                title: '4. Hướng dẫn tắt tracking',
                content: `**4.1. Qua cài đặt Nemark**
Truy cập Dashboard > Cài đặt > Quyền riêng tư để tùy chọn cookie

**4.2. Qua trình duyệt**
- **Chrome**: Settings > Privacy > Cookies
- **Firefox**: Options > Privacy & Security
- **Safari**: Preferences > Privacy
- **Edge**: Settings > Cookies and site permissions

**4.3. Công cụ từ chối**
- [Google Analytics Opt-out](https://tools.google.com/dlpage/gaoptout)
- [Your Online Choices](https://www.youronlinechoices.com/)

⚠️ **Lưu ý**: Tắt một số cookie có thể ảnh hưởng đến chức năng website.`
            }
        ]
    },
    'retention-policy': {
        icon: 'database',
        iconColor: 'green',
        title: 'Chính sách lưu trữ (Retention)',
        date: '01/03/2024',
        description: 'Quy định về thời gian lưu trữ và quản lý dữ liệu',
        sections: [
            {
                title: '1. Thời hạn lưu trữ log chat',
                content: `**1.1. Theo gói dịch vụ**

| Gói | Thời gian lưu trữ |
|-----|-------------------|
| Free | 30 ngày |
| Starter | 6 tháng |
| Business | 2 năm |
| Enterprise | Tùy chỉnh (lên đến 7 năm) |

**1.2. Loại dữ liệu**
- **Tin nhắn chat**: Theo gói dịch vụ
- **Tệp đính kèm**: 90 ngày sau tin nhắn cuối
- **Log hệ thống**: 1 năm
- **Dữ liệu phân tích**: 2 năm`
            },
            {
                title: '2. Quy trình sao lưu (Backup)',
                content: `**2.1. Tần suất backup**
- Backup realtime cho tin nhắn mới
- Backup đầy đủ hàng ngày lúc 3:00 AM UTC
- Backup incremental mỗi 4 giờ

**2.2. Địa điểm lưu trữ**
- Primary: AWS S3 (Singapore)
- Secondary: Google Cloud Storage (Taiwan)
- Mã hóa AES-256 cho tất cả backup

**2.3. Thời gian giữ backup**
- Daily backups: 30 ngày
- Weekly backups: 12 tuần
- Monthly backups: 12 tháng`
            },
            {
                title: '3. Quy trình xóa vĩnh viễn',
                content: `**3.1. Xóa theo yêu cầu**
1. Gửi yêu cầu qua email: privacy@nemark.com
2. Xác nhận danh tính qua 2FA
3. Xử lý trong vòng 30 ngày
4. Nhận xác nhận xóa hoàn tất

**3.2. Xóa tự động**
- Dữ liệu quá hạn lưu trữ: Xóa trong 7 ngày
- Tài khoản bị hủy: Xóa sau 30 ngày grace period
- Tài khoản không hoạt động 2 năm: Thông báo trước khi xóa

**3.3. Phương pháp xóa**
- Secure deletion với overwrite 3 lần
- Xóa cả backup sau 90 ngày
- Log audit cho quá trình xóa`
            },
            {
                title: '4. Xuất dữ liệu',
                content: `Bạn có quyền xuất toàn bộ dữ liệu của mình:

**Định dạng hỗ trợ**
- JSON (đầy đủ, có cấu trúc)
- CSV (bảng tính)
- PDF (báo cáo)

**Cách thực hiện**
1. Vào Dashboard > Cài đặt > Xuất dữ liệu
2. Chọn phạm vi thời gian và định dạng
3. Nhận link download qua email (có hiệu lực 7 ngày)

Thời gian xử lý: 15 phút - 24 giờ tùy dung lượng.`
            }
        ]
    },
    'dpa': {
        icon: 'description',
        iconColor: 'purple',
        title: 'Data Processing Agreement (DPA)',
        date: '01/01/2024',
        description: 'Thỏa thuận xử lý dữ liệu theo chuẩn GDPR',
        sections: [
            {
                title: '1. Phạm vi và mục đích',
                content: `Thỏa thuận xử lý dữ liệu (DPA) này quy định nghĩa vụ của Nemark Inbox với tư cách là **Data Processor** khi xử lý dữ liệu cá nhân thay mặt cho khách hàng (**Data Controller**).

DPA tuân thủ:
- GDPR (EU General Data Protection Regulation)
- CCPA (California Consumer Privacy Act)
- LGPD (Brazil)
- PDPA (Singapore, Thailand)`
            },
            {
                title: '2. Cam kết xử lý dữ liệu chuẩn EU',
                content: `**2.1. Nguyên tắc xử lý**
- Chỉ xử lý theo hướng dẫn bằng văn bản của Controller
- Đảm bảo tính bảo mật và toàn vẹn dữ liệu
- Hỗ trợ Controller đáp ứng quyền của chủ thể dữ liệu
- Xóa hoặc trả lại dữ liệu khi kết thúc dịch vụ

**2.2. Biện pháp bảo vệ**
- Mã hóa end-to-end
- Pseudonymization khi có thể
- Kiểm tra bảo mật định kỳ
- Đào tạo nhân viên về GDPR`
            },
            {
                title: '3. Vai trò Controller vs Processor',
                content: `**Data Controller (Khách hàng của Nemark)**
- Quyết định mục đích và phương tiện xử lý
- Thu thập consent từ end-users
- Chịu trách nhiệm về tính hợp pháp
- Phản hồi yêu cầu từ chủ thể dữ liệu

**Data Processor (Nemark Inbox)**
- Xử lý dữ liệu theo hướng dẫn của Controller
- Triển khai biện pháp bảo mật
- Thông báo về data breach
- Hỗ trợ audit và compliance

**Sub-processors**
- Phải được Controller phê duyệt
- Chịu cùng nghĩa vụ như Nemark
- Danh sách công khai tại /legal/sub-processors`
            },
            {
                title: '4. Cơ chế chuyển dữ liệu quốc tế',
                content: `**4.1. Standard Contractual Clauses (SCCs)**
Nemark sử dụng SCCs mới nhất (2021) cho việc chuyển dữ liệu ra ngoài EEA.

**4.2. Đánh giá tác động (TIA)**
Chúng tôi thực hiện Transfer Impact Assessment cho mỗi quốc gia nhận dữ liệu.

**4.3. Biện pháp bổ sung**
- Mã hóa trong transit và at-rest
- Pseudonymization
- Giới hạn truy cập nghiêm ngặt
- Chính sách "zero access" cho nhân viên

**4.4. Vị trí Data Center**
- Primary: Singapore (AWS)
- Backup: Taiwan (GCP)
- EU option: Frankfurt (cho khách hàng EU)`
            },
            {
                title: '5. Ký kết DPA',
                content: `Để ký DPA chính thức với Nemark:

1. **Tài khoản Business/Enterprise**: DPA tự động được bao gồm
2. **Tài khoản Starter**: Gửi yêu cầu qua email

**Liên hệ**
- Email: legal@nemark.com
- Subject: "DPA Request - [Tên công ty]"

Chúng tôi sẽ gửi DPA đã ký trong vòng 5 ngày làm việc.`
            }
        ]
    },
    'sub-processors': {
        icon: 'hub',
        iconColor: 'pink',
        title: 'Danh sách Sub-processors',
        date: '10/03/2024',
        description: 'Danh sách các bên thứ ba được ủy quyền xử lý dữ liệu',
        sections: [
            {
                title: '1. Đối tác hạ tầng (Infrastructure)',
                content: `| Tên | Mục đích | Vị trí | Chứng nhận |
|-----|----------|--------|------------|
| **Amazon Web Services** | Cloud hosting, storage | Singapore | SOC 2, ISO 27001, GDPR |
| **Google Cloud Platform** | Backup, CDN | Taiwan, US | SOC 2, ISO 27001, GDPR |
| **Cloudflare** | CDN, DDoS protection | Global | SOC 2, ISO 27001 |
| **MongoDB Atlas** | Database | Singapore | SOC 2, HIPAA, GDPR |`
            },
            {
                title: '2. Dịch vụ tích hợp bên thứ 3',
                content: `| Tên | Mục đích | Dữ liệu xử lý | Vị trí |
|-----|----------|--------------|--------|
| **Stripe** | Payment processing | Billing info | US, EU |
| **SendGrid** | Email delivery | Email addresses | US |
| **Twilio** | SMS notifications | Phone numbers | US |
| **Intercom** | Customer support | Support tickets | US |
| **Sentry** | Error tracking | Technical logs | US |
| **Google Analytics** | Usage analytics | Anonymous data | US |

Tất cả đối tác đều có DPA tuân thủ GDPR.`
            },
            {
                title: '3. Dịch vụ AI & Machine Learning',
                content: `| Tên | Mục đích | Dữ liệu | Cam kết |
|-----|----------|---------|---------|
| **OpenAI** | AI chatbot (optional) | Chat content | No training on customer data |
| **Google Vertex AI** | Sentiment analysis | Anonymized text | Data deletion after processing |

⚠️ **Lưu ý**: Các tính năng AI là tùy chọn và có thể được tắt trong cài đặt workspace.`
            },
            {
                title: '4. Đăng ký nhận thông báo thay đổi',
                content: `Chúng tôi sẽ thông báo ít nhất **30 ngày** trước khi thêm sub-processor mới.

**Cách đăng ký nhận thông báo:**

1. **Qua Dashboard**
   - Vào Cài đặt > Bảo mật > Thông báo Sub-processor
   - Bật toggle "Nhận thông báo"

2. **Qua Email**
   - Gửi email đến: subprocessor-updates@nemark.com
   - Subject: "Subscribe - [Email của bạn]"

**Quyền phản đối**
Nếu bạn phản đối một sub-processor mới, bạn có quyền:
- Yêu cầu giải thích chi tiết
- Thương lượng giải pháp thay thế
- Hủy dịch vụ mà không bị phạt (trong 30 ngày)`
            },
            {
                title: '5. Lịch sử thay đổi',
                content: `| Ngày | Thay đổi | Chi tiết |
|------|----------|----------|
| 10/03/2024 | Thêm mới | Google Vertex AI - Sentiment analysis |
| 15/01/2024 | Thêm mới | MongoDB Atlas - Database migration |
| 01/12/2023 | Xóa | Firebase - Migrated to MongoDB |
| 15/10/2023 | Cập nhật | AWS - New region Singapore |

Xem changelog đầy đủ tại GitHub repository của chúng tôi.`
            }
        ]
    }
};

interface PolicySection {
    title: string;
    content: string;
}

interface PolicyDetail {
    icon: string;
    iconColor: string;
    title: string;
    date: string;
    description: string;
    sections: PolicySection[];
}

const getIconColorClass = (color: string) => {
    const colorMap: Record<string, string> = {
        blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
        primary: 'bg-electric-blue/20 text-electric-blue border-electric-blue/30',
        orange: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
        green: 'bg-green-500/10 text-green-500 border-green-500/20',
        purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
        pink: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
    };
    return colorMap[color] || colorMap.blue;
};

const PolicyDetailPage: NextPageWithLayout = () => {
    const router = useRouter();
    const { slug } = router.query;

    const policy = slug ? policiesData[slug as string] : null;

    if (router.isFallback || !slug) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-electric-blue border-t-transparent"></div>
            </div>
        );
    }

    if (!policy) {
        return (
            <>
                <SeoHead title="Không tìm thấy trang - Nemark Inbox" description="Tài liệu bạn đang tìm kiếm không tồn tại hoặc đã bị di chuyển." />
                <section className="min-h-screen py-32 px-6 flex items-center justify-center">
                    <div className="text-center">
                        <span className="material-symbols-outlined text-6xl text-gray-300 mb-4">
                            search_off
                        </span>
                        <h1 className="text-3xl font-bold text-gray-900 mb-4">
                            Không tìm thấy tài liệu
                        </h1>
                        <p className="text-gray-600 mb-8">
                            Tài liệu bạn đang tìm kiếm không tồn tại hoặc đã bị di chuyển.
                        </p>
                        <Link
                            href="/legal"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-electric-blue text-white rounded-xl font-bold hover:shadow-lg transition-all"
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                            Quay lại trang Pháp lý
                        </Link>
                    </div>
                </section>
            </>
        );
    }

    return (
        <>
            <SeoHead
                title={`${policy.title} - Nemark Inbox`}
                description={policy.description}
                canonical={`https://nemark.com/legal/${slug}`}
            />

            {/* Hero Section */}
            <section className="relative pt-32 pb-16 px-6 overflow-hidden">
                {/* Background gradient */}
                <div className="absolute inset-0 bg-gradient-to-b from-gray-50 to-white -z-10" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-electric-blue/5 rounded-full blur-3xl -z-10" />

                <div className="max-w-[900px] mx-auto">
                    {/* Breadcrumb */}
                    <nav className="flex items-center gap-2 text-sm text-gray-500 mb-8">
                        <Link href="/" className="hover:text-electric-blue transition-colors">
                            Trang chủ
                        </Link>
                        <span className="material-symbols-outlined text-base">chevron_right</span>
                        <Link href="/legal" className="hover:text-electric-blue transition-colors">
                            Pháp lý
                        </Link>
                        <span className="material-symbols-outlined text-base">chevron_right</span>
                        <span className="text-gray-900 font-medium">{policy.title}</span>
                    </nav>

                    {/* Header */}
                    <div className="flex items-start gap-6 mb-8">
                        <div
                            className={`size-16 rounded-2xl flex items-center justify-center border shrink-0 ${getIconColorClass(
                                policy.iconColor
                            )}`}
                        >
                            <span className="material-symbols-outlined text-3xl">{policy.icon}</span>
                        </div>
                        <div>
                            <h1 className="text-4xl font-black text-gray-900 mb-2">{policy.title}</h1>
                            <p className="text-gray-600 text-lg">{policy.description}</p>
                            <p className="text-sm text-gray-400 mt-2 font-mono">
                                Cập nhật lần cuối: {policy.date}
                            </p>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-electric-blue">
                                format_list_bulleted
                            </span>
                            Mục lục
                        </h3>
                        <ul className="space-y-2">
                            {policy.sections.map((section, idx) => (
                                <li key={idx}>
                                    <a
                                        href={`#section-${idx}`}
                                        className="text-gray-600 hover:text-electric-blue transition-colors text-sm flex items-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-base">
                                            arrow_right
                                        </span>
                                        {section.title}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </section>

            {/* Content Sections */}
            <section className="py-8 px-6">
                <div className="max-w-[900px] mx-auto space-y-12">
                    {policy.sections.map((section, idx) => (
                        <article
                            key={idx}
                            id={`section-${idx}`}
                            className="scroll-mt-24"
                        >
                            <h2 className="text-2xl font-bold text-gray-900 mb-6 pb-3 border-b border-gray-200">
                                {section.title}
                            </h2>
                            <div
                                className="prose prose-gray max-w-none 
                                    prose-p:text-gray-600 prose-p:leading-relaxed
                                    prose-strong:text-gray-900 prose-strong:font-semibold
                                    prose-ul:text-gray-600 prose-li:marker:text-electric-blue
                                    prose-table:border prose-table:border-gray-200 prose-table:rounded-lg
                                    prose-th:bg-gray-50 prose-th:p-3 prose-th:text-left prose-th:font-semibold prose-th:text-gray-900
                                    prose-td:p-3 prose-td:border-t prose-td:border-gray-200
                                    prose-a:text-electric-blue prose-a:no-underline hover:prose-a:underline"
                                dangerouslySetInnerHTML={{
                                    __html: formatContent(section.content)
                                }}
                            />
                        </article>
                    ))}
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-16 px-6">
                <div className="max-w-[900px] mx-auto">
                    <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-8 text-center">
                        <h3 className="text-2xl font-bold text-white mb-4">
                            Có câu hỏi về chính sách này?
                        </h3>
                        <p className="text-gray-400 mb-6">
                            Đội ngũ pháp lý của chúng tôi sẵn sàng hỗ trợ bạn
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <a
                                href="mailto:legal@nemark.com"
                                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-electric-blue text-white rounded-xl font-bold hover:shadow-[0_0_20px_rgba(13,166,242,0.3)] transition-all"
                            >
                                <span className="material-symbols-outlined">mail</span>
                                Liên hệ bộ phận Pháp lý
                            </a>
                            <Link
                                href="/legal"
                                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white/10 text-white rounded-xl font-bold hover:bg-white/20 transition-all border border-white/20"
                            >
                                <span className="material-symbols-outlined">arrow_back</span>
                                Xem tất cả chính sách
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
};

// Helper function to format markdown-like content to HTML
function formatContent(content: string): string {
    return content
        // Headers (not used in current content but good to have)
        .replace(/^### (.+)$/gm, '<h4 class="text-lg font-semibold text-gray-900 mt-4 mb-2">$1</h4>')
        // Bold text
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // Tables
        .replace(/\|(.+)\|/g, (match) => {
            const isHeader = match.includes('---');
            if (isHeader) return '';
            const cells = match.split('|').filter(cell => cell.trim());
            const cellTag = match === match.split('\n')[0] ? 'th' : 'td';
            return `<tr>${cells.map(cell => `<${cellTag}>${cell.trim()}</${cellTag}>`).join('')}</tr>`;
        })
        // Wrap tables
        .replace(/(<tr>.*<\/tr>\n?)+/g, '<table class="w-full border-collapse my-4">$&</table>')
        // Lists
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>\n?)+/g, '<ul class="list-disc pl-6 space-y-1">$&</ul>')
        // Numbered lists
        .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
        // Line breaks
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br/>')
        // Wrap in paragraph
        .replace(/^/, '<p>')
        .replace(/$/, '</p>')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        // Emojis spacing
        .replace(/(⚙️|📊|🔧|📢|⚠️)/g, '<span class="mr-1">$1</span>');
}

PolicyDetailPage.getLayout = function getLayout(page: ReactElement) {
    return <PublicLayout>{page}</PublicLayout>;
};

export default PolicyDetailPage;
