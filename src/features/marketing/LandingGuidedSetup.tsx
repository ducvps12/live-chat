import Link from 'next/link';
import { ArrowRight, Bot, CheckCircle2, Database, MessageSquareText, Workflow } from 'lucide-react';
import { useState } from 'react';

type SetupIntent = 'automation' | 'inbox' | 'channels';

const intents: Array<{
    id: SetupIntent;
    eyebrow: string;
    title: string;
    description: string;
    prompt: string;
    nextStep: string;
    Icon: typeof Bot;
}> = [
    {
        id: 'automation',
        eyebrow: 'AI c\u00f3 ki\u1ec3m so\u00e1t',
        title: 'B\u1eaft \u0111\u1ea7u b\u1eb1ng m\u1ed9t lu\u1ed3ng tr\u1ea3 l\u1eddi an to\u00e0n.',
        description: 'N\u1ea1p tri th\u1ee9c, th\u1eed trong ph\u00f2ng m\u00f4 ph\u1ecfng r\u1ed3i m\u1edbi b\u1eadt tr\u1ea3 l\u1eddi tr\u00ean k\u00eanh th\u1eadt.',
        prompt: 'B\u1ea1n mu\u1ed1n AI x\u1eed l\u00fd \u0111\u1ebfn m\u1ee9c n\u00e0o?',
        nextStep: 'Th\u1eed ph\u1ea3n h\u1ed3i n\u1ed9i b\u1ed9 tr\u01b0\u1edbc khi b\u1eadt k\u00eanh',
        Icon: Bot,
    },
    {
        id: 'inbox',
        eyebrow: 'M\u1ed9t ng\u1eef c\u1ea3nh',
        title: 'Gom \u0111\u1ed9i ng\u0169 v\u00e0 l\u1ecbch s\u1eed v\u00e0o c\u00f9ng m\u1ed9t n\u01a1i.',
        description: 'Ph\u00e2n c\u00f4ng r\u00f5 r\u00e0ng, gi\u1eef l\u1ecbch s\u1eed xuy\u00ean k\u00eanh v\u00e0 chuy\u1ec3n ng\u01b0\u1eddi th\u1eadt ngay khi c\u1ea7n.',
        prompt: '\u0110\u1ed9i ng\u0169 c\u1ea7n nh\u00ecn th\u1ea5y \u0111i\u1ec1u g\u00ec tr\u01b0\u1edbc?',
        nextStep: 'T\u1ea1o workspace, m\u1eddi team v\u00e0 ph\u00e2n quy\u1ec1n',
        Icon: MessageSquareText,
    },
    {
        id: 'channels',
        eyebrow: 'K\u1ebft n\u1ed1i c\u00f3 th\u1ee9 t\u1ef1',
        title: 'K\u1ebft n\u1ed1i m\u1ed9t k\u00eanh tr\u01b0\u1edbc, r\u1ed3i m\u1edf r\u1ed9ng sau.',
        description: 'B\u1eaft \u0111\u1ea7u t\u1eeb Website, Zalo hay Fanpage theo nhu c\u1ea7u th\u1eadt, kh\u00f4ng b\u1ecb ng\u1ee3p b\u1edfi qu\u00e1 nhi\u1ec1u tu\u1ef3 ch\u1ecdn.',
        prompt: 'K\u00eanh n\u00e0o \u0111ang c\u1ea7n ph\u1ea3n h\u1ed3i nhanh nh\u1ea5t?',
        nextStep: 'K\u1ebft n\u1ed1i k\u00eanh \u0111\u1ea7u ti\u00ean v\u00e0 ki\u1ec3m tra tin nh\u1eafn m\u1eabu',
        Icon: Workflow,
    },
];

export function LandingGuidedSetup() {
    const [intent, setIntent] = useState<SetupIntent>('automation');
    const selected = intents.find((item) => item.id === intent) || intents[0];
    const SelectedIcon = selected.Icon;

    return (
        <section className="nk-guided-setup" aria-labelledby="guided-setup-title">
            <div className="nk-container nk-guided-setup-grid">
                <div className="nk-guided-copy">
                    <span className="nk-guided-kicker">Khởi tạo có hướng dẫn</span>
                    <h2 id="guided-setup-title">Không cần biết mọi thứ ngay từ đầu.</h2>
                    <p>
                        NemarkChat giúp bạn bắt đầu bằng một mục tiêu rõ ràng, sau đó dẫn từng bước để kênh,
                        tri thức và đội ngũ đi vào vận hành đúng thứ tự.
                    </p>

                    <div className="nk-guided-options" role="radiogroup" aria-label="Mục tiêu khởi tạo">
                        {intents.map((item) => {
                            const Icon = item.Icon;
                            const active = item.id === selected.id;
                            return (
                                <button
                                    type="button"
                                    key={item.id}
                                    className={active ? 'is-active' : ''}
                                    aria-checked={active}
                                    role="radio"
                                    onClick={() => setIntent(item.id)}
                                >
                                    <span className="nk-guided-option-icon"><Icon size={18} /></span>
                                    <span>
                                        <strong>{item.eyebrow}</strong>
                                        <small>{item.description}</small>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <aside className="nk-guided-console" aria-label="Xem trước luồng khởi tạo NemarkChat">
                    <div className="nk-guided-console-head">
                        <span className="nk-guided-live-dot" />
                        <span>Thiết lập workspace</span>
                        <span className="nk-guided-step">Bước 1 / 3</span>
                    </div>
                    <div className="nk-guided-console-body">
                        <div className="nk-guided-icon-wrap"><SelectedIcon size={23} /></div>
                        <p className="nk-guided-label">Mục tiêu ưu tiên</p>
                        <h3>{selected.prompt}</h3>
                        <div className="nk-guided-choice is-selected">
                            <span className="nk-guided-radio" />
                            <span>{selected.eyebrow}</span>
                            <CheckCircle2 size={17} />
                        </div>
                        <div className="nk-guided-rule" />
                        <div className="nk-guided-next">
                            <Database size={18} />
                            <div>
                                <strong>Bước tiếp theo</strong>
                                <span>{selected.nextStep}</span>
                            </div>
                        </div>
                        <Link href="/auth/register" className="nk-guided-cta">
                            Tạo workspace theo luồng này <ArrowRight size={17} />
                        </Link>
                        <p className="nk-guided-note">Bạn có thể đổi cấu hình bất cứ lúc nào sau khi tạo workspace.</p>
                    </div>
                </aside>
            </div>

            <style jsx>{`
                .nk-guided-setup {
                    padding: 92px 0;
                    overflow: hidden;
                    background:
                        radial-gradient(circle at 86% 8%, rgba(71, 122, 255, .13), transparent 30rem),
                        linear-gradient(180deg, #fff 0%, #f7faff 100%);
                    border-top: 1px solid #e7edf8;
                    border-bottom: 1px solid #e7edf8;
                }
                .nk-guided-setup-grid { display:grid; grid-template-columns:minmax(0,1.04fr) minmax(360px,.84fr); gap:72px; align-items:center; }
                .nk-guided-kicker { display:inline-flex; padding:7px 11px; border-radius:999px; background:#eaf1ff; color:#2563eb; font-size:12px; font-weight:800; letter-spacing:.03em; text-transform:uppercase; }
                .nk-guided-copy h2 { margin:17px 0 16px; max-width:600px; color:#10203c; font-size:clamp(32px,4vw,49px); line-height:1.08; letter-spacing:-.045em; }
                .nk-guided-copy > p { max-width:590px; color:#556681; font-size:17px; line-height:1.7; }
                .nk-guided-options { display:grid; gap:10px; margin-top:30px; max-width:630px; }
                .nk-guided-options button { display:flex; width:100%; gap:13px; align-items:flex-start; padding:15px; text-align:left; background:#fff; border:1px solid #e0e8f5; border-radius:15px; color:#1e2f4d; cursor:pointer; transition:border-color .18s, box-shadow .18s, transform .18s; }
                .nk-guided-options button:hover { transform:translateY(-1px); border-color:#a9c6ff; box-shadow:0 9px 24px rgba(38,93,190,.08); }
                .nk-guided-options button.is-active { border-color:#4b82f4; box-shadow:0 12px 28px rgba(46,105,227,.13); }
                .nk-guided-option-icon { display:grid; place-items:center; flex:0 0 37px; height:37px; border-radius:11px; background:#edf4ff; color:#2463e9; }
                .nk-guided-options strong { display:block; margin:1px 0 4px; font-size:14px; }
                .nk-guided-options small { display:block; color:#687995; font-size:13px; line-height:1.45; }
                .nk-guided-console { position:relative; border:1px solid rgba(97,132,205,.25); border-radius:23px; overflow:hidden; background:#0d1830; box-shadow:0 30px 70px rgba(24,65,131,.22); }
                .nk-guided-console:before { content:""; position:absolute; inset:0; pointer-events:none; opacity:.4; background-image:radial-gradient(rgba(130,174,255,.36) 1px, transparent 1px); background-size:18px 18px; mask-image:linear-gradient(#000, transparent 78%); }
                .nk-guided-console-head { position:relative; display:flex; align-items:center; gap:9px; min-height:54px; padding:0 19px; border-bottom:1px solid rgba(255,255,255,.1); color:#e7efff; font-size:13px; font-weight:700; }
                .nk-guided-live-dot { width:8px; height:8px; border-radius:50%; background:#49db95; box-shadow:0 0 0 5px rgba(73,219,149,.12); }
                .nk-guided-step { margin-left:auto; color:#a5b9dc; font-size:12px; font-weight:600; }
                .nk-guided-console-body { position:relative; padding:30px; }
                .nk-guided-icon-wrap { display:grid; place-items:center; width:46px; height:46px; border-radius:14px; background:linear-gradient(145deg,#3379ff,#7157f7); color:#fff; box-shadow:0 9px 23px rgba(61,107,255,.4); }
                .nk-guided-label { margin:24px 0 7px; color:#9bb2dc; font-size:12px; font-weight:750; text-transform:uppercase; letter-spacing:.08em; }
                .nk-guided-console h3 { margin:0; max-width:370px; color:#fff; font-size:22px; line-height:1.25; letter-spacing:-.025em; }
                .nk-guided-choice { display:flex; align-items:center; gap:11px; margin-top:22px; padding:14px; border:1px solid rgba(125,167,255,.6); border-radius:13px; background:rgba(58,113,224,.19); color:#eef5ff; font-size:14px; font-weight:700; }
                .nk-guided-choice svg { margin-left:auto; color:#71e4ac; }
                .nk-guided-radio { width:16px; height:16px; border:4px solid #6e9cff; border-radius:50%; box-sizing:border-box; background:#fff; }
                .nk-guided-rule { height:1px; margin:23px 0; background:rgba(255,255,255,.11); }
                .nk-guided-next { display:flex; align-items:flex-start; gap:11px; color:#7ea7ff; }
                .nk-guided-next > div { display:grid; gap:4px; }
                .nk-guided-next strong { color:#dbe7ff; font-size:13px; }
                .nk-guided-next span { color:#a8bbda; font-size:12px; line-height:1.45; }
                .nk-guided-cta { display:flex; align-items:center; justify-content:center; gap:9px; width:100%; box-sizing:border-box; margin-top:25px; padding:13px 16px; border-radius:12px; background:#2d72f2; color:#fff; font-size:14px; font-weight:750; text-decoration:none; transition:transform .18s, background .18s; }
                .nk-guided-cta:hover { transform:translateY(-1px); background:#1e61da; }
                .nk-guided-note { margin:12px 0 0; color:#8ca2c7; font-size:11px; line-height:1.45; text-align:center; }
                @media (max-width:900px) { .nk-guided-setup { padding:72px 0; } .nk-guided-setup-grid { grid-template-columns:1fr; gap:38px; } .nk-guided-console { max-width:600px; width:100%; margin:0 auto; } }
                @media (max-width:560px) { .nk-guided-setup { padding:54px 0; } .nk-guided-copy h2 { font-size:33px; } .nk-guided-copy > p { font-size:15px; } .nk-guided-options button { padding:13px; } .nk-guided-options small { font-size:12px; } .nk-guided-console-body { padding:22px; } .nk-guided-console h3 { font-size:20px; } }
            `}</style>
        </section>
    );
}
