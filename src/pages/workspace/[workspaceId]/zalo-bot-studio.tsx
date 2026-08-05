/* eslint-disable @typescript-eslint/no-explicit-any */
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Alert, Button, Card, Checkbox, Col, Form, Input, InputNumber, Row, Select, Space, Spin, Steps, Tag, message } from 'antd';
import { Bot, CheckCircle2, FlaskConical, Network, ShieldCheck } from 'lucide-react';
import AppLayout from '../../../components/layout/AppLayout';
import { chatbotService } from '../../../services/chatbot.service';
import { zaloService } from '../../../services/zalo.service';

const TEMPLATE_KEY = 'zalo-shopee-affiliate-v1';

export default function ZaloBotStudioPage() {
    const router = useRouter();
    const workspaceId = typeof router.query.workspaceId === 'string' ? router.query.workspaceId : '';
    const [accounts, setAccounts] = useState<any[]>([]);
    const [accountId, setAccountId] = useState('');
    const [loading, setLoading] = useState(true);
    const [savingBot, setSavingBot] = useState(false);
    const [savingNetwork, setSavingNetwork] = useState(false);
    const [preview, setPreview] = useState('');
    const [oaReadiness, setOAReadiness] = useState<any>(null);
    const [botForm] = Form.useForm();
    const [networkForm] = Form.useForm();

    useEffect(() => {
        if (!workspaceId) return;
        void zaloService.getStatus(workspaceId).then(res => {
            const list = res?.data?.accounts || [];
            setAccounts(list);
            setAccountId(list[0]?.accountId || '');
        }).catch(() => message.warning('Chưa tải được danh sách tài khoản Zalo.')).finally(() => setLoading(false));
        void zaloService.getOAReadiness(workspaceId).then(res => setOAReadiness(res?.data)).catch(() => setOAReadiness(null));
    }, [workspaceId]);

    useEffect(() => {
        if (!workspaceId || !accountId) return;
        void zaloService.getNetworkProfile(workspaceId, accountId).then(res => {
            networkForm.setFieldsValue({ ...res?.data, password: '' });
        }).catch(() => networkForm.resetFields());
    }, [workspaceId, accountId, networkForm]);

    const createDraft = async (values: any) => {
        setSavingBot(true);
        try {
            const res = await chatbotService.applyTemplate(workspaceId, TEMPLATE_KEY, values);
            message.success('Đã tạo bot nháp. Kiểm thử trong Trung tâm AI trước khi bật.');
            void router.push(`/workspace/${workspaceId}/chatbot?botId=${res?.data?.id || ''}`);
        } catch (error: any) {
            message.error(error?.response?.data?.error?.message || error?.response?.data?.message || 'Không tạo được bot');
        } finally { setSavingBot(false); }
    };

    const testPreview = async () => {
        try {
            const values = await botForm.validateFields();
            const res = await chatbotService.previewShopeeAffiliate(workspaceId, { ...values, message: values.sampleUrl });
            setPreview(res?.data?.response || '');
        } catch (error: any) {
            if (error?.errorFields) return;
            message.error(error?.response?.data?.error?.message || 'Link thử chưa hợp lệ');
        }
    };

    const saveNetwork = async (values: any) => {
        if (!accountId) return;
        setSavingNetwork(true);
        try {
            await zaloService.saveNetworkProfile(workspaceId, accountId, values);
            message.success('Đã lưu. Hãy kết nối lại tài khoản để áp dụng đúng một IP tĩnh.');
            networkForm.setFieldValue('password', '');
        } catch (error: any) {
            message.error(error?.response?.data?.error?.message || error?.response?.data?.message || 'Không lưu được Network Profile');
        } finally { setSavingNetwork(false); }
    };

    const testNetwork = async () => {
        if (!accountId) return;
        try {
            const res = await zaloService.testNetworkProfile(workspaceId, accountId);
            const data = res?.data;
            if (data?.ok) message.success(`Proxy hoạt động · IP ${data.exitIp || '?'} · ${data.country || '?'}`);
            else message.warning(data?.error || 'Proxy không đúng khu vực mong đợi');
        } catch (error: any) {
            message.error(error?.response?.data?.error?.message || 'Kiểm tra proxy thất bại');
        }
    };

    return (
        <AppLayout headerTitle={<Space><Bot size={20} /> Zalo Bot Studio</Space>}>
            <Head><title>Zalo Bot Studio | NemarkChat</title></Head>
            <div style={{ padding: 24, maxWidth: 1320, margin: '0 auto' }}>
                <Alert showIcon type="info" message="Triển khai an toàn theo 2 đường kết nối"
                    description="Zalo OA là đường chính thức cho sản phẩm SaaS. Zalo cá nhân hiện là connector thử nghiệm; proxy tĩnh chỉ giúp ổn định IP, không đảm bảo tài khoản không bị hạn chế." style={{ marginBottom: 20 }} />
                <Steps size="small" current={1} items={[
                    { title: 'Kết nối kênh' }, { title: 'Cấu hình template' }, { title: 'Kiểm thử' }, { title: 'Bật bot' },
                ]} style={{ marginBottom: 24 }} />

                <Row gutter={[20, 20]}>
                    <Col xs={24} xl={15}>
                        <Card title={<Space><Bot size={18} /> Template Zalo · Shopee Affiliate</Space>}>
                            <Form form={botForm} layout="vertical" onFinish={createDraft} initialValues={{
                                name: 'Trợ lý link Shopee', brandName: 'Shop của bạn', subId: 'zalo',
                                disclosure: 'Link này có thể là link tiếp thị liên kết; bạn không phải trả thêm chi phí.',
                            }}>
                                <Row gutter={14}>
                                    <Col span={12}><Form.Item name="name" label="Tên bot" rules={[{ required: true }]}><Input /></Form.Item></Col>
                                    <Col span={12}><Form.Item name="brandName" label="Tên shop" rules={[{ required: true }]}><Input /></Form.Item></Col>
                                </Row>
                                <Row gutter={14}>
                                    <Col span={12}><Form.Item name="affiliateId" label="Shopee Affiliate ID" rules={[{ required: true }]} extra="Được mã hoá trước khi lưu."><Input.Password autoComplete="new-password" /></Form.Item></Col>
                                    <Col span={12}><Form.Item name="subId" label="Sub ID chiến dịch"><Input maxLength={100} /></Form.Item></Col>
                                </Row>
                                <Form.Item name="disclosure" label="Thông báo affiliate" rules={[{ required: true }]}><Input.TextArea rows={2} maxLength={300} /></Form.Item>
                                <Form.Item name="sampleUrl" label="Link dùng để thử" rules={[{ required: true }, { type: 'url' }]}><Input placeholder="https://shopee.vn/product/..." /></Form.Item>
                                {preview && <Alert type="success" showIcon message="Kết quả thử" description={<pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{preview}</pre>} style={{ marginBottom: 16 }} />}
                                <Space wrap>
                                    <Button icon={<FlaskConical size={15} />} onClick={testPreview}>Thử tạo link</Button>
                                    <Button type="primary" htmlType="submit" loading={savingBot}>Tạo bot nháp</Button>
                                </Space>
                            </Form>
                        </Card>
                    </Col>

                    <Col xs={24} xl={9}>
                        <Card title={<Space><ShieldCheck size={18} /> Trạng thái triển khai</Space>} style={{ marginBottom: 20 }}>
                            <Space direction="vertical" style={{ width: '100%' }}>
                                <div><Tag color="green">Sẵn sàng</Tag> Template + action tạo link</div>
                                <div><Tag color="green">Sẵn sàng</Tag> Mã hoá Affiliate ID</div>
                                <div><Tag color={oaReadiness?.configured ? 'green' : 'gold'}>{oaReadiness?.configured ? 'Sẵn sàng cấp quyền' : 'Cần cấu hình'}</Tag> Zalo OA</div>
                                {oaReadiness?.missing?.length > 0 && <div style={{ color: '#64748b', fontSize: 12 }}>Thiếu trên server: {oaReadiness.missing.join(', ')}</div>}
                                <div><Tag color="blue">Thử nghiệm</Tag> Zalo cá nhân qua zca-js</div>
                            </Space>
                        </Card>
                        <Card title={<Space><Network size={18} /> Network Profile tĩnh</Space>}>
                            {loading ? <Spin /> : !accounts.length ? <Alert type="warning" showIcon message="Kết nối tài khoản Zalo trước" /> : <>
                                <Select value={accountId} onChange={setAccountId} style={{ width: '100%', marginBottom: 16 }} options={accounts.map(item => ({ value: item.accountId, label: item.name }))} />
                                <Form form={networkForm} layout="vertical" onFinish={saveNetwork} initialValues={{ protocol: 'http', expectedCountry: 'VN', enabled: false }}>
                                    <Form.Item name="enabled" valuePropName="checked"><Checkbox>Bật proxy tĩnh cho tài khoản này</Checkbox></Form.Item>
                                    <Row gutter={10}>
                                        <Col span={8}><Form.Item name="protocol" label="Loại"><Select options={['http', 'https', 'socks5'].map(value => ({ value, label: value.toUpperCase() }))} /></Form.Item></Col>
                                        <Col span={16}><Form.Item name="host" label="Host"><Input placeholder="proxy.example.com" /></Form.Item></Col>
                                    </Row>
                                    <Row gutter={10}>
                                        <Col span={10}><Form.Item name="port" label="Port"><InputNumber min={1} max={65535} style={{ width: '100%' }} /></Form.Item></Col>
                                        <Col span={14}><Form.Item name="expectedCountry" label="Quốc gia IP"><Input maxLength={2} /></Form.Item></Col>
                                    </Row>
                                    <Form.Item name="username" label="Username"><Input autoComplete="off" /></Form.Item>
                                    <Form.Item name="password" label="Password" extra="Để trống để giữ mật khẩu hiện tại."><Input.Password autoComplete="new-password" /></Form.Item>
                                    <Form.Item name="staticAcknowledged" valuePropName="checked" rules={[{ validator: (_, value) => value ? Promise.resolve() : Promise.reject(new Error('Cần xác nhận')) }]}>
                                        <Checkbox>Tôi hiểu: dùng một proxy ổn định, không xoay IP và không dùng để né chính sách.</Checkbox>
                                    </Form.Item>
                                    <Space wrap><Button htmlType="submit" loading={savingNetwork}>Lưu Network Profile</Button><Button onClick={testNetwork} icon={<CheckCircle2 size={15} />}>Kiểm tra IP</Button></Space>
                                </Form>
                            </>}
                        </Card>
                    </Col>
                </Row>
            </div>
        </AppLayout>
    );
}
