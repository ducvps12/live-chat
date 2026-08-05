import Head from 'next/head';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Form, Input, Modal, Popconfirm, Progress, Select, Space, Spin, Statistic, Switch, Table, Tag, message } from 'antd';
import { ApiOutlined, CopyOutlined } from '@ant-design/icons';
import { KeyRound, Plus, RefreshCw, ShieldCheck, Trash2, Workflow, Zap } from 'lucide-react';
import AppLayout from '../../../components/layout/AppLayout';
import { PublicAIEntitlement, PublicAIProject, PublicAIUsage, publicAIAPIService } from '../../../services/public-ai-api.service';
import { AutomationRun, AutomationWorkflow, automationService } from '../../../services/automation.service';

const modelOptions = [
    { value: 'qwen2.5:14b', label: 'qwen2.5:14b — CSKH/RAG tiếng Việt' },
    { value: 'deepseek-r1:14b', label: 'deepseek-r1:14b — suy luận sâu' },
    { value: 'qwen2.5:7b', label: 'qwen2.5:7b — phản hồi nhanh' },
    { value: 'oc/minimax-m2.5-free', label: 'oc/minimax-m2.5-free — fallback cloud' },
];

const dateTime = (value?: string | null) => value ? new Date(value).toLocaleString('vi-VN') : 'Chưa dùng';

export default function PublicAIApiPage() {
    const router = useRouter();
    const workspaceId = typeof router.query.workspaceId === 'string' ? router.query.workspaceId : '';
    const [projects, setProjects] = useState<PublicAIProject[]>([]);
    const [selectedId, setSelectedId] = useState<string>();
    const [usage, setUsage] = useState<PublicAIUsage>();
    const [entitlement, setEntitlement] = useState<PublicAIEntitlement>();
    const [loading, setLoading] = useState(true);
    const [projectOpen, setProjectOpen] = useState(false);
    const [keyOpen, setKeyOpen] = useState(false);
    const [createdSecret, setCreatedSecret] = useState('');
    const [workflows, setWorkflows] = useState<AutomationWorkflow[]>([]);
    const [workflowRuns, setWorkflowRuns] = useState<AutomationRun[]>([]);
    const [workflowOpen, setWorkflowOpen] = useState(false);
    const [projectForm] = Form.useForm();
    const [keyForm] = Form.useForm();
    const [workflowForm] = Form.useForm();

    const selectedProject = useMemo(() => projects.find(project => project.id === selectedId) || projects[0], [projects, selectedId]);
    const load = useCallback(async () => {
        if (!workspaceId) return;
        setLoading(true);
        try {
            const [nextProjects, nextEntitlement] = await Promise.all([
                publicAIAPIService.listProjects(workspaceId),
                publicAIAPIService.getEntitlement(workspaceId),
            ]);
            setProjects(nextProjects);
            setEntitlement(nextEntitlement);
            setSelectedId(current => nextProjects.some(project => project.id === current) ? current : nextProjects[0]?.id);
        } catch {
            message.error('Không tải được cấu hình API. Kiểm tra quyền workspace.');
        } finally { setLoading(false); }
    }, [workspaceId]);

    useEffect(() => { void load(); }, [load]);
    const loadWorkflows = useCallback(async () => {
        if (!workspaceId) return;
        try {
            const [nextWorkflows, nextRuns] = await Promise.all([
                automationService.list(workspaceId),
                automationService.listRuns(workspaceId),
            ]);
            setWorkflows(nextWorkflows);
            setWorkflowRuns(nextRuns);
        }
        catch { /* The workflow API becomes available after its database migration. */ }
    }, [workspaceId]);
    useEffect(() => { void loadWorkflows(); }, [loadWorkflows]);
    useEffect(() => {
        if (!workspaceId || !selectedProject?.id) { setUsage(undefined); return; }
        void publicAIAPIService.getUsage(workspaceId, selectedProject.id).then(setUsage).catch(() => setUsage(undefined));
    }, [workspaceId, selectedProject?.id]);

    const createProject = async (values: { name: string; allowedModels: string[] }) => {
        try {
            const created = await publicAIAPIService.createProject(workspaceId, values);
            message.success('Đã tạo API project. Hãy cấp key trước khi tích hợp.');
            projectForm.resetFields(); setProjectOpen(false); await load(); setSelectedId(created.id);
        } catch (error: any) { message.error(error?.response?.data?.message || 'Tạo project thất bại'); }
    };
    const createKey = async (values: { name: string }) => {
        if (!selectedProject) return;
        try {
            const result = await publicAIAPIService.issueKey(workspaceId, selectedProject.id, values);
            keyForm.resetFields(); setKeyOpen(false); setCreatedSecret(result.secret); await load();
        } catch (error: any) { message.error(error?.response?.data?.message || 'Tạo key thất bại'); }
    };
    const revokeKey = async (keyId: string) => {
        if (!selectedProject) return;
        try { await publicAIAPIService.revokeKey(workspaceId, selectedProject.id, keyId); message.success('Đã thu hồi key.'); await load(); }
        catch { message.error('Thu hồi key thất bại'); }
    };
    const copy = async (value: string, label: string) => {
        try { await navigator.clipboard.writeText(value); message.success(label); }
        catch { message.error('Không thể copy tự động'); }
    };

    const createWorkflow = async (values: Pick<AutomationWorkflow, 'name' | 'triggerType' | 'actionType' | 'approvalMode'>) => {
        try {
      if (values.approvalMode === 'automatic_safe' && values.actionType !== 'tag_conversation') {
                message.warning('Tao nhap AI va canh bao Telegram can nguoi duyet.');
                return;
            }
            await automationService.create(workspaceId, values);
            workflowForm.resetFields(); setWorkflowOpen(false); await loadWorkflows();
            message.success('Workflow da duoc luu o che do an toan.');
        } catch (error: any) { message.error(error?.response?.data?.message || 'Khong tao duoc workflow'); }
    };
    const toggleWorkflow = async (workflow: AutomationWorkflow, isActive: boolean) => {
        try {
            await automationService.setActive(workspaceId, workflow.id, isActive);
            await loadWorkflows();
        } catch (error: any) { message.error(error?.response?.data?.message || 'Khong cap nhat duoc workflow'); }
    };

    if (!workspaceId || loading) return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><Spin size="large" /></div>;
    const usagePercent = usage ? Math.min(100, Math.round((usage.requests / Math.max(usage.limit, 1)) * 100)) : 0;
    const endpoint = 'https://api.nemarkchat.com/v1/public/chat/completions';

    return (
        <AppLayout headerTitle={<><ApiOutlined style={{ marginRight: 8 }} /> API & Tự động hoá</>}>
            <Head><title>API & Tự động hoá | NemarkChat</title></Head>
            <main className="ai-api-page">
                <section className="ai-api-hero">
                    <div>
                        <Tag color="blue">Nemark AI API</Tag>
                        <h1>Dùng AI NemarkChat trong ứng dụng của bạn</h1>
                        <p>Tạo key riêng cho bot Telegram, website hoặc ứng dụng nội bộ. Key chỉ có quyền sinh phản hồi AI, không thể đọc inbox hay điều khiển hệ thống.</p>
                    </div>
                    <Space wrap>
                        <Button icon={<RefreshCw size={16} />} onClick={() => void load()}>Tải lại</Button>
                        <Button type="primary" icon={<Plus size={16} />} onClick={() => { projectForm.setFieldsValue({ allowedModels: ['qwen2.5:14b'] }); setProjectOpen(true); }}>Tạo API project</Button>
                    </Space>
                </section>
                <Alert
                    type={entitlement?.active === false ? "warning" : "info"}
                    showIcon
                    icon={<ShieldCheck size={18} />}
                    message={entitlement?.active === false ? "Public API đang bị khóa theo trạng thái gói" : "An toàn mặc định"}
                    description={entitlement?.active === false
                        ? "Hãy kích hoạt gói để tạo hoặc gọi API key. Key không bao giờ được mở trần ra Internet."
                        : `Gói ${entitlement?.planId || 'hiện tại'}: tối đa ${entitlement?.maxProjects || 0} app, ${entitlement?.monthlyRequestLimit || 0} lượt/tháng, ${entitlement?.rateLimitPerMinute || 0} lượt/phút. Secret chỉ xuất hiện một lần khi cấp key.`}
                    style={{ marginBottom: 18 }}
                />

                {projects.length === 0 ? (
                    <Card><Empty description="Chưa có API project. Tạo project đầu tiên để dùng AI ở bên ngoài NemarkChat." image={Empty.PRESENTED_IMAGE_SIMPLE}><Button type="primary" onClick={() => setProjectOpen(true)}>Tạo API project</Button></Empty></Card>
                ) : <>
                    <Card style={{ marginBottom: 18 }}>
                        <div className="ai-api-summary">
                            <div style={{ minWidth: 240, flex: 1 }}><b>Ứng dụng đang chọn</b><Select value={selectedProject?.id} onChange={setSelectedId} options={projects.map(project => ({ value: project.id, label: project.name }))} style={{ width: '100%', maxWidth: 420, marginTop: 8 }} /></div>
                            <Space size="large" wrap>
                                <Statistic title="Quota tháng" value={`${usage?.requests || 0}/${selectedProject?.monthlyRequestLimit || 0}`} />
                                <Statistic title="Rate limit" value={`${selectedProject?.rateLimitPerMinute || 0}/phút`} />
                                <Statistic title="Đồng thời" value={selectedProject?.concurrencyLimit || 0} />
                            </Space>
                        </div>
                        <Progress percent={usagePercent} status={usagePercent >= 90 ? 'exception' : 'active'} style={{ marginTop: 18 }} />
                    </Card>

                    <div className="ai-api-grid">
                        <Card title={<Space><KeyRound size={18} /> API keys</Space>} extra={<Button type="primary" size="small" onClick={() => setKeyOpen(true)}>Cấp key mới</Button>}>
                            <Table size="small" rowKey="id" pagination={false} dataSource={selectedProject?.keys || []} locale={{ emptyText: 'Chưa có key. Cấp một key để bắt đầu tích hợp.' }} columns={[
                                { title: 'Key', dataIndex: 'prefix', render: (prefix: string) => <code>{prefix}••••••••</code> },
                                { title: 'Tên', dataIndex: 'name' },
                                { title: 'Lần cuối dùng', dataIndex: 'lastUsedAt', render: dateTime },
                                { title: 'Trạng thái', dataIndex: 'isActive', render: (active: boolean) => <Tag color={active ? 'green' : 'default'}>{active ? 'Đang hoạt động' : 'Đã thu hồi'}</Tag> },
                                { title: '', key: 'actions', width: 52, render: (_: unknown, key: any) => key.isActive ? <Popconfirm title="Thu hồi key này?" description="Không thể hoàn tác." okText="Thu hồi" okButtonProps={{ danger: true }} onConfirm={() => void revokeKey(key.id)}><Button type="text" danger icon={<Trash2 size={16} />} /></Popconfirm> : null },
                            ]} />
                        </Card>
                        <Card title={<Space><Zap size={18} /> Model & tích hợp</Space>}>
                            <p className="muted">Model được phép gọi trong project này:</p>
                            <Space wrap style={{ marginBottom: 16 }}>{selectedProject?.allowedModels.map(model => <Tag key={model} color="geekblue">{model}</Tag>)}</Space>
                            <Input.TextArea readOnly rows={7} value={`curl ${endpoint} \\\n+  -H "Authorization: Bearer nmk_live_..." \\\n+  -H "Content-Type: application/json" \\\n+  -d '{"model":"${selectedProject?.allowedModels[0] || 'qwen2.5:14b'}","messages":[{"role":"user","content":"Xin chào"}]}'`} className="ai-api-code" />
                            <Button block icon={<CopyOutlined size={16} />} style={{ marginTop: 10 }} onClick={() => void copy(endpoint, 'Đã copy endpoint')}>Copy endpoint</Button>
                        </Card>
                    </div>
                </>}
                <Card
                    title={<Space><Workflow size={18} /> Workflow AI tự động hoá</Space>}
                    extra={<Space><Button size="small" icon={<RefreshCw size={15} />} onClick={() => void loadWorkflows()}>Làm mới</Button><Button type="primary" size="small" icon={<Plus size={15} />} onClick={() => { workflowForm.setFieldsValue({ triggerType: 'message_received', actionType: 'draft_reply', approvalMode: 'required' }); setWorkflowOpen(true); }}>Tạo workflow</Button></Space>}
                    style={{ marginTop: 18 }}
                >
                    <Alert
                        type="info"
                        showIcon
                        message="Đã chạy thật với tin nhắn mới"
                        description="Workflow hiện hỗ trợ tạo nháp AI để nhân viên duyệt hoặc tự động gắn tag an toàn. Hệ thống không tự gửi tin, xoá dữ liệu hay thay đổi thanh toán."
                        style={{ marginBottom: 14 }}
                    />
                    <Table
                        size="small"
                        rowKey="id"
                        pagination={false}
                        dataSource={workflows}
                        locale={{ emptyText: 'Chua co workflow. Tao mot quy tac nho de thu nghiem an toan.' }}
                        columns={[
                            { title: 'Tên workflow', dataIndex: 'name' },
                            { title: 'Kích hoạt khi', dataIndex: 'triggerType', render: (value: string) => value === 'message_received' ? 'Có tin nhắn mới' : <Tag color="default">Chưa hỗ trợ: {value}</Tag> },
                            { title: 'Xử lý', dataIndex: 'actionType', render: (value: string) => ({ draft_reply: 'Tạo nháp AI', tag_conversation: 'Gắn tag' }[value] || `Chưa hỗ trợ: ${value}`) },
                            { title: 'Phê duyệt', dataIndex: 'approvalMode', render: (value: string) => <Tag color={value === 'required' ? 'gold' : 'green'}>{value === 'required' ? 'Người duyệt' : 'Tự động an toàn'}</Tag> },
                            { title: 'Bật', dataIndex: 'isActive', width: 76, render: (active: boolean, workflow: AutomationWorkflow) => <Switch size="small" checked={active} disabled={!['draft_reply', 'tag_conversation'].includes(workflow.actionType) || workflow.triggerType !== 'message_received'} onChange={(checked) => void toggleWorkflow(workflow, checked)} /> },
                        ]}
                    />
                    <div className="automation-runs">
                        <b>Hoat dong gan day</b>
                        {workflowRuns.length === 0 ? <p className="muted">Chua co lan chay nao. Workflow chi chay sau khi ban bat no va co tin nhan moi.</p> : (
                            <Table
                                size="small"
                                rowKey="id"
                                pagination={false}
                                dataSource={workflowRuns.slice(0, 8)}
                                columns={[
                                    { title: 'Thoi gian', dataIndex: 'createdAt', render: dateTime },
                                    { title: 'Hanh dong', dataIndex: 'actionType' },
                                    { title: 'Ket qua', dataIndex: 'status', render: (value: string) => <Tag color={value === 'completed' ? 'green' : value === 'needs_review' ? 'gold' : value === 'failed' ? 'red' : 'default'}>{value === 'needs_review' ? 'Can duyet' : value === 'completed' ? 'Hoan tat' : value === 'skipped' ? 'Bo qua' : 'That bai'}</Tag> },
                                    { title: 'Chi tiet', dataIndex: 'summary', ellipsis: true },
                                ]}
                            />
                        )}
                    </div>
                </Card>
            </main>
            <Modal title="Tạo API project" open={projectOpen} onCancel={() => setProjectOpen(false)} onOk={() => projectForm.submit()} okText="Tạo project">
                <Form form={projectForm} layout="vertical" onFinish={createProject}>
                    <Form.Item name="name" label="Tên ứng dụng" rules={[{ required: true, message: 'Nhập tên để dễ quản lý key' }]}><Input placeholder="Ví dụ: Bot Telegram bán hàng" maxLength={80} /></Form.Item>
                    <Form.Item name="allowedModels" label="Model được phép" rules={[{ required: true, message: 'Chọn ít nhất một model' }]}><Select mode="multiple" options={modelOptions} /></Form.Item>
                </Form>
            </Modal>
            <Modal title="Cấp API key" open={keyOpen} onCancel={() => setKeyOpen(false)} onOk={() => keyForm.submit()} okText="Tạo key">
                <Form form={keyForm} layout="vertical" onFinish={createKey}><Form.Item name="name" label="Tên key" rules={[{ required: true }]}><Input placeholder="Ví dụ: production-telegram" maxLength={80} /></Form.Item><Alert type="warning" showIcon message="Key chỉ hiển thị đúng một lần" description="Sau khi đóng kết quả, chỉ có thể thu hồi và tạo key mới." /></Form>
            </Modal>
            <Modal title="Sao chép API key ngay" open={Boolean(createdSecret)} footer={<Button type="primary" onClick={() => setCreatedSecret('')}>Tôi đã lưu an toàn</Button>} closable={false}>
                <Alert type="warning" showIcon message="Secret này sẽ không hiển thị lại." />
                <Input value={createdSecret} readOnly addonAfter={<Button type="text" size="small" icon={<CopyOutlined size={15} />} onClick={() => void copy(createdSecret, 'Đã copy API key')} />} style={{ marginTop: 14, fontFamily: 'ui-monospace, monospace' }} />
            </Modal>
            <Modal title="Tạo workflow AI an toàn" open={workflowOpen} onCancel={() => setWorkflowOpen(false)} onOk={() => workflowForm.submit()} okText="Lưu workflow">
                <Form form={workflowForm} layout="vertical" onFinish={createWorkflow}>
                    <Form.Item name="name" label="Tên workflow" rules={[{ required: true, message: 'Nhập tên workflow' }]}><Input placeholder="Ví dụ: Tạo nháp cho tin nhắn mới" maxLength={80} /></Form.Item>
                    <Form.Item name="triggerType" label="Kích hoạt khi" rules={[{ required: true }]}>
                        <Select options={[
                            { value: 'message_received', label: 'Có tin nhắn mới' },
                        ]} />
                    </Form.Item>
                    <Form.Item name="actionType" label="Hành động" rules={[{ required: true }]}>
                        <Select options={[
                            { value: 'draft_reply', label: 'Tạo nháp trả lời AI (cần duyệt)' },
                            { value: 'tag_conversation', label: 'Tự động gắn tag cho hội thoại' },
                        ]} />
                    </Form.Item>
                    <Form.Item name="approvalMode" label="Chế độ phê duyệt" rules={[{ required: true }]}>
                        <Select options={[
                            { value: 'required', label: 'Người duyệt trước khi sử dụng nháp' },
                            { value: 'automatic_safe', label: 'Tự động (chỉ dành cho gắn tag)' },
                        ]} />
                    </Form.Item>
                    <Alert type="success" showIcon message="Backend đã chạy thật" description="Khi workflow được bật và có tin nhắn mới, hệ thống sẽ tạo nháp nội bộ hoặc gắn tag rồi ghi kết quả vào Hoạt động gần đây. Nháp AI không tự gửi cho khách." />
                </Form>
            </Modal>
            <style jsx>{`
                .ai-api-page { max-width: 1320px; margin: 0 auto; padding: 24px 28px 44px; }
                .ai-api-hero { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 22px; }
                .ai-api-hero h1 { margin: 8px 0 0; color: #102044; font-size: 27px; }
                .ai-api-hero p, .muted { color: #64748b; max-width: 720px; }
                .ai-api-summary { display: flex; flex-wrap: wrap; gap: 24px; align-items: center; justify-content: space-between; }
                .ai-api-grid { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(360px, .9fr); gap: 18px; }
                .ai-api-code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
                .automation-runs { margin-top: 20px; padding-top: 16px; border-top: 1px solid #edf1f7; }
                .automation-runs .muted { margin: 8px 0 0; }
                @media (max-width: 900px) { .ai-api-grid { grid-template-columns: 1fr; } }
                @media (max-width: 600px) { .ai-api-page { padding: 16px 12px 34px; } .ai-api-hero { display: grid; } .ai-api-hero h1 { font-size: 23px; } }
            `}</style>
        </AppLayout>
    );
}
