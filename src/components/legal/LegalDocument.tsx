import { FileCheck2 } from 'lucide-react';

export interface LegalSection {
    id: string;
    title: string;
    paragraphs?: string[];
    bullets?: string[];
}

interface LegalDocumentProps {
    eyebrow: string;
    title: string;
    summary: string;
    updatedAt: string;
    sections: LegalSection[];
}

export default function LegalDocument({ eyebrow, title, summary, updatedAt, sections }: LegalDocumentProps) {
    return (
        <div className="legal-document">
            <header className="legal-heading">
                <span><FileCheck2 size={16} />{eyebrow}</span>
                <h1>{title}</h1>
                <p>{summary}</p>
                <small>Cập nhật lần cuối: {updatedAt}</small>
            </header>

            <div className="legal-layout">
                <nav className="legal-toc" aria-label="Mục lục">
                    <strong>Nội dung</strong>
                    {sections.map((section, index) => (
                        <a href={`#${section.id}`} key={section.id}>{index + 1}. {section.title}</a>
                    ))}
                </nav>

                <article className="legal-body">
                    {sections.map((section, index) => (
                        <section id={section.id} key={section.id}>
                            <h2><span>{String(index + 1).padStart(2, '0')}</span>{section.title}</h2>
                            {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                            {Boolean(section.bullets?.length) && (
                                <ul>{section.bullets?.map((item) => <li key={item}>{item}</li>)}</ul>
                            )}
                        </section>
                    ))}
                </article>
            </div>

            <style jsx>{`
                .legal-document { color: var(--color-text); }
                .legal-heading { max-width: 800px; padding-bottom: 38px; border-bottom: 1px solid var(--color-border); }
                .legal-heading > span { display: inline-flex; align-items: center; gap: 8px; color: #1d4ed8; font-size: 12px; font-weight: 800; text-transform: uppercase; }
                .legal-heading h1 { max-width: 760px; margin: 14px 0 12px; font-size: 42px; line-height: 1.14; letter-spacing: 0; }
                .legal-heading p { max-width: 720px; margin: 0; color: var(--color-text-secondary); font-size: 16px; line-height: 1.7; }
                .legal-heading small { display: block; margin-top: 18px; color: var(--color-text-muted); font-size: 13px; }
                .legal-layout { display: grid; grid-template-columns: 220px minmax(0, 760px); gap: 54px; align-items: start; margin-top: 38px; }
                .legal-toc { position: sticky; top: 100px; display: grid; gap: 4px; border-left: 2px solid #dbe7fa; padding-left: 16px; }
                .legal-toc strong { margin-bottom: 8px; color: var(--color-text); font-size: 13px; }
                .legal-toc a { padding: 5px 0; color: var(--color-text-muted); font-size: 12px; line-height: 1.4; text-decoration: none; }
                .legal-toc a:hover { color: #1d4ed8; }
                .legal-body { min-width: 0; }
                .legal-body section { scroll-margin-top: 104px; padding: 0 0 34px; }
                .legal-body section + section { padding-top: 34px; border-top: 1px solid var(--color-border); }
                .legal-body h2 { display: flex; align-items: flex-start; gap: 12px; margin: 0 0 14px; font-size: 21px; line-height: 1.35; }
                .legal-body h2 span { flex: 0 0 auto; color: #2563eb; font-size: 12px; line-height: 28px; }
                .legal-body p, .legal-body li { color: var(--color-text-secondary); font-size: 15px; line-height: 1.8; }
                .legal-body p { margin: 0 0 12px; }
                .legal-body ul { display: grid; gap: 8px; margin: 8px 0 0; padding-left: 22px; }
                @media (max-width: 820px) {
                    .legal-heading h1 { font-size: 34px; }
                    .legal-layout { grid-template-columns: 1fr; gap: 28px; }
                    .legal-toc { position: static; display: flex; overflow-x: auto; gap: 8px; border-left: 0; padding: 0 0 8px; }
                    .legal-toc strong { display: none; }
                    .legal-toc a { flex: 0 0 auto; border: 1px solid var(--color-border); border-radius: 6px; padding: 7px 10px; background: #fff; }
                }
                @media (max-width: 520px) {
                    .legal-heading { padding-bottom: 28px; }
                    .legal-heading h1 { font-size: 29px; }
                    .legal-heading p { font-size: 15px; }
                    .legal-layout { margin-top: 26px; }
                    .legal-body section { padding-bottom: 26px; }
                    .legal-body section + section { padding-top: 26px; }
                    .legal-body h2 { font-size: 19px; }
                }
            `}</style>
        </div>
    );
}
