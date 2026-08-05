import assert from 'node:assert/strict';
import {
    buildZaloConversationIdentity,
    isCompatibleLegacyZaloConversation,
    resolveZaloSendAccount,
} from '../src/modules/conversation/zalo-identity.helpers';

const accountAUser = buildZaloConversationIdentity('thread-42', 'account-a', 'user');
const accountBUser = buildZaloConversationIdentity('thread-42', 'account-b', 'user');
const accountAGroup = buildZaloConversationIdentity('thread-42', 'account-a', 'group');
const legacy = buildZaloConversationIdentity('thread-42', undefined, 'user');

assert.equal(accountAUser.legacyVisitorId, 'zalo_thread-42');
assert.notEqual(accountAUser.preferredVisitorId, accountBUser.preferredVisitorId);
assert.notEqual(accountAUser.preferredVisitorId, accountAGroup.preferredVisitorId);
assert.equal(legacy.preferredVisitorId, legacy.legacyVisitorId);

assert.equal(isCompatibleLegacyZaloConversation(undefined, accountAUser), true);
assert.equal(isCompatibleLegacyZaloConversation({}, accountAUser), true);
assert.equal(isCompatibleLegacyZaloConversation({ accountId: 'account-a' }, accountAUser), true);
assert.equal(isCompatibleLegacyZaloConversation({ accountId: 'account-b' }, accountAUser), false);
assert.equal(isCompatibleLegacyZaloConversation({ accountId: 'account-a', threadType: 'group' }, accountAUser), false);
assert.equal(isCompatibleLegacyZaloConversation({ accountId: 'account-a' }, legacy), false);

assert.deepEqual(resolveZaloSendAccount(['account-a', 'account-b'], ['account-b'], 'account-a'), { error: 'ACCOUNT_OFFLINE' });
assert.deepEqual(resolveZaloSendAccount(['account-a'], ['account-a'], 'other-workspace-account'), { error: 'ACCOUNT_NOT_IN_WORKSPACE' });
assert.deepEqual(resolveZaloSendAccount(['account-a', 'account-b'], ['account-a', 'account-b']), { error: 'AMBIGUOUS_ACCOUNT' });
assert.deepEqual(resolveZaloSendAccount(['account-a'], ['account-a']), { accountId: 'account-a' });

console.log('zalo identity smoke checks passed');
