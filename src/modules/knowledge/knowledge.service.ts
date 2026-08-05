import { knowledgeRepo } from './repos/knowledge.repo';
import { AppError } from '../../middlewares/errorHandler';
import { fetchPublicPage } from '../radar/radar.service';

const MAX_WEBSITE_TEXT_LENGTH = 24_000;
const WEBSITE_CHUNK_SIZE = 1_600;

function chunkWebsiteText(text: string): string[] {
    const normalized = text.replace(/\s+/g, ' ').trim().slice(0, MAX_WEBSITE_TEXT_LENGTH);
    if (!normalized) return [];

    const sentences = normalized.split(/(?<=[.!?])\s+/);
    const chunks: string[] = [];
    let current = '';
    for (const sentence of sentences) {
        if (current && current.length + sentence.length + 1 > WEBSITE_CHUNK_SIZE) {
            chunks.push(current.trim());
            current = '';
        }
        current += `${current ? ' ' : ''}${sentence}`;
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks.slice(0, 20);
}

// Vietnamese keyword extraction — simple but effective
function extractKeywords(text: string): string[] {
    if (!text) return [];
    const stopWords = new Set(['và', 'của', 'cho', 'với', 'trong', 'là', 'có', 'không', 'được', 'này', 'đó', 'thì', 'nếu', 'khi', 'như', 'từ', 'về', 'đã', 'sẽ', 'đang', 'còn', 'các', 'một', 'những', 'mình', 'bạn', 'anh', 'chị', 'em', 'ạ', 'nhé', 'nha', 'vậy', 'rồi', 'ơi', 'dạ', 'bên', 'lại']);
    return text
        .toLowerCase()
        .replace(/[^\w\sàáảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 1 && !stopWords.has(w))
        .filter((w, i, arr) => arr.indexOf(w) === i) // dedupe
        .slice(0, 20);
}

/**
 * Parse Google Sheets CSV export URL from any share URL
 */
function buildSheetCsvUrl(sheetUrl: string, gid?: string): string {
    // Extract spreadsheet ID from URL
    const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (!match) throw new AppError('URL Google Sheets không hợp lệ', 400, 'INVALID_SHEET_URL');
    const sheetId = match[1];

    // Extract gid from URL if present
    if (!gid) {
        const gidMatch = sheetUrl.match(/gid=(\d+)/);
        gid = gidMatch ? gidMatch[1] : '0';
    }

    return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;
}

/**
 * Parse CSV text into rows (handles quoted fields with newlines)
 */
function parseCsv(csvText: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
        const char = csvText[i];
        const nextChar = csvText[i + 1];

        if (inQuotes) {
            if (char === '"' && nextChar === '"') {
                currentField += '"';
                i++; // skip next quote
            } else if (char === '"') {
                inQuotes = false;
            } else {
                currentField += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ',') {
                currentRow.push(currentField.trim());
                currentField = '';
            } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
                currentRow.push(currentField.trim());
                if (currentRow.some(f => f.length > 0)) {
                    rows.push(currentRow);
                }
                currentRow = [];
                currentField = '';
                if (char === '\r') i++; // skip \n after \r
            } else {
                currentField += char;
            }
        }
    }

    // Last field/row
    if (currentField.length > 0 || currentRow.length > 0) {
        currentRow.push(currentField.trim());
        if (currentRow.some(f => f.length > 0)) {
            rows.push(currentRow);
        }
    }

    return rows;
}

export const knowledgeService = {
    async importPlainText(workspaceId: string, topicValue: string, rawText: string) {
        const topic = topicValue.trim().slice(0, 160);
        const chunks = chunkWebsiteText(rawText);
        if (!topic || !chunks.length) {
            throw new AppError('Vui lòng nhập chủ đề và nội dung cần nạp', 400, 'KNOWLEDGE_TEXT_EMPTY');
        }
        const entries = chunks.map((answer, index) => ({
            workspaceId,
            product: topic,
            question: (answer.split(/(?<=[.!?])\s+/)[0] || `${topic} — phần ${index + 1}`).slice(0, 260),
            answer,
            keywords: [...extractKeywords(topic), ...extractKeywords(answer)].slice(0, 30),
            source: 'pasted_text',
        }));
        const savedCount = await knowledgeRepo.createMany(entries);
        return { importedEntries: savedCount };
    },

    /**
     * Import one public website URL into the existing Q&A knowledge model.
     * Radar's pinned public fetcher protects against private-network/SSRF targets.
     */
    async importFromWebsite(workspaceId: string, rawUrl: string, requestedTopic?: string) {
        const page = await fetchPublicPage(rawUrl);
        const chunks = chunkWebsiteText(page.text);
        if (!chunks.length) {
            throw new AppError('Không tìm thấy nội dung chữ có thể nhập từ đường dẫn này', 400, 'KNOWLEDGE_URL_EMPTY');
        }

        const hostname = new URL(page.finalUrl).hostname.replace(/^www\./, '');
        const topic = (requestedTopic || page.title || hostname).trim().slice(0, 160);
        const parsedUrl = new URL(page.finalUrl);
        const source = `website:${hostname}${parsedUrl.pathname}`.slice(0, 180);

        // Re-importing the same URL replaces its previous snapshot instead of duplicating entries.
        await knowledgeRepo.removeByWorkspaceAndSource(workspaceId, source);
        const entries = chunks.map((answer, index) => {
            const lead = answer.split(/(?<=[.!?])\s+/)[0]?.trim() || answer;
            return {
                workspaceId,
                product: topic,
                question: lead.slice(0, 260) || `${topic} — phần ${index + 1}`,
                answer,
                keywords: [...extractKeywords(topic), ...extractKeywords(answer)].slice(0, 30),
                source,
            };
        });
        const savedCount = await knowledgeRepo.createMany(entries);
        return {
            finalUrl: page.finalUrl,
            title: page.title || topic,
            importedEntries: savedCount,
            truncated: page.text.length > MAX_WEBSITE_TEXT_LENGTH,
        };
    },
    /**
     * Sync knowledge entries from a Google Sheets URL
     * Expected columns: [STT, Sản phẩm, Câu hỏi, Cách trả lời, Upsale]
     */
    async syncFromGoogleSheets(workspaceId: string, sheetUrl: string) {
        const csvUrl = buildSheetCsvUrl(sheetUrl);
        console.log(`[KnowledgeService] Fetching CSV from: ${csvUrl}`);

        // Fetch CSV data
        const response = await fetch(csvUrl);
        if (!response.ok) {
            throw new AppError(`Không thể tải dữ liệu từ Google Sheets (${response.status})`, 400, 'SHEET_FETCH_FAILED');
        }
        const csvText = await response.text();
        const rows = parseCsv(csvText);

        if (rows.length < 2) {
            throw new AppError('Google Sheets không có dữ liệu', 400, 'SHEET_EMPTY');
        }

        // Skip header row, parse entries
        // Columns: A=STT, B=Sản phẩm, C=Câu hỏi, D=Cách trả lời, E=Upsale
        const entries: any[] = [];
        let currentProduct = '';

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const product = (row[1] || '').trim();
            const question = (row[2] || '').trim();
            const answer = (row[3] || '').trim();
            const upsale = (row[4] || '').trim();

            // Track current product (some rows may not repeat product name)
            if (product) currentProduct = product;

            // Skip rows without question or answer
            if (!question && !answer) continue;

            const keywords = [
                ...extractKeywords(question),
                ...extractKeywords(currentProduct),
            ];

            entries.push({
                workspaceId,
                product: currentProduct || 'Chung',
                question: question || `(${currentProduct})`,
                answer: answer || question, // If no answer, use question as fallback
                upsaleText: upsale,
                keywords,
                source: 'google_sheets',
                sheetRowIndex: i,
            });
        }

        // Bulk upsert
        const savedCount = await knowledgeRepo.createMany(entries);

        console.log(`[KnowledgeService] Synced ${savedCount} entries from Google Sheets`);
        return {
            totalRows: rows.length - 1,
            syncedEntries: entries.length,
            savedCount,
        };
    },

    /**
     * Search knowledge base — used for manual search and auto-suggest
     */
    async search(workspaceId: string, query: string, limit = 5) {
        return knowledgeRepo.search(workspaceId, query, limit);
    },

    /**
     * Smart suggest based on incoming customer message
     * Analyzes the message and returns best matching Q&A entries
     */
    async smartSuggest(workspaceId: string, customerMessage: string) {
        if (!customerMessage || customerMessage.length < 3) return [];

        // Extract meaningful search terms
        const searchQuery = customerMessage
            .replace(/[^\w\sàáảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ]/g, ' ')
            .trim();

        return knowledgeRepo.search(workspaceId, searchQuery, 3, {
            // Auto replies should only use entries whose product/question matches.
            // A word found only incidentally in an answer is too weak to send to a customer.
            minScore: 3,
            allowStopwordFallback: false,
        });
    },

    /**
     * Get all entries, optionally filtered by product
     */
    async getAll(workspaceId: string, filters?: { product?: string }) {
        return knowledgeRepo.findByWorkspace(workspaceId, filters);
    },

    /**
     * Get distinct product categories
     */
    async getProducts(workspaceId: string) {
        return knowledgeRepo.getProducts(workspaceId);
    },

    /**
     * Create manual entry
     */
    async create(workspaceId: string, data: { product: string; question: string; answer: string; upsaleText?: string }) {
        const keywords = [
            ...extractKeywords(data.question),
            ...extractKeywords(data.product),
        ];
        return knowledgeRepo.create({
            workspaceId: workspaceId as any,
            ...data,
            keywords,
            source: 'manual',
        });
    },

    /**
     * Update entry
     */
    async update(workspaceId: string, id: string, data: { product?: string; question?: string; answer?: string; upsaleText?: string }) {
        const existing = await knowledgeRepo.findById(id);
        if (!existing || existing.workspaceId !== workspaceId) {
            throw new AppError('Knowledge entry không tồn tại', 404, 'NOT_FOUND');
        }

        // Re-extract keywords if question/product changed
        let keywords = existing.keywords;
        if (data.question || data.product) {
            keywords = [
                ...extractKeywords(data.question || existing.question),
                ...extractKeywords(data.product || existing.product),
            ];
        }

        return knowledgeRepo.update(id, { ...data, keywords });
    },

    /**
     * Delete entry
     */
    async remove(workspaceId: string, id: string) {
        const existing = await knowledgeRepo.findById(id);
        if (!existing || existing.workspaceId !== workspaceId) {
            throw new AppError('Knowledge entry không tồn tại', 404, 'NOT_FOUND');
        }
        return knowledgeRepo.remove(id);
    },

    /**
     * Get stats
     */
    async getStats(workspaceId: string) {
        const total = await knowledgeRepo.count(workspaceId);
        const products = await knowledgeRepo.getProducts(workspaceId);
        return { total, products, productCount: products.length };
    },
};
