import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const appLayout = read('src/components/layout/AppLayout.tsx');
const inbox = read('src/pages/workspace/[workspaceId]/inbox.tsx');
const dashboard = read('src/features/workspace/components/WorkspaceDashboard.tsx');
const zaloSettings = read('src/features/workspace/components/ZaloIntegrationSettings.tsx');
const channels = read('src/pages/workspace/[workspaceId]/channels.tsx');
const nextConfig = read('next.config.ts');

assert.ok(appLayout.includes("label: 'Kết nối kênh'"), 'Sidebar phải có một lối cấu hình kênh duy nhất.');
assert.ok(appLayout.includes('/channels'), 'Sidebar phải trỏ tới trung tâm cấu hình kênh.');
assert.ok(!appLayout.includes('/remote-session'), 'Sidebar không được mở Inbox Zalo cũ.');
assert.ok(!appLayout.includes("label: 'Zalo cá nhân'"), 'Sidebar không được trình bày Zalo như một Inbox riêng.');
assert.ok(!appLayout.includes("label: 'Email'"), 'Sidebar không được trình bày Email như một Inbox riêng.');

assert.ok(!inbox.includes('/remote-session'), 'Inbox không được điều hướng sang Inbox Zalo cũ.');
assert.ok(inbox.includes('handleChannelFilterChange'), 'Bộ lọc kênh phải được xử lý ngay trong Inbox.');
assert.ok(inbox.includes("channel === 'zalo'"), 'Inbox phải chấp nhận deep-link lọc Zalo.');
assert.ok(!dashboard.includes('/remote-session'), 'Dashboard không được điều hướng sang Inbox Zalo cũ.');
assert.ok(!zaloSettings.includes('/remote-session'), 'Cài đặt Zalo không được điều hướng sang Inbox Zalo cũ.');

assert.ok(channels.includes("'/settings?tab=zalo'"), 'Trung tâm kênh phải giữ lối cấu hình Zalo.');
assert.ok(channels.includes("'/settings?tab=facebook'"), 'Trung tâm kênh phải giữ lối cấu hình Facebook.');
assert.ok(channels.includes("'/settings?tab=email'"), 'Trung tâm kênh phải giữ lối cấu hình Email.');
assert.ok(channels.includes("'/widgets'"), 'Trung tâm kênh phải giữ lối cấu hình Widget.');
assert.ok(channels.includes("'/popups'"), 'Trung tâm kênh phải giữ lối cấu hình Popup.');

assert.ok(nextConfig.includes("source: '/workspace/:workspaceId/remote-session'"), 'Deep-link Zalo cũ phải có redirect.');
assert.ok(nextConfig.includes("destination: '/workspace/:workspaceId/inbox?channel=zalo'"), 'Zalo cũ phải redirect về Inbox hợp nhất.');
assert.ok(nextConfig.includes("source: '/workspace/:workspaceId/email'"), 'Deep-link Email cũ phải có redirect.');
assert.ok(nextConfig.includes("destination: '/workspace/:workspaceId/settings?tab=email'"), 'Email cũ phải redirect về phần cấu hình.');

console.log('PASS unified Inbox navigation: one Inbox, one channel configuration center, legacy redirects preserved.');
