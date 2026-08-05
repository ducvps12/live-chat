import React, { useMemo } from 'react';
import Link from 'next/link';
import {
    AlertTriangle,
    ArrowDownRight,
    ArrowRight,
    ArrowUpRight,
    Bot,
    CheckCircle2,
    Clock3,
    Download,
    Gauge,
    Inbox,
    MessageSquare,
    PackageCheck,
    Tags,
    Target,
    UserRoundCheck,
    Users,
    WalletCards,
    type LucideIcon,
} from 'lucide-react';
import {
    Area,
    AreaChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart,
    Tooltip as ChartTooltip,
    XAxis,
    YAxis,
} from 'recharts';
import type {
    AnalyticsAttentionConversation,
    AnalyticsReport,
    MetricComparison,
} from './analytics.types';
import {
    downloadAnalyticsCsv,
    formatCurrency,
    formatDateTime,
    formatDuration,
    formatNumber,
    formatPercent,
    formatShortDateTime,
    getComparisonLabel,
    getComparisonTone,
    PERIOD_LABELS,
} from './analytics.utils';

const CHANNEL_META: Record<string, { label: string; color: string }> = {
    website: { label: 'Website', color: '#2563eb' },
    widget: { label: 'Website', color: '#2563eb' },
    zalo: { label: 'Zalo', color: '#0891b2' },
    facebook: { label: 'Facebook', color: '#4f46e5' },
    email: { label: 'Email', color: '#d97706' },
    unknown: { label: 'Chưa xác định', color: '#64748b' },
};

const SENTIMENT_COLORS: Record<string, string> = {
    positive: '#059669',
    neutral: '#64748b',
    negative: '#dc2626',
};

const SLA_LABELS: Record<AnalyticsAttentionConversation['slaState'], string> = {
    breached: 'Quá SLA',
    at_risk: 'Sắp quá SLA',
    on_track: 'Trong SLA',
    none: 'Chưa đặt SLA',
};

const normalizeLabel = (value: string) => {
    const normalized = value.replace(/[_-]+/g, ' ').trim();
    if (!normalized) return 'Chưa xác định';
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const getChannelMeta = (channel: string) => CHANNEL_META[channel] || {
    label: normalizeLabel(channel),
    color: '#64748b',
};

const getInboxChannel = (channel: string) => {
    if (channel === 'website') return 'widget';
    if (['zalo', 'facebook', 'email', 'widget'].includes(channel)) return channel;
    return 'all';
};

type ReportProps = {
    data: AnalyticsReport;
    workspaceId: string;
};

export default function WorkspaceAnalyticsReport({ data, workspaceId }: ReportProps) {
    const chartData = useMemo(() => data.timeSeries.map(bucket => ({
        ...bucket,
        conversations: bucket.conversations,
        messages: bucket.messages,
        resolved: bucket.resolved,
    })), [data.timeSeries]);

    const attentionItems = data.operations?.attentionConversations ?? [];
    const agents = data.agentPerformance ?? [];
    const leadStages = data.leadFunnel?.stages ?? [];
    const leadSources = data.leadFunnel?.sources ?? [];
    const orderStatuses = data.orderFunnel?.statuses ?? [];
    const sentiment = data.sentiment;
    const tags = data.tags ?? [];

    return (
        <div className="analytics-report-v3">
            <style>{reportStyles}</style>

            <section className="report-intro">
                <div>
                    <span className="report-eyebrow"><Gauge size={14} /> Báo cáo vận hành</span>
                    <h1>Hiệu suất chăm sóc khách hàng</h1>
                    <p>
                        {PERIOD_LABELS[data.period.key]} · {formatDateTime(data.period.start)} đến {formatDateTime(data.period.end)}
                    </p>
                </div>
                <div className="report-intro-actions">
                    <span>Cập nhật {formatShortDateTime(data.generatedAt)}</span>
                    <button type="button" onClick={() => downloadAnalyticsCsv(data)} title="Xuất báo cáo CSV">
                        <Download size={16} /> Xuất CSV
                    </button>
                </div>
            </section>

            <section className="report-kpi-grid" aria-label="Chỉ số tổng quan">
                <ReportKpi
                    icon={MessageSquare}
                    label="Hội thoại"
                    value={formatNumber(data.kpis.conversations)}
                    helper={`${formatNumber(data.kpis.resolved)} đã xử lý`}
                    comparison={data.comparison?.conversations}
                    tone="blue"
                />
                <ReportKpi
                    icon={UserRoundCheck}
                    label="Tỷ lệ phản hồi"
                    value={formatPercent(data.kpis.responseRate)}
                    helper={`${formatPercent(data.kpis.resolutionRate)} tỷ lệ xử lý`}
                    comparison={data.comparison?.responseRate}
                    tone="teal"
                />
                <ReportKpi
                    icon={Clock3}
                    label="Phản hồi đầu"
                    value={formatDuration(data.kpis.avgFirstResponseSeconds)}
                    helper="Càng thấp càng tốt"
                    comparison={data.comparison?.avgFirstResponseSeconds}
                    lowerIsBetter
                    tone="amber"
                />
                <ReportKpi
                    icon={AlertTriangle}
                    label="SLA cần xử lý"
                    value={formatNumber((data.kpis.slaBreached ?? 0) + (data.kpis.slaAtRisk ?? 0))}
                    helper={`${formatNumber(data.kpis.slaBreached)} quá hạn · ${formatNumber(data.kpis.slaAtRisk)} sắp hạn`}
                    tone="red"
                />
                <ReportKpi
                    icon={Target}
                    label="Lead"
                    value={formatNumber(data.kpis.leads)}
                    helper={`${formatPercent(data.kpis.leadToOrderRate)} chuyển thành đơn`}
                    comparison={data.comparison?.leads}
                    tone="violet"
                />
                <ReportKpi
                    icon={WalletCards}
                    label="Giá trị đơn"
                    value={formatCurrency(data.kpis.orderValue)}
                    helper={`${formatNumber(data.kpis.orders)} đơn trong kỳ`}
                    comparison={data.comparison?.orderValue}
                    tone="green"
                />
            </section>

            <section className="report-primary-grid">
                <article className="report-panel report-trend-panel">
                    <ReportPanelHeader
                        title="Nhịp hội thoại"
                        copy="So sánh lượng hội thoại, tin nhắn và số phiên đã xử lý theo thời gian."
                        meta={<span className="report-data-badge"><i /> Dữ liệu trực tiếp</span>}
                    />
                    <div className="report-chart-scroll">
                        <div className="report-trend-chart">
                            {chartData.length ? (
                                <AreaChart
                                    responsive
                                    style={{ width: '100%', height: '100%' }}
                                    data={chartData}
                                    margin={{ top: 18, right: 16, left: -12, bottom: 0 }}
                                >
                                        <defs>
                                            <linearGradient id="reportConversationArea" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#2563eb" stopOpacity=".22" />
                                                <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
                                            </linearGradient>
                                            <linearGradient id="reportResolvedArea" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#059669" stopOpacity=".16" />
                                                <stop offset="100%" stopColor="#059669" stopOpacity="0" />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid vertical={false} stroke="#e6ebf2" strokeDasharray="4 5" />
                                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                                        <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                        <ChartTooltip contentStyle={{ border: '1px solid #d9e1eb', borderRadius: 8, boxShadow: '0 12px 28px rgba(15,23,42,.10)' }} />
                                        <Area name="Tin nhắn" type="monotone" dataKey="messages" stroke="#64748b" strokeWidth={1.75} fill="transparent" />
                                        <Area name="Đã xử lý" type="monotone" dataKey="resolved" stroke="#059669" strokeWidth={2} fill="url(#reportResolvedArea)" />
                                        <Area name="Hội thoại" type="monotone" dataKey="conversations" stroke="#2563eb" strokeWidth={2.5} fill="url(#reportConversationArea)" />
                                </AreaChart>
                            ) : (
                                <ReportEmpty icon={MessageSquare} title="Chưa có hội thoại trong kỳ" copy="Chọn khoảng thời gian dài hơn để xem xu hướng." />
                            )}
                        </div>
                    </div>
                    <div className="report-chart-legend" aria-label="Chú thích biểu đồ">
                        <span><i className="blue" /> Hội thoại</span>
                        <span><i className="green" /> Đã xử lý</span>
                        <span><i className="gray" /> Tin nhắn</span>
                    </div>
                </article>

                <article className="report-panel report-operations-panel">
                    <ReportPanelHeader title="Việc cần xử lý" copy="Ảnh chụp trạng thái vận hành hiện tại." />
                    <div className="report-operation-list">
                        <OperationRow icon={AlertTriangle} label="Đã quá SLA" value={data.operations?.slaBreached ?? 0} tone="red" />
                        <OperationRow icon={Clock3} label="Sắp quá SLA" value={data.operations?.slaAtRisk ?? 0} tone="amber" />
                        <OperationRow icon={Users} label="Chưa phân công" value={data.operations?.unassignedOpen ?? 0} tone="blue" />
                        <OperationRow icon={Inbox} label="Chưa đọc" value={data.operations?.unreadOpen ?? 0} tone="violet" />
                    </div>
                    <Link className="report-panel-link" href={`/workspace/${workspaceId}/inbox`}>
                        Mở inbox vận hành <ArrowRight size={15} />
                    </Link>
                </article>
            </section>

            <article className="report-panel report-attention-panel">
                <ReportPanelHeader
                    title="Hội thoại cần ưu tiên"
                    copy="Xếp theo SLA, mức ưu tiên và thời gian khách đang chờ."
                    meta={<span className="report-count-badge">{attentionItems.length} hội thoại</span>}
                />
                <div className="report-table-wrap">
                    <table className="report-table report-attention-table">
                        <thead>
                            <tr>
                                <th>Khách hàng</th>
                                <th>Kênh</th>
                                <th>SLA</th>
                                <th>Người phụ trách</th>
                                <th>Khách chờ</th>
                                <th>Tin mới</th>
                                <th aria-label="Mở hội thoại" />
                            </tr>
                        </thead>
                        <tbody>
                            {attentionItems.map(item => (
                                <AttentionRow key={item.id} item={item} workspaceId={workspaceId} />
                            ))}
                            {!attentionItems.length && (
                                <tr><td colSpan={7}><ReportEmpty icon={CheckCircle2} title="Hàng đợi đang ổn" copy="Không có hội thoại nào cần ưu tiên tại thời điểm này." /></td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </article>

            <section className="report-secondary-grid">
                <article className="report-panel">
                    <ReportPanelHeader title="Hiệu quả theo kênh" copy="Khối lượng và chất lượng phản hồi trên từng điểm chạm." />
                    <div className="report-table-wrap">
                        <table className="report-table report-channel-table">
                            <thead>
                                <tr>
                                    <th>Kênh</th>
                                    <th>Hội thoại</th>
                                    <th>Đã xử lý</th>
                                    <th>Phản hồi</th>
                                    <th>Phản hồi đầu</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.channels.map(channel => {
                                    const meta = getChannelMeta(channel.channel);
                                    return (
                                        <tr key={channel.channel}>
                                            <td><span className="report-channel"><i style={{ background: meta.color }} /> {meta.label}</span></td>
                                            <td>{formatNumber(channel.conversations)}</td>
                                            <td>{formatNumber(channel.resolved)}</td>
                                            <td>{formatPercent(channel.responseRate)}</td>
                                            <td>{formatDuration(channel.avgFirstResponseSeconds)}</td>
                                        </tr>
                                    );
                                })}
                                {!data.channels.length && <tr><td colSpan={5}><ReportEmpty icon={MessageSquare} title="Chưa có dữ liệu kênh" copy="Dữ liệu xuất hiện khi workspace nhận hội thoại." /></td></tr>}
                            </tbody>
                        </table>
                    </div>
                </article>

                <article className="report-panel">
                    <ReportPanelHeader title="Thời gian phản hồi đầu" copy="Phân bổ số hội thoại theo ngưỡng phản hồi." />
                    <div className="report-bar-list">
                        {data.responseTimeBuckets.map(bucket => (
                            <div className="report-bar-row" key={bucket.key}>
                                <div><span>{bucket.label}</span><strong>{formatNumber(bucket.count)}</strong></div>
                                <div className="report-bar-track"><i style={{ width: `${bucket.count ? Math.max(4, bucket.percent) : 0}%` }} /></div>
                                <small>{formatPercent(bucket.percent)}</small>
                            </div>
                        ))}
                        {!data.responseTimeBuckets.length && <ReportEmpty icon={Clock3} title="Chưa đủ mẫu phản hồi" copy="Cần có tin khách và phản hồi của agent để tính chỉ số." />}
                    </div>
                </article>
            </section>

            <section className="report-agent-grid">
                <article className="report-panel report-agent-panel">
                    <ReportPanelHeader title="Hiệu suất đội ngũ" copy="Khối lượng được giao, xử lý và tốc độ phản hồi theo agent." />
                    <div className="report-table-wrap">
                        <table className="report-table report-agent-table">
                            <thead>
                                <tr>
                                    <th>Agent</th>
                                    <th>Được giao</th>
                                    <th>Đã xử lý</th>
                                    <th>Tỷ lệ xử lý</th>
                                    <th>Tin đã gửi</th>
                                    <th>Phản hồi đầu</th>
                                </tr>
                            </thead>
                            <tbody>
                                {agents.map(agent => (
                                    <tr key={agent.agentId}>
                                        <td>
                                            <div className="report-agent-person">
                                                <span>{agent.name.charAt(0).toUpperCase()}</span>
                                                <div><strong>{agent.name}</strong><small>{normalizeLabel(agent.role)}</small></div>
                                            </div>
                                        </td>
                                        <td>{formatNumber(agent.assigned)}</td>
                                        <td>{formatNumber(agent.resolved)}</td>
                                        <td>{formatPercent(agent.resolutionRate)}</td>
                                        <td>{formatNumber(agent.sentMessages)}</td>
                                        <td>{formatDuration(agent.avgFirstResponseSeconds)}</td>
                                    </tr>
                                ))}
                                {!agents.length && <tr><td colSpan={6}><ReportEmpty icon={Bot} title="Chưa có hoạt động agent" copy="Bảng sẽ hiển thị khi agent được giao hoặc phản hồi hội thoại." /></td></tr>}
                            </tbody>
                        </table>
                    </div>
                </article>

                <article className="report-panel report-funnel-panel">
                    <ReportPanelHeader title="Phễu doanh thu" copy="Lead và đơn hàng phát sinh trong kỳ." />
                    <div className="report-funnel-summary">
                        <div><span>Lead</span><strong>{formatNumber(data.leadFunnel?.total)}</strong></div>
                        <ArrowRight size={18} />
                        <div><span>Đơn hàng</span><strong>{formatNumber(data.orderFunnel?.total)}</strong></div>
                        <ArrowRight size={18} />
                        <div><span>Tỷ lệ</span><strong>{formatPercent(data.kpis.leadToOrderRate)}</strong></div>
                    </div>
                    <BreakdownList title="Giai đoạn lead" items={leadStages.map(item => ({ label: normalizeLabel(item.stage), ...item }))} />
                    <BreakdownList title="Trạng thái đơn" items={orderStatuses.map(item => ({ label: normalizeLabel(item.status), ...item }))} />
                </article>
            </section>

            <section className="report-insight-grid">
                <article className="report-panel">
                    <ReportPanelHeader title="Cảm xúc khách hàng" copy={`Bao phủ ${formatPercent(sentiment?.coverage)} dữ liệu có tag cảm xúc.`} />
                    {sentiment?.analyzed ? (
                        <div className="report-sentiment-wrap">
                            <div className="report-sentiment-chart">
                                <PieChart responsive style={{ width: '100%', height: '100%' }}>
                                    <Pie data={sentiment.groups} dataKey="count" nameKey="label" innerRadius={48} outerRadius={72} paddingAngle={3}>
                                        {sentiment.groups.map(item => <Cell key={item.key} fill={SENTIMENT_COLORS[item.key] || '#64748b'} />)}
                                    </Pie>
                                    <ChartTooltip />
                                </PieChart>
                                <div><strong>{formatNumber(sentiment.analyzed)}</strong><span>đã phân tích</span></div>
                            </div>
                            <div className="report-sentiment-legend">
                                {sentiment.groups.map(item => (
                                    <div key={item.key}><span><i style={{ background: SENTIMENT_COLORS[item.key] }} /> {item.label}</span><strong>{formatPercent(item.percent)}</strong></div>
                                ))}
                            </div>
                        </div>
                    ) : <ReportEmpty icon={Bot} title="Chưa có tag cảm xúc" copy="Báo cáo không tự suy diễn khi hội thoại chưa được gắn nhãn cảm xúc." />}
                </article>

                <article className="report-panel">
                    <ReportPanelHeader title="Nhãn hội thoại nổi bật" copy="Các chủ đề được gắn nhiều nhất trong kỳ." />
                    <div className="report-tag-list">
                        {tags.map(tag => (
                            <span key={tag.tag}><Tags size={13} /> {tag.tag}<strong>{tag.conversations}</strong></span>
                        ))}
                        {!tags.length && <ReportEmpty icon={Tags} title="Chưa có nhãn hội thoại" copy="Gắn tag trong inbox để theo dõi chủ đề và nguyên nhân liên hệ." />}
                    </div>
                    {leadSources.length > 0 && (
                        <div className="report-lead-sources">
                            <h3>Nguồn lead</h3>
                            {leadSources.slice(0, 5).map(source => (
                                <div key={source.source}><span>{normalizeLabel(source.source)}</span><strong>{source.count}</strong></div>
                            ))}
                        </div>
                    )}
                </article>
            </section>

            {data.definitions && Object.keys(data.definitions).length > 0 && (
                <details className="report-definitions">
                    <summary>Cách tính các chỉ số</summary>
                    <dl>
                        {Object.entries(data.definitions).map(([key, definition]) => (
                            <div key={key}><dt>{normalizeLabel(key)}</dt><dd>{definition}</dd></div>
                        ))}
                    </dl>
                </details>
            )}
        </div>
    );
}

function ReportKpi({
    icon: Icon,
    label,
    value,
    helper,
    comparison,
    lowerIsBetter = false,
    tone,
}: {
    icon: LucideIcon;
    label: string;
    value: React.ReactNode;
    helper: string;
    comparison?: MetricComparison;
    lowerIsBetter?: boolean;
    tone: string;
}) {
    const comparisonTone = getComparisonTone(comparison, lowerIsBetter);
    const TrendIcon = comparison?.direction === 'down' ? ArrowDownRight : ArrowUpRight;

    return (
        <article className={`report-kpi report-kpi-${tone}`}>
            <div className="report-kpi-head"><span>{label}</span><i><Icon size={17} /></i></div>
            <strong>{value}</strong>
            <p>{helper}</p>
            {comparison && (
                <small className={`report-trend report-trend-${comparisonTone}`}>
                    {comparison.direction === 'flat' ? null : <TrendIcon size={13} />}
                    {getComparisonLabel(comparison)}
                </small>
            )}
        </article>
    );
}

function ReportPanelHeader({ title, copy, meta }: { title: string; copy: string; meta?: React.ReactNode }) {
    return (
        <header className="report-panel-header">
            <div><h2>{title}</h2><p>{copy}</p></div>
            {meta}
        </header>
    );
}

function OperationRow({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: number; tone: string }) {
    return (
        <div className={`report-operation-row report-operation-${tone}`}>
            <span><i><Icon size={16} /></i>{label}</span>
            <strong>{formatNumber(value)}</strong>
        </div>
    );
}

function AttentionRow({ item, workspaceId }: { item: AnalyticsAttentionConversation; workspaceId: string }) {
    const channel = getChannelMeta(item.channel);
    const waiting = item.waitingSeconds === null ? 'Đã phản hồi' : formatDuration(item.waitingSeconds);
    const inboxChannel = getInboxChannel(item.channel);
    const href = inboxChannel === 'all'
        ? `/workspace/${workspaceId}/inbox`
        : `/workspace/${workspaceId}/inbox?channel=${inboxChannel}`;

    return (
        <tr>
            <td>
                <div className="report-customer-cell">
                    <span>{item.visitorName.charAt(0).toUpperCase()}</span>
                    <div><strong>{item.visitorName}</strong><small>{item.lastMessageSnippet || 'Chưa có nội dung gần nhất'}</small></div>
                </div>
            </td>
            <td><span className="report-channel"><i style={{ background: channel.color }} /> {channel.label}</span></td>
            <td><span className={`report-sla report-sla-${item.slaState}`}>{SLA_LABELS[item.slaState]}</span></td>
            <td>{item.assignedTo?.name || <span className="report-muted">Chưa phân công</span>}</td>
            <td>{waiting}</td>
            <td>{item.unreadCount ? <span className="report-unread">{item.unreadCount}</span> : '0'}</td>
            <td><Link className="report-open-row" href={href} title="Mở inbox"><ArrowRight size={15} /></Link></td>
        </tr>
    );
}

function BreakdownList({ title, items }: { title: string; items: Array<{ label: string; count: number; percent: number }> }) {
    if (!items.length) return null;
    return (
        <div className="report-breakdown">
            <h3>{title}</h3>
            {items.slice(0, 5).map(item => (
                <div key={item.label}>
                    <span>{item.label}</span>
                    <div><i style={{ width: `${Math.max(4, item.percent)}%` }} /></div>
                    <strong>{item.count}</strong>
                </div>
            ))}
        </div>
    );
}

function ReportEmpty({ icon: Icon, title, copy }: { icon: LucideIcon; title: string; copy: string }) {
    return (
        <div className="report-empty">
            <Icon size={22} />
            <strong>{title}</strong>
            <span>{copy}</span>
        </div>
    );
}

const reportStyles = `
    .analytics-report-v3{display:grid;gap:16px;color:#132238;letter-spacing:0}
    .report-intro{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:20px;border:1px solid #dce4ee;border-radius:8px;background:#fff;box-shadow:0 5px 16px rgba(15,23,42,.035)}
    .report-eyebrow{display:flex;align-items:center;gap:7px;color:#2563eb;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0}.report-intro h1{margin:6px 0 0;font-size:24px;line-height:1.2;color:#101828;letter-spacing:0}.report-intro p{margin:7px 0 0;color:#66758a;font-size:12px}
    .report-intro-actions{display:flex;align-items:center;gap:12px}.report-intro-actions>span{color:#7a8799;font-size:11px;white-space:nowrap}.report-intro-actions button{height:38px;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:0 13px;border:1px solid #1d4ed8;border-radius:7px;background:#2563eb;color:#fff;font-size:12px;font-weight:750;cursor:pointer}.report-intro-actions button:hover{background:#1d4ed8}
    .report-kpi-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}.report-kpi{min-width:0;min-height:150px;padding:16px;border:1px solid #dce4ee;border-radius:8px;background:#fff;box-shadow:0 4px 14px rgba(15,23,42,.03)}.report-kpi-head{display:flex;align-items:center;justify-content:space-between;gap:8px;color:#69778b;font-size:11px;font-weight:800;text-transform:uppercase}.report-kpi-head>i{width:34px;height:34px;display:grid;place-items:center;border-radius:7px;background:#eff6ff;color:#2563eb;font-style:normal}.report-kpi>strong{display:block;margin-top:13px;color:#101828;font-size:23px;line-height:1.15;overflow-wrap:anywhere}.report-kpi>p{min-height:17px;margin:7px 0 0;color:#778499;font-size:10px;line-height:1.45}.report-trend{min-height:18px;display:flex;align-items:center;gap:4px;margin-top:8px;font-size:10px;font-weight:750}.report-trend-positive{color:#047857}.report-trend-negative{color:#b42318}.report-trend-neutral{color:#778499}
    .report-kpi-teal .report-kpi-head>i{background:#ecfdf5;color:#047857}.report-kpi-amber .report-kpi-head>i{background:#fffbeb;color:#b45309}.report-kpi-red .report-kpi-head>i{background:#fff1f2;color:#be123c}.report-kpi-violet .report-kpi-head>i{background:#f5f3ff;color:#6d28d9}.report-kpi-green .report-kpi-head>i{background:#f0fdf4;color:#15803d}
    .report-panel{min-width:0;padding:20px;border:1px solid #dce4ee;border-radius:8px;background:#fff;box-shadow:0 5px 18px rgba(15,23,42,.035)}.report-panel-header{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:18px}.report-panel-header h2{margin:0;color:#172033;font-size:16px;line-height:1.3}.report-panel-header p{margin:5px 0 0;color:#718096;font-size:11px;line-height:1.5}.report-data-badge,.report-count-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 8px;border:1px solid #bbf7d0;border-radius:6px;background:#f0fdf4;color:#047857;font-size:10px;font-weight:750;white-space:nowrap}.report-data-badge i{width:6px;height:6px;border-radius:50%;background:#10b981}.report-count-badge{border-color:#dbe5f0;background:#f8fafc;color:#526176}
    .report-primary-grid{display:grid;grid-template-columns:minmax(0,2fr) minmax(280px,.72fr);gap:16px}.report-trend-panel{padding-bottom:14px}.report-chart-scroll{overflow-x:auto;overflow-y:hidden}.report-trend-chart{height:320px;min-width:680px}.report-chart-legend{display:flex;align-items:center;justify-content:center;gap:18px;padding-top:7px;color:#68778b;font-size:10px}.report-chart-legend span{display:flex;align-items:center;gap:6px}.report-chart-legend i{width:18px;height:3px;border-radius:2px}.report-chart-legend i.blue{background:#2563eb}.report-chart-legend i.green{background:#059669}.report-chart-legend i.gray{background:#64748b}
    .report-operations-panel{display:flex;flex-direction:column}.report-operation-list{display:grid}.report-operation-row{min-height:58px;display:flex;align-items:center;justify-content:space-between;gap:12px;border-top:1px solid #edf1f5}.report-operation-row:first-child{border-top:0}.report-operation-row>span{display:flex;align-items:center;gap:9px;color:#4e5e73;font-size:12px;font-weight:700}.report-operation-row>span>i{width:30px;height:30px;display:grid;place-items:center;border-radius:7px;background:#f8fafc;color:#64748b;font-style:normal}.report-operation-row>strong{font-size:20px}.report-operation-red>span>i,.report-operation-red>strong{color:#be123c}.report-operation-amber>span>i,.report-operation-amber>strong{color:#b45309}.report-operation-blue>span>i,.report-operation-blue>strong{color:#1d4ed8}.report-operation-violet>span>i,.report-operation-violet>strong{color:#6d28d9}.report-panel-link{height:38px;display:flex;align-items:center;justify-content:center;gap:7px;margin-top:auto;border-top:1px solid #e7edf4;padding-top:13px;color:#1d4ed8;font-size:11px;font-weight:800;text-decoration:none}.report-panel-link:hover{color:#1e40af}
    .report-table-wrap{width:100%;overflow:auto}.report-table{width:100%;border-collapse:collapse}.report-table th{height:40px;padding:0 12px;border-top:1px solid #e7edf4;border-bottom:1px solid #dce4ee;background:#f8fafc;color:#708096;font-size:10px;font-weight:800;text-align:left;text-transform:uppercase;white-space:nowrap}.report-table td{padding:12px;border-bottom:1px solid #edf1f5;color:#46566b;font-size:11px;vertical-align:middle}.report-table tbody tr:last-child td{border-bottom:0}.report-attention-table{min-width:980px}.report-customer-cell,.report-agent-person{display:flex;align-items:center;gap:9px;min-width:220px}.report-customer-cell>span,.report-agent-person>span{width:34px;height:34px;display:grid;place-items:center;border-radius:7px;background:#eef4ff;color:#1d4ed8;font-size:12px;font-weight:850;flex:0 0 auto}.report-customer-cell strong,.report-customer-cell small,.report-agent-person strong,.report-agent-person small{display:block}.report-customer-cell strong,.report-agent-person strong{color:#243248;font-size:11px}.report-customer-cell small{max-width:310px;margin-top:3px;color:#8490a1;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.report-agent-person small{margin-top:3px;color:#8490a1;font-size:9px}.report-channel{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}.report-channel i{width:7px;height:7px;border-radius:50%}.report-sla{display:inline-flex;align-items:center;padding:4px 7px;border-radius:6px;font-size:9px;font-weight:800;white-space:nowrap}.report-sla-breached{background:#fff1f2;color:#be123c}.report-sla-at_risk{background:#fffbeb;color:#b45309}.report-sla-on_track{background:#ecfdf5;color:#047857}.report-sla-none{background:#f1f5f9;color:#64748b}.report-muted{color:#8a96a8}.report-unread{min-width:22px;height:22px;display:inline-grid;place-items:center;border-radius:11px;background:#fee2e2;color:#b91c1c;font-size:10px;font-weight:850}.report-open-row{width:30px;height:30px;display:grid;place-items:center;border:1px solid #d7e0eb;border-radius:7px;color:#2563eb;text-decoration:none}.report-open-row:hover{border-color:#93b4ed;background:#eff6ff}
    .report-secondary-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(320px,.75fr);gap:16px}.report-channel-table{min-width:650px}.report-bar-list{display:grid;gap:15px}.report-bar-row{display:grid;grid-template-columns:minmax(120px,1fr) minmax(90px,1.5fr) 48px;align-items:center;gap:10px}.report-bar-row>div:first-child{display:flex;align-items:center;justify-content:space-between;gap:8px;color:#536278;font-size:11px}.report-bar-row>div:first-child strong{color:#233148}.report-bar-track{height:8px;overflow:hidden;border-radius:3px;background:#edf2f7}.report-bar-track i{display:block;height:100%;border-radius:3px;background:#2563eb}.report-bar-row small{text-align:right;color:#768399;font-size:10px}
    .report-agent-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(350px,.75fr);gap:16px}.report-agent-table{min-width:760px}.report-funnel-summary{display:grid;grid-template-columns:1fr auto 1fr auto 1fr;align-items:center;gap:8px;padding:13px 0 16px;border-bottom:1px solid #e7edf4}.report-funnel-summary>div{min-width:0}.report-funnel-summary span,.report-funnel-summary strong{display:block}.report-funnel-summary span{color:#7b8798;font-size:9px;text-transform:uppercase}.report-funnel-summary strong{margin-top:5px;color:#1b2940;font-size:18px;overflow-wrap:anywhere}.report-funnel-summary>svg{color:#94a3b8}.report-breakdown{margin-top:16px}.report-breakdown h3{margin:0 0 10px;color:#526176;font-size:10px;text-transform:uppercase}.report-breakdown>div{display:grid;grid-template-columns:minmax(90px,1fr) minmax(80px,1.2fr) 30px;align-items:center;gap:8px;margin-top:9px;color:#5c6b7f;font-size:10px}.report-breakdown>div>div{height:6px;overflow:hidden;border-radius:2px;background:#edf2f7}.report-breakdown>div>div i{display:block;height:100%;border-radius:2px;background:#2563eb}.report-breakdown>div>strong{text-align:right;color:#263449}
    .report-insight-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.report-sentiment-wrap{display:flex;align-items:center;gap:22px}.report-sentiment-chart{position:relative;width:190px;height:190px;flex:0 0 190px}.report-sentiment-chart>div:last-child{pointer-events:none;position:absolute;inset:0;display:grid;place-items:center;align-content:center;text-align:center}.report-sentiment-chart>div:last-child strong,.report-sentiment-chart>div:last-child span{display:block}.report-sentiment-chart>div:last-child strong{font-size:22px}.report-sentiment-chart>div:last-child span{margin-top:3px;color:#7a8799;font-size:9px}.report-sentiment-legend{flex:1;display:grid}.report-sentiment-legend>div{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:10px 0;border-bottom:1px solid #edf1f5;color:#59687c;font-size:11px}.report-sentiment-legend>div:last-child{border-bottom:0}.report-sentiment-legend span{display:flex;align-items:center;gap:7px}.report-sentiment-legend i{width:8px;height:8px;border-radius:50%}.report-sentiment-legend strong{color:#243248}.report-tag-list{display:flex;flex-wrap:wrap;gap:8px}.report-tag-list>span{min-height:30px;display:inline-flex;align-items:center;gap:6px;padding:5px 8px;border:1px solid #dce4ee;border-radius:6px;background:#f8fafc;color:#536278;font-size:10px}.report-tag-list>span>strong{min-width:20px;height:20px;display:grid;place-items:center;border-radius:5px;background:#e8eef7;color:#243248;font-size:9px}.report-lead-sources{margin-top:18px;padding-top:15px;border-top:1px solid #e7edf4}.report-lead-sources h3{margin:0 0 8px;color:#66758a;font-size:10px;text-transform:uppercase}.report-lead-sources>div{display:flex;align-items:center;justify-content:space-between;padding:7px 0;color:#59687c;font-size:10px}.report-lead-sources strong{color:#243248}
    .report-empty{min-height:130px;display:grid;place-items:center;align-content:center;padding:20px;text-align:center;color:#94a3b8}.report-empty strong,.report-empty span{display:block}.report-empty strong{margin-top:8px;color:#536278;font-size:11px}.report-empty span{max-width:330px;margin-top:4px;color:#8a96a8;font-size:10px;line-height:1.5}.report-table .report-empty{min-height:110px}
    .report-definitions{border:1px solid #dce4ee;border-radius:8px;background:#fff}.report-definitions summary{padding:14px 16px;color:#344258;font-size:11px;font-weight:800;cursor:pointer}.report-definitions dl{margin:0;padding:0 16px 16px}.report-definitions dl>div{display:grid;grid-template-columns:180px minmax(0,1fr);gap:14px;padding:9px 0;border-top:1px solid #edf1f5}.report-definitions dt{color:#526176;font-size:10px;font-weight:750}.report-definitions dd{margin:0;color:#7a8799;font-size:10px;line-height:1.55}
    @media(max-width:1360px){.report-kpi-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.report-agent-grid{grid-template-columns:1fr}.report-funnel-panel{display:grid;grid-template-columns:minmax(220px,.7fr) minmax(0,1fr) minmax(0,1fr);column-gap:20px}.report-funnel-panel>.report-panel-header{grid-column:1/-1}.report-funnel-summary{grid-row:2/4}.report-breakdown{margin-top:0}}
    @media(max-width:1080px){.report-primary-grid,.report-secondary-grid{grid-template-columns:1fr}.report-insight-grid{grid-template-columns:1fr}.report-operations-panel{min-height:310px}.report-agent-grid{grid-template-columns:1fr}.report-funnel-panel{display:block}.report-funnel-summary{display:grid}.report-breakdown{margin-top:16px}}
    @media(max-width:760px){.report-intro{align-items:flex-start;flex-direction:column;padding:16px}.report-intro h1{font-size:20px}.report-intro-actions{width:100%;justify-content:space-between}.report-kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.report-kpi{min-height:142px;padding:14px}.report-kpi>strong{font-size:20px}.report-panel{padding:16px}.report-panel-header{align-items:flex-start}.report-sentiment-wrap{align-items:flex-start;flex-direction:column}.report-sentiment-chart{align-self:center}.report-sentiment-legend{width:100%}.report-definitions dl>div{grid-template-columns:1fr;gap:4px}}
    @media(max-width:480px){.report-intro-actions{align-items:flex-start;flex-direction:column}.report-intro-actions button{width:100%}.report-kpi-grid{grid-template-columns:1fr}.report-kpi{min-height:132px}.report-panel-header{flex-direction:column}.report-chart-legend{justify-content:flex-start;overflow-x:auto}.report-bar-row{grid-template-columns:1fr 48px}.report-bar-track{grid-column:1/-1;grid-row:2}.report-funnel-summary{grid-template-columns:1fr auto 1fr}.report-funnel-summary>div:last-child{grid-column:1/-1;padding-top:10px;border-top:1px solid #edf1f5}.report-funnel-summary>svg:nth-of-type(2){display:none}}
`;
