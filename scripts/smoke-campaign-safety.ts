import assert from 'node:assert/strict';
import {
    campaignService,
    getFutureScheduleStart,
    normalizeRecipientIds,
    normalizeTelegramDestination,
    normalizeTelegramDestinations,
} from '../src/modules/campaign/campaign.service';

assert.deepEqual(
    normalizeRecipientIds([' user-a ', 'user-a', '', 'user-b', null]),
    ['user-a', 'user-b'],
);

assert.equal(normalizeTelegramDestination('-1001234567890#42'), '-1001234567890#42');
assert.equal(normalizeTelegramDestination('@nemark_updates'), '@nemark_updates');
assert.equal(normalizeTelegramDestination('invalid destination'), null);
assert.deepEqual(
    normalizeTelegramDestinations([' -1001234567890#42 ', '-1001234567890#42', '@nemark_updates', 'bad']),
    ['-1001234567890#42', '@nemark_updates'],
);

const now = Date.now();
assert.equal(getFutureScheduleStart({ startAt: new Date(now - 1_000) }, now), null);
assert.equal(getFutureScheduleStart({ startAt: 'not-a-date' }, now), null);
assert.equal(getFutureScheduleStart({ startAt: new Date(now + 60_000) }, now)?.getTime(), now + 60_000);

async function main() {
    const abortableCampaignService = campaignService as unknown as {
        waitUntilOrAbort(delayMs: number, signal: AbortSignal): Promise<boolean>;
    };
    const controller = new AbortController();
    const startedAt = Date.now();
    const pendingWait = abortableCampaignService.waitUntilOrAbort(30_000, controller.signal);
    setTimeout(() => controller.abort(), 20);
    assert.equal(await pendingWait, false);
    assert.ok(Date.now() - startedAt < 1_000, 'campaign wait should stop immediately after cancel');

    console.log('campaign safety smoke checks passed');
}

void main();
