/**
 * NemarkChat Widget Loader v1.0
 * ─────────────────────────────
 * Nhúng lên website tenant bằng snippet:
 *
 *   <script>
 *     (function(w,d,s,o){
 *       w.NemarkChat=o;w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
 *       var js=d.createElement(s);js.async=1;
 *       js.src='https://YOUR_DOMAIN/widget/loader.js';
 *       js.setAttribute('data-widget-id','WIDGET_ID');
 *       d.head.appendChild(js);
 *     })(window,document,'script','nchat');
 *   </script>
 *
 * Luồng:
 * 1. Đọc data-widget-id từ script tag
 * 2. Gọi API public lấy widget config (màu, lời chào, vị trí, ngôn ngữ, pre-chat form)
 * 3. Kiểm tra domain allowlist / blocklist
 * 4. Nếu hợp lệ → inject CSS + render bubble + chat window
 */
(function () {
    'use strict';

    // Prevent duplicate live instances, but recover from a stale guard left by
    // an interrupted request, SPA remount or an older loader version.
    var existingWidgetRoot = document.getElementById('nchat-window')
        || document.getElementById('nchat-bubble')
        || document.getElementById('nchat-fallback-bubble');
    if (window.__nchat_loaded && existingWidgetRoot) return;
    if (window.__nchat_loaded && !existingWidgetRoot) window.__nchat_loaded = false;

    // ── Visitor ID helpers (cookie + localStorage dual storage) ──
    var VISITOR_KEY = 'nchat_visitor_id';
    var COOKIE_DAYS = 365;

    function generateId() {
        // crypto.randomUUID if available, otherwise fallback
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    }

    function setCookie(name, value, days) {
        var d = new Date();
        d.setTime(d.getTime() + days * 86400000);
        document.cookie = name + '=' + encodeURIComponent(value)
            + ';expires=' + d.toUTCString()
            + ';path=/;SameSite=Lax';
    }

    function getCookie(name) {
        var match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
        return match ? decodeURIComponent(match[1]) : null;
    }

    function getVisitorId() {
        // 1. Try localStorage
        var id = null;
        try { id = localStorage.getItem(VISITOR_KEY); } catch (e) { /* private mode */ }
        if (id) { syncStorage(id); return id; }

        // 2. Try cookie
        id = getCookie(VISITOR_KEY);
        if (id) { syncStorage(id); return id; }

        // 3. Generate new
        id = generateId();
        syncStorage(id);
        return id;
    }

    function syncStorage(id) {
        // Write to both storages for redundancy
        try { localStorage.setItem(VISITOR_KEY, id); } catch (e) { /* quota/private */ }
        setCookie(VISITOR_KEY, id, COOKIE_DAYS);
    }

    // Get or create persistent visitorId
    var visitorId = getVisitorId();

    // ── Visitor session helpers (persist pre-chat info across reloads) ──
    var SESSION_KEY = 'nchat_visitor_session';

    function saveVisitorSession(info) {
        try {
            var data = JSON.stringify({ visitorId: visitorId, info: info, ts: Date.now() });
            localStorage.setItem(SESSION_KEY, data);
        } catch (e) { /* private mode / quota */ }
    }

    function getVisitorSession() {
        try {
            var raw = localStorage.getItem(SESSION_KEY);
            if (!raw) return null;
            var session = JSON.parse(raw);
            // Only restore if same visitorId (safety check)
            if (session.visitorId !== visitorId) return null;
            // Expire after 30 days of inactivity
            if (Date.now() - session.ts > 30 * 86400000) {
                localStorage.removeItem(SESSION_KEY);
                return null;
            }
            return session;
        } catch (e) { return null; }
    }

    // ── 1. Tìm script tag để lấy widget ID ──
    var scripts = document.querySelectorAll('script[data-widget-id]');
    var currentScript = document.currentScript && document.currentScript.getAttribute('data-widget-id')
        ? document.currentScript
        : scripts[scripts.length - 1];
    if (!currentScript) { console.warn('[NemarkChat] Missing data-widget-id'); return; }

    var widgetId = currentScript.getAttribute('data-widget-id');
    if (!widgetId) { console.warn('[NemarkChat] Empty widget-id'); return; }

    // Only mark the loader active after its required attributes are valid.
    window.__nchat_loaded = true;
    window.__nchat_destroyed = false;

    // ── 2. Xác định API base URL ──
    // Priority: data-api-base attribute > script src origin > window.location.origin
    var scriptSrc = currentScript.getAttribute('src') || '';
    var explicitBase = currentScript.getAttribute('data-api-base') || '';
    var apiBase = '';

    if (explicitBase) {
        // Explicit override (e.g., from test modal or custom deployments)
        apiBase = explicitBase.replace(/\/+$/, ''); // trim trailing slashes
    } else {
        try {
            apiBase = new URL(scriptSrc).origin;
        } catch (e) {
            apiBase = window.location.origin;
        }
    }

    var CONFIG_URL = apiBase + '/api/workspaces/public/widgets/' + widgetId + '/config';

    // ── 3. Fetch config with retry ──
    var MAX_RETRIES = 2;
    var RETRY_DELAY = 2000;
    var _rendered = false; // guard: only one of renderWidget / renderFallback
    var _configFetching = false; // guard: prevent duplicate fetch

    function fetchConfig(attempt) {
        if (_configFetching) return;
        _configFetching = true;
        fetch(CONFIG_URL)
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function (res) {
                if (!res.success || !res.data) {
                    console.warn('[NemarkChat] Widget not found or inactive');
                    renderFallback('inactive');
                    return;
                }

                var config = res.data.config || {};
                var rules = res.data.domainRules || {};

                // ── 4. Domain check ──
                var hostname = window.location.hostname;
                if (rules.domains && rules.domains.length > 0) {
                    var matched = rules.domains.some(function (d) {
                        if (d.indexOf('*.') === 0) {
                            var suffix = d.slice(2);
                            return hostname === suffix || hostname.endsWith('.' + suffix);
                        }
                        return hostname === d;
                    });

                    if (rules.mode === 'allowlist' && !matched) {
                        console.warn('[NemarkChat] Domain not in allowlist:', hostname);
                        return;
                    }
                    if (rules.mode === 'blocklist' && matched) {
                        console.warn('[NemarkChat] Domain blocklisted:', hostname);
                        return;
                    }
                }
                // allowlist empty → allow all

                // ── 5. Render ──
                var bh = res.data.businessHours || {};
                var widgetName = res.data.name || '';
                renderWidget(config, widgetId, apiBase, visitorId, bh, widgetName);
                loadMarketingPopups(res.data.workspaceId, apiBase);
            })
            .catch(function (err) {
                _configFetching = false;
                console.error('[NemarkChat] Load failed (attempt ' + (attempt + 1) + '):', err.message);
                if (attempt < MAX_RETRIES) {
                    setTimeout(function () { fetchConfig(attempt + 1); }, RETRY_DELAY);
                } else {
                    renderFallback('error');
                }
            });
    }
    fetchConfig(0);

    function getPopupRecordId(popup) {
        return popup && (popup.id || popup._id);
    }

    function escapePopupHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function incrementPopupStat(base, popupId, stat) {
        if (!popupId || !stat) return;
        try {
            fetch(base + '/api/workspaces/public/popups/' + popupId + '/stat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stat: stat })
            }).catch(function () { });
        } catch (e) { /* ignore analytics errors */ }
    }

    function getPopupSeenKey(popup) {
        return 'nchat_popup_seen_' + getPopupRecordId(popup);
    }

    function canShowPopupByFrequency(popup) {
        var popupId = getPopupRecordId(popup);
        if (!popupId) return false;
        var settings = popup.settings || {};
        var frequency = settings.frequency || 'once';
        if (frequency === 'every_visit') return true;

        try {
            var raw = localStorage.getItem(getPopupSeenKey(popup));
            if (!raw) return true;
            if (frequency === 'every_day') {
                return new Date(Number(raw)).toDateString() !== new Date().toDateString();
            }
            return false;
        } catch (e) {
            return true;
        }
    }

    function markPopupShown(popup) {
        try {
            localStorage.setItem(getPopupSeenKey(popup), String(Date.now()));
        } catch (e) { /* private mode */ }
    }

    function matchesPopupUrlRules(popup) {
        var settings = popup.settings || {};
        var rules = settings.urlRules || {};
        var hostname = window.location.hostname;
        var pathname = window.location.pathname;

        if (rules.domains && rules.domains.length) {
            var domainMatched = rules.domains.some(function (rule) {
                var value = typeof rule === 'string' ? rule : (rule && (rule.value || rule.domain));
                if (!value) return false;
                if (value.indexOf('*.') === 0) {
                    var suffix = value.slice(2);
                    return hostname === suffix || hostname.endsWith('.' + suffix);
                }
                return hostname === value;
            });
            if (!domainMatched) return false;
        }

        if (rules.paths && rules.paths.length) {
            var pathMatched = rules.paths.some(function (rule) {
                var value = typeof rule === 'string' ? rule : (rule && (rule.value || rule.path));
                if (!value) return false;
                return pathname.indexOf(value) === 0 || pathname.indexOf(value) !== -1;
            });
            if (!pathMatched) return false;
        }

        return true;
    }

    function loadMarketingPopups(workspaceId, base) {
        if (!workspaceId) return;
        fetch(base + '/api/workspaces/public/popups/workspace/' + workspaceId + '/active')
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function (res) {
                var popups = (res && res.success && res.data) || [];
                if (!popups.length) return;

                var candidates = popups.filter(function (popup) {
                    return matchesPopupUrlRules(popup) && canShowPopupByFrequency(popup);
                });
                if (!candidates.length) return;

                var selected = null;
                for (var i = 0; i < candidates.length; i++) {
                    var customCode = candidates[i].design && candidates[i].design.customCode;
                    if (customCode && customCode.enabled && (customCode.html || customCode.css || customCode.js)) {
                        selected = candidates[i];
                        break;
                    }
                }
                scheduleMarketingPopup(selected || candidates[0], base);
            })
            .catch(function (err) {
                console.warn('[NemarkChat] Popup load failed:', err.message);
            });
    }

    function scheduleMarketingPopup(popup, base) {
        var settings = popup.settings || {};
        var mode = settings.triggerMode || 'delay';
        var shown = false;
        var show = function () {
            if (shown || window.__nchat_destroyed) return;
            shown = true;
            showMarketingPopup(popup, base);
        };

        if (mode === 'immediate') {
            show();
            return;
        }

        if (mode === 'scroll') {
            var target = Number(settings.scrollPercent || 40);
            var onScroll = function () {
                var doc = document.documentElement;
                var maxScroll = Math.max(1, doc.scrollHeight - window.innerHeight);
                var percent = (window.scrollY || doc.scrollTop || 0) / maxScroll * 100;
                if (percent >= target) {
                    window.removeEventListener('scroll', onScroll);
                    show();
                }
            };
            window.addEventListener('scroll', onScroll, { passive: true });
            onScroll();
            return;
        }

        if (mode === 'exit_intent') {
            var onExit = function (event) {
                if (event.clientY <= 0) {
                    document.removeEventListener('mouseout', onExit);
                    show();
                }
            };
            document.addEventListener('mouseout', onExit);
            return;
        }

        setTimeout(show, Math.max(0, Number(settings.triggerDelay || 5)) * 1000);
    }

    function showMarketingPopup(popup, base) {
        if (window.__nchat_destroyed || !popup || document.getElementById('nchat-marketing-popup')) return;
        var popupId = getPopupRecordId(popup);
        markPopupShown(popup);
        incrementPopupStat(base, popupId, 'views');

        var customCode = popup.design && popup.design.customCode;
        if (customCode && customCode.enabled && (customCode.html || customCode.css || customCode.js)) {
            renderCustomMarketingPopup(popup, base);
        } else {
            renderBasicMarketingPopup(popup, base);
        }
    }

    function insertMarketingStyles(customCss) {
        var oldStyle = document.getElementById('nchat-marketing-style');
        if (oldStyle) oldStyle.remove();

        var style = document.createElement('style');
        style.id = 'nchat-marketing-style';
        style.textContent = [
            '#nchat-marketing-popup,#nchat-marketing-popup *{box-sizing:border-box}',
            '#nchat-marketing-popup{position:fixed;inset:0;z-index:2147483646;display:grid;place-items:center;padding:18px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;pointer-events:none}',
            '#nchat-marketing-popup .nchat-marketing-backdrop{position:absolute;inset:0;background:rgba(15,23,42,.45);backdrop-filter:blur(3px);pointer-events:auto}',
            '#nchat-marketing-popup .nchat-marketing-shell{position:relative;z-index:1;max-width:calc(100vw - 32px);pointer-events:auto;animation:nchatPopupIn .22s ease-out}',
            '#nchat-marketing-popup.nchat-marketing-notification{inset:auto 24px 96px auto;display:block;padding:0}',
            '#nchat-marketing-popup.nchat-marketing-notification .nchat-marketing-backdrop{display:none}',
            '#nchat-marketing-popup .nchat-marketing-close{position:absolute;top:-12px;right:-12px;width:32px;height:32px;border:0;border-radius:50%;background:#0f172a;color:#fff;display:grid;place-items:center;font-size:20px;line-height:1;box-shadow:0 10px 30px rgba(15,23,42,.28);cursor:pointer;z-index:2}',
            '#nchat-marketing-popup .nchat-marketing-card{width:min(420px,calc(100vw - 32px));overflow:hidden;border-radius:20px;background:#fff;color:#0f172a;box-shadow:0 24px 80px rgba(15,23,42,.32)}',
            '#nchat-marketing-popup .nchat-marketing-image{width:100%;max-height:210px;object-fit:cover;display:block}',
            '#nchat-marketing-popup .nchat-marketing-body{padding:24px}',
            '#nchat-marketing-popup .nchat-marketing-body h3{margin:0 0 8px;font-size:24px;line-height:1.12;font-weight:900;color:#0f172a}',
            '#nchat-marketing-popup .nchat-marketing-body p{margin:0 0 18px;color:#64748b;line-height:1.5;font-size:14px}',
            '#nchat-marketing-popup .nchat-marketing-form{display:grid;gap:10px}',
            '#nchat-marketing-popup .nchat-marketing-form label{display:grid;gap:5px;color:#334155;font-size:12px;font-weight:800}',
            '#nchat-marketing-popup .nchat-marketing-form input{width:100%;border:1px solid #dbe3ef;border-radius:12px;padding:12px 13px;font:inherit;outline:none}',
            '#nchat-marketing-popup .nchat-marketing-form input:focus{border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.15)}',
            '#nchat-marketing-popup .nchat-marketing-form button,.nchat-marketing-thanks a{border:0;border-radius:12px;padding:13px 16px;background:var(--nchat-popup-button,#6366f1);color:#fff;font-weight:900;text-align:center;text-decoration:none;cursor:pointer}',
            '#nchat-marketing-popup .nchat-marketing-thanks{width:min(360px,calc(100vw - 32px));padding:28px;border-radius:20px;background:#fff;text-align:center;box-shadow:0 24px 80px rgba(15,23,42,.32)}',
            '#nchat-marketing-popup .nchat-marketing-thanks strong{display:block;margin-bottom:8px;font-size:22px;color:#0f172a}',
            '#nchat-marketing-popup .nchat-marketing-thanks p{margin:0 0 18px;color:#64748b;line-height:1.5}',
            '@keyframes nchatPopupIn{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}',
            '@media(max-width:520px){#nchat-marketing-popup{padding:14px}#nchat-marketing-popup.nchat-marketing-notification{left:14px;right:14px;bottom:88px}#nchat-marketing-popup .nchat-marketing-close{top:8px;right:8px}}',
            customCss || ''
        ].join('\n');
        document.head.appendChild(style);
    }

    function closeMarketingPopup(popup, base, countClose) {
        var host = document.getElementById('nchat-marketing-popup');
        if (host) host.remove();
        var style = document.getElementById('nchat-marketing-style');
        if (style) style.remove();
        if (countClose !== false) incrementPopupStat(base, getPopupRecordId(popup), 'closes');
    }

    function collectPopupFormValues(form) {
        var values = {};
        try {
            var data = new FormData(form);
            data.forEach(function (value, key) {
                values[key] = value;
            });
        } catch (e) { /* ignore */ }
        return values;
    }

    function emitPopupSubmit(popup, values) {
        try {
            window.dispatchEvent(new CustomEvent('nchat:popup_submit', {
                detail: {
                    popupId: getPopupRecordId(popup),
                    popupName: popup.name,
                    values: values || {}
                }
            }));
        } catch (e) { /* ignore */ }
    }

    function showPopupThankYou(host, popup) {
        var thankYou = popup.thankYou || {};
        var content = host.querySelector('.nchat-marketing-content') || host.querySelector('.nchat-marketing-shell');
        if (!content) return;
        var buttonText = thankYou.buttonText || '';
        var buttonUrl = safeExternalLink(thankYou.buttonUrl || '');
        content.innerHTML = '<div class="nchat-marketing-thanks">'
            + '<strong>' + escapePopupHtml(thankYou.title || 'Cảm ơn bạn') + '</strong>'
            + '<p>' + escapePopupHtml(thankYou.message || 'Chúng tôi đã nhận thông tin và sẽ liên hệ sớm.') + '</p>'
            + (buttonText && buttonUrl ? '<a href="' + buttonUrl + '" target="_blank" rel="noopener noreferrer">' + escapePopupHtml(buttonText) + '</a>' : '')
            + '</div>';
    }

    function wireMarketingPopup(host, popup, base) {
        var closeBtn = host.querySelector('[data-nchat-popup-close]');
        var backdrop = host.querySelector('.nchat-marketing-backdrop');
        if (closeBtn) closeBtn.addEventListener('click', function () { closeMarketingPopup(popup, base); });
        if (backdrop) backdrop.addEventListener('click', function () { closeMarketingPopup(popup, base); });

        var forms = host.querySelectorAll('form');
        Array.prototype.forEach.call(forms, function (form) {
            form.addEventListener('submit', function (event) {
                if (event.defaultPrevented) return;
                event.preventDefault();
                var values = collectPopupFormValues(form);
                incrementPopupStat(base, getPopupRecordId(popup), 'submissions');
                emitPopupSubmit(popup, values);
                showPopupThankYou(host, popup);
            });
        });
    }

    // The public API is backed by Prisma now (`id`, `senderType`) while older
    // widget payloads used Mongo-shaped records (`_id`, `sender.type`). Keep the
    // loader tolerant during the migration so history, realtime and retries all
    // address the same records.
    function getRecordId(record) {
        if (record === null || record === undefined) return '';
        if (typeof record === 'string' || typeof record === 'number') return String(record).trim();
        var value = record.id !== undefined && record.id !== null ? record.id : record._id;
        if (value === null || value === undefined) return '';
        return String(value).trim();
    }

    function getMessageSender(message) {
        var nested = message && message.sender ? message.sender : {};
        return {
            type: nested.type || (message && message.senderType) || '',
            id: nested.id || (message && message.senderId) || '',
            name: nested.name || (message && message.senderName) || ''
        };
    }

    function getMessageReply(message) {
        if (!message) return null;
        if (message.replyTo) return message.replyTo;
        if (message.replyToMessageId || message.replyToContent || message.replyToSenderName) {
            return {
                messageId: message.replyToMessageId || '',
                content: message.replyToContent || '',
                senderName: message.replyToSenderName || ''
            };
        }
        return null;
    }

    function isValidConversationId(value) {
        var conversationId = getRecordId(value);
        if (!conversationId || conversationId.length > 160) return false;
        if (/^(undefined|null|false|\[object Object\])$/i.test(conversationId)) return false;
        return !/[\s\/?#]/.test(conversationId);
    }

    function conversationUrl(base, conversationId, suffix) {
        if (!isValidConversationId(conversationId)) return '';
        return base + '/api/conversations/public/' + encodeURIComponent(getRecordId(conversationId)) + (suffix || '');
    }

    function escapeWidgetHtml(value) {
        return String(value === null || value === undefined ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function safeMediaSource(value) {
        var source = String(value || '').trim();
        if (!source) return '';
        if (/^https?:\/\//i.test(source) || /^blob:/i.test(source) || /^data:image\//i.test(source)) {
            return escapeWidgetHtml(source);
        }
        return '';
    }

    function safeExternalLink(value) {
        var source = String(value || '').trim();
        if (!source) return '';
        try {
            var parsed = new URL(source, window.location.href);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
            return escapeWidgetHtml(parsed.href);
        } catch (e) {
            return '';
        }
    }

    function formatMessageText(value) {
        return escapeWidgetHtml(value).replace(/\r?\n/g, '<br>');
    }

    function apiErrorMessage(result, status) {
        var error = result && (result.message || result.error);
        if (typeof error === 'string' && error) return error;
        if (error && typeof error === 'object') {
            if (typeof error.message === 'string') return error.message;
            if (typeof error.code === 'string') return error.code;
            try { return JSON.stringify(error); } catch (e) { }
        }
        return status ? 'HTTP ' + status : 'Request failed';
    }

    function renderCustomMarketingPopup(popup, base) {
        var customCode = (popup.design && popup.design.customCode) || {};
        insertMarketingStyles(customCode.css || '');

        var host = document.createElement('div');
        host.id = 'nchat-marketing-popup';
        if (popup.type === 'notification') host.className = 'nchat-marketing-notification';
        host.innerHTML = '<div class="nchat-marketing-backdrop"></div>'
            + '<div class="nchat-marketing-shell">'
            + '<button class="nchat-marketing-close" type="button" aria-label="Close" data-nchat-popup-close>×</button>'
            + '<div class="nchat-marketing-content">' + (customCode.html || '') + '</div>'
            + '</div>';
        document.body.appendChild(host);

        if (customCode.js) {
            try {
                var script = document.createElement('script');
                script.text = customCode.js;
                host.appendChild(script);
            } catch (e) {
                console.warn('[NemarkChat] Custom popup script failed:', e.message);
            }
        }
        wireMarketingPopup(host, popup, base);
    }

    function renderBasicMarketingPopup(popup, base) {
        var design = popup.design || {};
        var fields = design.fields || [];
        var buttonColor = design.buttonColor || '#6366f1';
        var fieldHtml = '';

        fields.forEach(function (field, index) {
            if (!field || !field.label) return;
            var type = field.type === 'email' ? 'email' : (field.type === 'phone' ? 'tel' : 'text');
            var name = String(field.label || ('field_' + index)).toLowerCase().replace(/\s+/g, '_');
            fieldHtml += '<label>' + escapePopupHtml(field.label)
                + '<input name="' + escapePopupHtml(name) + '" type="' + type + '" placeholder="' + escapePopupHtml(field.placeholder || '') + '"' + (field.required ? ' required' : '') + ' />'
                + '</label>';
        });

        insertMarketingStyles('');

        var host = document.createElement('div');
        host.id = 'nchat-marketing-popup';
        if (popup.type === 'notification') host.className = 'nchat-marketing-notification';
        host.style.setProperty('--nchat-popup-button', buttonColor);
        host.innerHTML = '<div class="nchat-marketing-backdrop"></div>'
            + '<div class="nchat-marketing-shell">'
            + '<button class="nchat-marketing-close" type="button" aria-label="Close" data-nchat-popup-close>×</button>'
            + '<div class="nchat-marketing-content">'
            + '<div class="nchat-marketing-card">'
            + (design.imageUrl ? '<img class="nchat-marketing-image" src="' + escapePopupHtml(design.imageUrl) + '" alt="" />' : '')
            + '<div class="nchat-marketing-body">'
            + '<h3>' + escapePopupHtml(popup.name || 'Ưu đãi dành cho bạn') + '</h3>'
            + '<p>' + escapePopupHtml((popup.thankYou && popup.thankYou.message) || 'Để lại thông tin để đội ngũ hỗ trợ liên hệ với bạn.') + '</p>'
            + '<form class="nchat-marketing-form">' + fieldHtml
            + '<button type="submit">' + escapePopupHtml(design.buttonText || 'Gửi thông tin') + '</button>'
            + '</form>'
            + '</div></div></div></div>';
        document.body.appendChild(host);
        wireMarketingPopup(host, popup, base);
    }

    // ────────────────────────────────────────
    // FALLBACK UI
    // ────────────────────────────────────────
    function renderFallback(reason) {
        if (_rendered) return;
        _rendered = true;

        // Cleanup any widget elements that may have partially rendered
        ['nchat-bubble', 'nchat-window'].forEach(function (id) {
            var el = document.getElementById(id); if (el) el.remove();
        });
        var css = document.createElement('style');
        css.id = 'nchat-fallback-styles';
        css.textContent = [
            '#nchat-fallback-bubble{position:fixed;bottom:24px;right:24px;width:60px;height:60px;border-radius:50%;background:#9ca3af;border:none;cursor:default;z-index:2147483646;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(0,0,0,0.1);opacity:0.6;transition:opacity .2s}',
            '#nchat-fallback-bubble:hover{opacity:0.8}',
            '#nchat-fallback-bubble svg{width:28px;height:28px;fill:#fff}',
            '#nchat-fallback-tip{position:fixed;bottom:92px;right:16px;background:#374151;color:#fff;padding:8px 14px;border-radius:10px;font-size:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;z-index:2147483646;opacity:0;pointer-events:none;transition:opacity .2s;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.15)}',
            '#nchat-fallback-tip::after{content:"";position:absolute;bottom:-6px;right:24px;border-left:6px solid transparent;border-right:6px solid transparent;border-top:6px solid #374151}',
            '#nchat-fallback-bubble:hover + #nchat-fallback-tip,#nchat-fallback-tip:hover{opacity:1}'
        ].join('\n');
        document.head.appendChild(css);

        var bubble = document.createElement('button');
        bubble.id = 'nchat-fallback-bubble';
        bubble.setAttribute('aria-label', 'Chat unavailable');
        bubble.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.2L4 17.2V4h16v12z"/></svg>';
        document.body.appendChild(bubble);

        var tipText = reason === 'inactive'
            ? 'Widget không hoạt động'
            : 'Chat tạm thời không khả dụng';
        var tip = document.createElement('div');
        tip.id = 'nchat-fallback-tip';
        tip.textContent = tipText;
        document.body.appendChild(tip);

        // Expose minimal API so tenant code doesn't crash
        var globalObjName = typeof window.NemarkChat === 'string' ? window.NemarkChat : 'NemarkChat';
        var apiObj = window[globalObjName] || {};
        apiObj.open = function () { };
        apiObj.close = function () { };
        apiObj.toggle = function () { };
        apiObj.widgetId = widgetId;
        apiObj.visitorId = visitorId;
        apiObj.isOnline = false;
        apiObj.error = reason;
        apiObj.destroy = function () {
            ['nchat-fallback-bubble', 'nchat-fallback-tip', 'nchat-fallback-styles'].forEach(function (elementId) {
                var element = document.getElementById(elementId);
                if (element) element.remove();
            });
            _rendered = false;
            window.__nchat_destroyed = true;
            window.__nchat_loaded = false;
        };
        window[globalObjName] = apiObj;
    }

    // ────────────────────────────────────────
    // RENDER
    // ────────────────────────────────────────
    function renderWidget(cfg, id, base, vid, bh, widgetName) {
        if (_rendered) return;
        var _globalCleanup = [];

        // ── URL Targeting: check domain + path rules before rendering ──
        var urlRules = cfg.urlRules || {};
        var domainRules = urlRules.domains || [];
        var pathRules = urlRules.paths || [];

        function matchesUrlRules() {
            var currentHost = window.location.hostname;
            var currentPath = window.location.pathname;

            // Domain rules
            if (domainRules.length > 0) {
                var domainInclude = domainRules.filter(function(r) { return r.type === 'include'; });
                var domainExclude = domainRules.filter(function(r) { return r.type === 'exclude'; });

                // If there are include rules, current host must match at least one
                if (domainInclude.length > 0) {
                    var matched = false;
                    for (var i = 0; i < domainInclude.length; i++) {
                        if (currentHost.indexOf(domainInclude[i].value) !== -1) { matched = true; break; }
                    }
                    if (!matched) return false;
                }
                // Exclude rules: if current host matches any, block
                for (var j = 0; j < domainExclude.length; j++) {
                    if (currentHost.indexOf(domainExclude[j].value) !== -1) return false;
                }

            }

            // Path rules
            if (pathRules.length > 0) {
                var pathInclude = pathRules.filter(function(r) { return r.type === 'include'; });
                var pathExclude = pathRules.filter(function(r) { return r.type === 'exclude'; });

                if (pathInclude.length > 0) {
                    var pathMatched = false;
                    for (var k = 0; k < pathInclude.length; k++) {
                        if (currentPath.indexOf(pathInclude[k].value) !== -1 || pathInclude[k].value === '*') { pathMatched = true; break; }
                    }
                    if (!pathMatched) return false;
                }
                for (var l = 0; l < pathExclude.length; l++) {
                    if (currentPath.indexOf(pathExclude[l].value) !== -1) return false;
                }
            }

            return true;
        }

        // If URL rules exist and page doesn't match, don't render
        if ((domainRules.length > 0 || pathRules.length > 0) && !matchesUrlRules()) {
            console.log('[NemarkChat] URL rules: page does not match, widget hidden.');
            return;
        }

        _rendered = true;

        // Cleanup fallback if it was shown during retries
        ['nchat-fallback-bubble', 'nchat-fallback-tip'].forEach(function (fid) {
            var el = document.getElementById(fid); if (el) el.remove();
        });

        var color = cfg.primaryColor || '#6366f1';
        var pos = cfg.position || 'bottom-right';

        // ── Business hours helper ──
        function isOnline() {
            // If business hours not enabled → always online
            if (!bh || !bh.enabled) return true;

            var tz = bh.timezone || 'Asia/Ho_Chi_Minh';
            var schedule = bh.schedule || [];
            var holidays = bh.holidays || [];
            if (!schedule.length) return true; // no schedule = always online

            // Get current date/time in workspace timezone
            var now;
            try {
                var fmt = new Intl.DateTimeFormat('en-CA', {
                    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', hour12: false
                });
                var parts = fmt.formatToParts(new Date());
                var get = function (t) { for (var i = 0; i < parts.length; i++) if (parts[i].type === t) return parts[i].value; return ''; };
                now = {
                    dateStr: get('year') + '-' + get('month') + '-' + get('day'),
                    day: new Date(get('year') + '-' + get('month') + '-' + get('day')).getDay(),
                    timeMin: parseInt(get('hour')) * 60 + parseInt(get('minute'))
                };
            } catch (e) {
                // Fallback: use local time
                var d = new Date();
                now = {
                    dateStr: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'),
                    day: d.getDay(),
                    timeMin: d.getHours() * 60 + d.getMinutes()
                };
            }

            // Check holidays
            for (var h = 0; h < holidays.length; h++) {
                if (holidays[h].date === now.dateStr) return false;
            }

            // Find schedule for today (day 0=Sun ... 6=Sat)
            var todaySchedule = null;
            for (var s = 0; s < schedule.length; s++) {
                if (schedule[s].day === now.day) { todaySchedule = schedule[s]; break; }
            }
            if (!todaySchedule) return false; // no schedule for today = offline

            // Parse HH:mm to minutes
            var startParts = (todaySchedule.startTime || todaySchedule.start || '00:00').split(':');
            var endParts = (todaySchedule.endTime || todaySchedule.end || '23:59').split(':');
            var startMin = parseInt(startParts[0]) * 60 + parseInt(startParts[1] || 0);
            var endMin = parseInt(endParts[0]) * 60 + parseInt(endParts[1] || 0);

            return now.timeMin >= startMin && now.timeMin < endMin;
        }

        var online = isOnline();
        var isRight = pos === 'bottom-right' || pos === 'side-right';
        var isSide = pos === 'side-right' || pos === 'side-left';
        var isLeft = pos === 'bottom-left' || pos === 'side-left';
        var greeting = cfg.greeting || 'Xin chào! Chúng tôi có thể giúp gì?';
        var placeholder = cfg.placeholder || 'Nhập tin nhắn...';
        var pcf = cfg.preChatForm || {};
        var preChatEnabled = pcf.enabled || false;
        var lang = cfg.language || 'vi';

        // Advanced styling
        var bgVal = cfg.gradient || color;
        var launcherStyle = cfg.launcherStyle || 'bubble';
        var launcherText = cfg.launcherText || '';
        var launcherIcon = cfg.launcherIcon || '';
        var tooltipText = cfg.tooltipText || '';
        var profileDisplay = cfg.profileDisplay || 'company';
        var typingIndicatorsEnabled = cfg.showTypingIndicator !== false;

        // ── Inject CSS ──
        var css = document.createElement('style');
        css.id = 'nchat-styles';

        // Launcher Button rules based on style
        var bubbleCss = '';
        var bubblePos = '';
        if (isSide) {
            bubblePos = 'top:50%;transform:translateY(-50%);' + (pos === 'side-right' ? 'right:0;' : 'left:0;');
            if (launcherStyle === 'tab') {
                bubbleCss = 'width:auto;height:48px;padding:0 16px;border-radius:' + (pos === 'side-right' ? '8px 0 0 8px' : '0 8px 8px 0') + ';display:flex;align-items:center;gap:8px;font-weight:600;font-size:15px;';
            } else if (launcherStyle === 'image') {
                bubbleCss = 'width:64px;height:64px;background:transparent;box-shadow:none;border-radius:0;padding:0;';
            } else {
                bubbleCss = 'width:60px;height:60px;border-radius:' + (pos === 'side-right' ? '30px 0 0 30px' : '0 30px 30px 0') + ';display:flex;align-items:center;justify-content:center;';
            }
        } else {
            bubblePos = 'bottom:24px;' + (isRight ? 'right:24px;' : 'left:24px;');
            if (launcherStyle === 'pill') {
                bubbleCss = 'width:auto;height:52px;border-radius:26px;padding:0 24px;display:flex;align-items:center;gap:10px;font-weight:600;font-size:15px;';
            } else if (launcherStyle === 'image') {
                bubbleCss = 'width:64px;height:64px;background:transparent;box-shadow:none;border-radius:0;padding:0;';
            } else { // default bubble
                bubbleCss = 'width:60px;height:60px;border-radius:50%;display:flex;align-items:center;justify-content:center;';
            }
        }

        // Window Pos
        var winPos = '';
        if (isSide) {
            winPos = (pos === 'side-right' ? 'right:80px;' : 'left:80px;') + 'top:50%;transform:translateY(calc(-50% + 16px)) scale(0.95);';
        } else {
            winPos = (isRight ? 'right:24px;' : 'left:24px;') + 'bottom:96px;transform:translateY(16px) scale(0.95);';
        }

        css.textContent = [
            // ── Reset for widget namespace ──
            '#nchat-bubble,#nchat-window,#nchat-tooltip{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}',
            ':where(#nchat-bubble *,#nchat-window *,#nchat-tooltip *){box-sizing:border-box;margin:0;padding:0;font-family:inherit}',

            // ── Bubble Launcher ──
            '#nchat-bubble{position:fixed;' + bubblePos + bubbleCss + 'background:' + bgVal + ';color:#fff;cursor:pointer;z-index:2147483647;box-shadow:' + (launcherStyle === 'image' ? 'none' : '0 4px 20px rgba(0,0,0,0.2)') + ';transition:all .35s cubic-bezier(.4,0,.2,1);border:none;outline:none}',
            '#nchat-bubble:hover{transform:' + (isSide ? 'translateY(-50%)' : 'translateY(0)') + ' scale(1.08);box-shadow:' + (launcherStyle === 'image' ? 'none' : '0 6px 28px rgba(0,0,0,0.25)') + '}',
            '#nchat-bubble svg{width:26px;height:26px;fill:currentColor;transition:transform .3s ease}',
            '#nchat-bubble img.nchat-custom-img{width:100%;height:100%;object-fit:cover;border-radius:50%;box-shadow:0 4px 16px rgba(0,0,0,0.15)}',
            '#nchat-bubble.nchat-opened-bubble{opacity:0;visibility:hidden;pointer-events:none;transform:' + (isSide ? 'translateY(-50%)' : 'translateY(10px)') + ' scale(.88)}',
            '#nchat-bubble .nchat-badge{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;font-size:10px;font-weight:700;min-width:20px;height:20px;border-radius:10px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(239,68,68,.4);border:2px solid #fff;padding:0 4px}',

            // ── Tooltip (Subiz card-style) ──
            '#nchat-tooltip{position:fixed;z-index:2147483647;background:#fff;color:#333;padding:12px 16px;border-radius:12px;font-size:13px;font-weight:500;box-shadow:0 4px 20px rgba(0,0,0,0.12);opacity:0;pointer-events:none;transition:opacity .25s ease,transform .25s ease;transform:translateY(4px);max-width:240px;line-height:1.4}',
            '#nchat-tooltip.nchat-tip-visible{opacity:1;pointer-events:auto;transform:translateY(0)}',
            '#nchat-tooltip::after{content:"";position:absolute;bottom:-6px;' + (isRight ? 'right:24px;' : 'left:24px;') + 'border-left:6px solid transparent;border-right:6px solid transparent;border-top:6px solid #fff}',
            '.nchat-tip-hdr{display:flex;align-items:center;gap:8px;margin-bottom:4px}',
            '.nchat-tip-dot{width:8px;height:8px;border-radius:50%;background:#22c55e;flex-shrink:0}',
            '.nchat-tip-name{font-weight:600;font-size:13px;color:#1a1a2e}',
            '.nchat-tip-sub{font-size:12px;color:#64748b;font-weight:400}',

            // ── Chat Window ──
            '#nchat-window{position:fixed;' + winPos + 'width:var(--nchat-window-width,372px);max-width:calc(100vw - 32px);height:var(--nchat-window-height,580px);max-height:min(var(--nchat-window-height,580px),calc(100dvh - 120px));border:1px solid rgba(15,23,42,.1);border-radius:18px;overflow:hidden;box-shadow:0 24px 64px rgba(15,23,42,.2),0 8px 22px rgba(15,23,42,.08);z-index:2147483647;background:#fff;opacity:0;pointer-events:none;transition:opacity .22s ease,transform .28s cubic-bezier(.2,.8,.2,1),width .24s ease,height .24s ease;display:flex;flex-direction:column;color:#172033}',
            '#nchat-window.nchat-open{transform:' + (isSide ? 'translateY(-50%)' : 'translateY(0)') + ' scale(1);opacity:1;pointer-events:auto}',
            '#nchat-window.nchat-maximized{top:24px!important;bottom:auto!important;' + (isRight ? 'right:24px!important;left:auto!important;' : 'left:24px!important;right:auto!important;') + 'width:min(640px,calc(100vw - 48px));height:min(760px,calc(100dvh - 48px));max-height:none;transform:translateY(16px) scale(.98)}',
            '#nchat-window.nchat-open.nchat-maximized{transform:none!important}',
            '#nchat-window.nchat-minimized{top:auto!important;bottom:24px!important;' + (isRight ? 'right:24px!important;left:auto!important;' : 'left:24px!important;right:auto!important;') + 'width:min(332px,calc(100vw - 32px));height:auto;max-height:none;transform:translateY(8px) scale(.98)}',
            '#nchat-window.nchat-open.nchat-minimized{transform:none!important}',
            '#nchat-window.nchat-minimized>:not(#nchat-hdr){display:none!important}',

            // ── Header (Premium Apple/Google Design) ──
            '#nchat-hdr{background:' + bgVal + ';padding:17px 126px 16px 17px;color:#fff;position:relative;flex-shrink:0;box-shadow:0 1px 0 rgba(255,255,255,.14) inset;z-index:10}',
            '#nchat-hdr-inner{display:flex;align-items:center;gap:11px;position:relative;z-index:1}',
            '#nchat-hdr-avatar{width:40px;height:40px;border-radius:12px;background:rgba(255,255,255,.96);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;box-shadow:0 4px 14px rgba(15,23,42,.13)}',
            '#nchat-hdr-avatar img{width:100%;height:100%;object-fit:cover}',
            '#nchat-hdr-avatar svg{width:24px;height:24px;fill:' + color + '}',
            '#nchat-hdr-text{flex:1;min-width:0}',
            '#nchat-hdr h4{margin:0;font-size:14px;font-weight:720;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:-.1px;color:#fff}',
            '#nchat-hdr p{margin:2px 0 0;font-size:11px;color:rgba(255,255,255,.8);line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:450}',
            '#nchat-hdr-actions{position:absolute;top:15px;right:14px;display:flex;align-items:center;gap:5px;z-index:2}',
            '#nchat-hdr-actions button{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.22);color:#fff;width:30px;height:30px;border-radius:9px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .18s ease,transform .18s ease;line-height:1;padding:0}',
            '#nchat-hdr-actions button:hover{background:rgba(255,255,255,.3);transform:translateY(-1px)}',
            '#nchat-hdr-actions button:focus-visible,#nchat-hdr-back:focus-visible,#nchat-bubble:focus-visible,#nchat-new-conv:focus-visible,.nchat-list-item:focus-visible,.nchat-reply-action:focus-visible,#nchat-emoji-picker button:focus-visible{outline:3px solid rgba(255,255,255,.9);outline-offset:2px}',
            '#nchat-hdr-actions svg{width:14px;height:14px;fill:currentColor}',
            '#nchat-window.nchat-minimized #nchat-hdr{padding:12px 92px 12px 13px;cursor:pointer}',
            '#nchat-window.nchat-minimized #nchat-hdr-avatar{width:34px;height:34px;border-radius:10px}',
            '#nchat-window.nchat-minimized #nchat-hdr p,#nchat-window.nchat-minimized .nchat-online{display:none}',
            '#nchat-window.nchat-minimized #nchat-hdr-actions{top:14px}',
            '#nchat-window.nchat-minimized #nchat-hdr-size{display:none}',
            '#nchat-resize-handle{position:absolute;top:3px;' + (isRight ? 'left:3px;cursor:nwse-resize;' : 'right:3px;cursor:nesw-resize;') + 'width:14px;height:14px;border:0;background:transparent;padding:0;z-index:20;opacity:.45;touch-action:none}',
            '#nchat-resize-handle::before{content:"";position:absolute;inset:2px;border-top:2px solid rgba(255,255,255,.9);' + (isRight ? 'border-left:2px solid rgba(255,255,255,.9);border-radius:4px 0 0 0;' : 'border-right:2px solid rgba(255,255,255,.9);border-radius:0 4px 0 0;') + '}',
            '#nchat-resize-handle:hover,#nchat-resize-handle:focus-visible{opacity:1;outline:2px solid rgba(255,255,255,.85);outline-offset:1px}',
            '#nchat-window.nchat-minimized #nchat-resize-handle,#nchat-window.nchat-maximized #nchat-resize-handle{display:none}',
            '#nchat-window.nchat-resizing{transition:none!important;user-select:none}',
            '.nchat-online{display:inline-flex;align-items:center;gap:5px;font-size:10px;margin-top:5px;color:rgba(255,255,255,.92);font-weight:600;letter-spacing:.01em}',
            '.nchat-online-dot{width:7px;height:7px;border-radius:50%;background:#5ee89a;display:inline-block;box-shadow:0 0 0 2px rgba(94,232,154,.18);animation:nchat-pulse 2s infinite}',
            '@keyframes nchat-pulse{0%,100%{opacity:1}50%{opacity:.5}}',
            '.nchat-offline-dot{width:8px;height:8px;border-radius:50%;background:#fca5a5;display:inline-block;border:2px solid rgba(255,255,255,0.8)}',
            '#nchat-hdr-left{display:flex;align-items:center;gap:8px}',
            '#nchat-hdr-back{background:transparent;border:none;color:#fff;width:32px;height:32px;border-radius:50%;cursor:pointer;display:none;align-items:center;justify-content:center;margin-left:-8px;transition:background 0.2s;flex-shrink:0}',
            '#nchat-hdr-back:hover{background:rgba(255,255,255,.25)}',
            '#nchat-hdr-back svg{width:22px;height:22px;fill:currentColor}',
            '#nchat-window.show-chat.has-list #nchat-hdr-back{display:flex}',

            // ── List View (Apple/Google Style Floating Cards) ──
            '#nchat-list-view{flex:1;overflow:hidden;background:#f6f8fb;display:none;flex-direction:column;position:relative}',
            '.nchat-list-items{flex:1;overflow-y:auto;padding:18px 14px 14px;display:flex;flex-direction:column;gap:12px;scrollbar-width:thin;scrollbar-color:#d7dde7 transparent}',
            '.nchat-list-intro{padding:0 2px 4px;background:transparent}',
            '.nchat-list-intro-title{font-size:14px;line-height:18px;font-weight:720;color:#172033;margin-bottom:5px;letter-spacing:-.1px}',
            '.nchat-list-intro-text{font-size:12px;line-height:17px;color:#7a8699}',
            '.nchat-list-item{width:100%;min-height:66px;background:#fff;border:1px solid #e2e7ef;border-radius:15px;padding:12px;cursor:pointer;box-shadow:0 2px 8px rgba(15,23,42,.045);transition:border-color .16s ease,box-shadow .16s ease,transform .16s ease;display:flex;align-items:center;gap:11px;text-align:left;font:inherit}',
            '.nchat-list-item:hover{border-color:' + color + '55;background:#fff;box-shadow:0 7px 18px rgba(15,23,42,.07);transform:translateY(-1px)}',
            '.nchat-list-item:active{transform:scale(0.98)}',
            '.nchat-list-avatar{width:40px;height:40px;border-radius:12px;background:' + color + '10;color:' + color + ';display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0}',
            '.nchat-list-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}',
            '.nchat-list-name{font-size:13px;line-height:18px;font-weight:680;color:#172033;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:-.1px}',
            '.nchat-list-msg{font-size:11px;line-height:16px;color:#7a8699;font-weight:450;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
            '.nchat-list-meta{display:flex;flex-direction:column;align-items:flex-end;gap:7px;flex-shrink:0}',
            '.nchat-list-time{font-size:10px;color:#94a3b8;font-weight:650;white-space:nowrap}',
            '.nchat-list-status{font-size:9px;font-weight:650;color:#087a55;background:#eaf8f2;border-radius:999px;padding:3px 6px}',
            '.nchat-list-status.nchat-list-status-closed{color:#64748b;background:#f1f5f9}',
            '.nchat-list-arrow{color:#cbd5e1;display:flex;align-items:center;flex-shrink:0;margin-left:1px}',
            '.nchat-list-footer{padding:12px 16px 14px;background:#fff;border-top:1px solid #e8ebf0}',
            '.nchat-list-footer-copy{text-align:center;color:#8b96a8;font-size:10px;line-height:1.35;margin-top:8px}',
            '#nchat-new-conv{width:100%;min-height:44px;padding:10px 14px;background:' + color + ';color:#fff;border:none;border-radius:11px;font-weight:680;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;font-size:12px;transition:all .18s ease;box-shadow:0 5px 14px ' + color + '28;letter-spacing:-.05px}',
            '#nchat-new-conv:hover{transform:translateY(-1px);box-shadow:0 7px 18px ' + color + '38}',
            '#nchat-new-conv:active{transform:translateY(0);box-shadow:0 2px 8px ' + color + '40}',
            '#nchat-new-conv svg{width:18px;height:18px;fill:currentColor}',

            // View switching
            '#nchat-chat-view{flex:1;display:none;flex-direction:column;overflow:hidden;position:relative}',
            '#nchat-window.show-list #nchat-list-view{display:flex}',
            '#nchat-window.show-chat #nchat-chat-view{display:flex}',
            '#nchat-window.nchat-awaiting-profile #nchat-ftr{display:none}',

            // ── Chat Body ──
            '#nchat-body{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:18px;background:linear-gradient(180deg,#f8fafc 0%,#f4f7fb 100%);min-height:0;scrollbar-width:thin;scrollbar-color:#cbd5e1 transparent}',

            // Network / delivery state
            '#nchat-connection-state{display:none;align-items:center;justify-content:center;gap:7px;min-height:30px;padding:6px 12px;border-bottom:1px solid #e2e8f0;background:#fff7ed;color:#9a3412;font-size:11px;font-weight:650;flex-shrink:0}',
            '#nchat-connection-state.nchat-state-visible{display:flex}',
            '#nchat-connection-state.nchat-state-error{background:#fff1f2;color:#be123c}',
            '#nchat-connection-state.nchat-state-online{background:#ecfdf5;color:#047857}',
            '.nchat-state-dot{width:7px;height:7px;border-radius:50%;background:currentColor;box-shadow:0 0 0 3px currentColor;opacity:.65}',
            '.nchat-list-state{margin:auto;padding:36px 24px;text-align:center;color:#64748b;font-size:13px;line-height:1.55}',
            '.nchat-list-state strong{display:block;color:#0f172a;font-size:14px;margin-bottom:5px}',
            '.nchat-list-state button{margin-top:12px;padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#334155;font-weight:650;cursor:pointer}',
            '.nchat-skeleton{height:70px;border-radius:12px;border:1px solid #edf0f5;background:linear-gradient(90deg,#fff 20%,#f3f5f8 38%,#fff 56%);background-size:240% 100%;animation:nchat-shimmer 1.3s infinite}',
            '@keyframes nchat-shimmer{to{background-position:-240% 0}}',

            // ── Empty State (Subiz-style SVG illustration) ──
            '.nchat-empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:34px 24px;text-align:center;min-height:260px}',
            '.nchat-empty-state svg{width:92px;height:92px;margin-bottom:16px;opacity:.92}',
            '.nchat-empty-title{font-size:15px;color:#0f172a;line-height:1.4;font-weight:750;margin-bottom:5px}',
            '.nchat-empty-text{max-width:250px;font-size:12px;color:#64748b;line-height:1.55;font-weight:450}',
            '.nchat-empty-trust{display:flex;align-items:center;gap:6px;margin-top:15px;color:#64748b;font-size:10px}',
            '.nchat-empty-trust span{width:3px;height:3px;border-radius:50%;background:#94a3b8}',

            // ── Pre-chat form (redesigned) ──
            '#nchat-pcf{max-width:100%;padding:4px 0;display:flex;flex-direction:column}',
            '#nchat-pcf .nchat-pcf-title{font-size:14px;font-weight:600;color:#1a1a2e;margin-bottom:16px}',
            '#nchat-pcf label{display:block;font-size:12px;font-weight:500;color:#475569;margin-bottom:4px}',
            '#nchat-pcf label .nchat-req{color:#ef4444;margin-left:2px}',
            '#nchat-pcf input{width:100%;padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:13px;margin-bottom:12px;box-sizing:border-box;outline:none;transition:border-color .2s,box-shadow .2s;background:#fff}',
            '#nchat-pcf input:focus{border-color:' + color + ';box-shadow:0 0 0 3px ' + color + '20}',
            '#nchat-pcf button{width:100%;padding:12px;border:none;border-radius:12px;background:' + bgVal + ';color:#fff;font-weight:600;cursor:pointer;font-size:14px;transition:all .2s;margin-top:4px;order:60}',
            '#nchat-pcf button:hover{opacity:.92;transform:translateY(-1px);box-shadow:0 4px 12px ' + color + '30}',
            '#nchat-pcf textarea{width:100%;padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:13px;margin-bottom:12px;box-sizing:border-box;outline:none;transition:border-color .2s,box-shadow .2s;font-family:inherit;resize:vertical;min-height:60px;max-height:120px;background:#fff}',
            '#nchat-pcf textarea:focus{border-color:' + color + ';box-shadow:0 0 0 3px ' + color + '20}',
            '#nchat-pcf select{width:100%;padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:13px;margin-bottom:12px;box-sizing:border-box;outline:none;transition:border-color .2s;background:#fff;cursor:pointer;appearance:auto}',
            '#nchat-pcf select:focus{border-color:' + color + '}',
            '.nchat-pcf-err{font-size:11px;color:#ef4444;margin:-8px 0 8px;line-height:1.3}',
            '#nchat-pcf input.nchat-invalid,#nchat-pcf textarea.nchat-invalid,#nchat-pcf select.nchat-invalid{border-color:#ef4444}',
            '#nchat-pcf .nchat-consent{display:flex;align-items:flex-start;gap:9px;margin:4px 0 13px;color:#475569;font-size:11px;line-height:1.45;cursor:pointer;order:50}',
            '#nchat-pcf .nchat-consent input{appearance:auto;width:17px;height:17px;min-width:17px;margin:1px 0 0;padding:0;border:1px solid #cbd5e1;border-radius:4px;box-shadow:none;accent-color:' + color + '}',
            '#nchat-pcf .nchat-consent span{display:block}',

            // ── Message Bubbles (improved) ──
            '.nchat-msg{margin-bottom:10px;display:flex;align-items:flex-end;gap:6px;animation:nchat-fadeIn .25s ease}',
            '@keyframes nchat-fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}',
            '.nchat-msg-bot{justify-content:flex-start}',
            '.nchat-msg-user{justify-content:flex-end}',
            '.nchat-msg-bubble{max-width:80%;padding:11px 13px;border-radius:15px;font-size:14px;line-height:1.52;word-wrap:break-word;overflow-wrap:anywhere}',
            '.nchat-msg-bot .nchat-msg-bubble{background:#fff;border:1px solid #e4e8ef;border-bottom-left-radius:4px;color:#1e293b;box-shadow:0 2px 6px rgba(15,23,42,.035)}',
            '.nchat-msg-user .nchat-msg-bubble{background:' + bgVal + ';color:#fff;border-bottom-right-radius:4px;box-shadow:0 4px 12px ' + color + '24;min-width:34px;text-align:left}',

            // Message states
            '.nchat-msg-sending{opacity:.55}',
            '.nchat-msg-sending .nchat-msg-bubble{position:relative}',
            '.nchat-msg-sending .nchat-msg-bubble::after{content:"";position:absolute;bottom:4px;right:8px;width:10px;height:10px;border:2px solid rgba(255,255,255,.5);border-top-color:transparent;border-radius:50%;animation:nchat-spin .7s linear infinite}',
            '@keyframes nchat-spin{to{transform:rotate(360deg)}}',
            '.nchat-msg-error .nchat-msg-bubble{border:1.5px solid #ef4444 !important}',
            '.nchat-msg-error.nchat-msg-user .nchat-retry-btn{order:-1}',
            '.nchat-retry-btn{display:inline-flex;align-items:center;margin:0 0 2px;padding:5px 8px;font-size:10px;font-weight:700;color:#be123c;background:#fff;border:1px solid #fda4af;border-radius:7px;cursor:pointer;transition:all .2s;white-space:nowrap}',
            '.nchat-retry-btn:hover{background:#ef4444;color:#fff}',
            '.nchat-msg-status{display:block;font-size:10px;color:#94a3b8;margin-top:2px;text-align:right;line-height:1}',
            '.nchat-msg-status-sent::after{content:"✓"}',
            '.nchat-msg-status-delivered::after{content:"✓✓"}',
            '.nchat-msg-status-read::after{content:"✓✓";color:#34b7f1}',

            // ── Footer Input (Subiz-style clean bar) ──
            '.nchat-reply-action{width:28px;height:28px;border:0;border-radius:999px;background:#fff;color:#7c8aa0;box-shadow:0 2px 10px rgba(15,23,42,.12);display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:0;transform:scale(.9);transition:opacity .16s ease,transform .16s ease,color .16s ease;flex:0 0 28px;margin-bottom:4px;padding:0}',
            '.nchat-msg:hover .nchat-reply-action,.nchat-reply-action:focus-visible{opacity:1;transform:scale(1)}',
            '.nchat-reply-action:hover{color:' + color + '}',
            '.nchat-reply-action svg{width:15px;height:15px;fill:currentColor}',
            '.nchat-msg-user .nchat-reply-action{order:-1}',
            '.nchat-msg-quote{display:block;width:100%;border:0;border-left:3px solid currentColor;border-radius:7px;background:rgba(15,23,42,.06);padding:6px 8px;margin:0 0 7px;color:inherit;text-align:left;cursor:pointer;opacity:.9;font:inherit}',
            '.nchat-msg-user .nchat-msg-quote{background:rgba(255,255,255,.17)}',
            '.nchat-msg-quote strong,.nchat-msg-quote span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
            '.nchat-msg-quote strong{font-size:11px;margin-bottom:2px}',
            '.nchat-msg-quote span{font-size:11px;opacity:.82}',
            '.nchat-msg.nchat-message-flash .nchat-msg-bubble{animation:nchatMessageFlash 1.1s ease}',
            '@keyframes nchatMessageFlash{0%,100%{box-shadow:inherit}35%{box-shadow:0 0 0 4px ' + color + '35}}',
            '#nchat-reply-preview{display:none;align-items:center;gap:9px;padding:8px 12px 7px;background:#fff;border-top:1px solid #e8ebf0;flex-shrink:0}',
            '#nchat-reply-preview.nchat-reply-visible{display:flex}',
            '#nchat-reply-preview-copy{flex:1;min-width:0;border-left:3px solid ' + color + ';padding-left:9px}',
            '#nchat-reply-preview-copy strong,#nchat-reply-preview-copy span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
            '#nchat-reply-preview-copy strong{font-size:11px;color:' + color + ';margin-bottom:2px}',
            '#nchat-reply-preview-copy span{font-size:11px;color:#64748b}',
            '#nchat-reply-cancel{width:28px;height:28px;border:0;border-radius:999px;background:#f1f5f9;color:#64748b;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;flex:0 0 28px}',
            '#nchat-reply-cancel svg{width:13px;height:13px;fill:currentColor}',
            '#nchat-ftr{padding:10px 12px;border-top:1px solid #e8ebf0;display:flex;gap:6px;align-items:flex-end;background:#fff;flex-shrink:0}',
            '#nchat-ftr textarea,#nchat-ftr input{flex:1;min-height:40px;max-height:108px;padding:10px 12px;border:1px solid #dbe1ea;border-radius:12px;font-size:13px;line-height:1.4;outline:none;transition:border-color .2s,box-shadow .2s;background:#f8fafc;min-width:0;color:#0f172a;resize:none;overflow-y:auto;font-family:inherit}',
            '#nchat-ftr textarea:focus,#nchat-ftr input:focus{border-color:' + color + ';background:#fff;box-shadow:0 0 0 3px ' + color + '15}',
            '#nchat-ftr textarea::placeholder,#nchat-ftr input::placeholder{color:#94a3b8}',
            // Emoji button (decorative)
            '#nchat-emoji-btn{width:32px;height:32px;border-radius:50%;border:none;background:transparent;color:#94a3b8;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:color .2s;flex-shrink:0;padding:0}',
            '#nchat-emoji-btn:hover{color:' + color + '}',
            '#nchat-emoji-btn svg{width:20px;height:20px;fill:currentColor}',
            '#nchat-emoji-picker{position:absolute;left:12px;bottom:62px;width:268px;max-width:calc(100% - 24px);padding:10px;display:none;grid-template-columns:repeat(6,1fr);gap:4px;background:#fff;border:1px solid #dfe5ee;border-radius:16px;box-shadow:0 18px 44px rgba(15,23,42,.2);z-index:30}',
            '#nchat-emoji-picker.nchat-picker-open{display:grid}',
            '#nchat-emoji-picker button{width:36px;height:36px;border:0;border-radius:9px;background:transparent;font-size:21px;line-height:1;cursor:pointer;padding:0}',
            '#nchat-emoji-picker button:hover,#nchat-emoji-picker button:focus-visible{background:#eef2ff;transform:scale(1.08);outline:2px solid ' + color + ';outline-offset:0}',
            // Attachment / upload
            '#nchat-upload-btn{width:32px;height:32px;border-radius:50%;border:none;background:transparent;color:#94a3b8;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:color .2s;flex-shrink:0;padding:0}',
            '#nchat-upload-btn:hover{color:' + color + '}',
            '#nchat-upload-btn svg{width:20px;height:20px;fill:currentColor}',
            // Send button
            '#nchat-send{width:40px;height:40px;border-radius:10px;border:none;background:' + bgVal + ';color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0;padding:0;box-shadow:0 5px 12px ' + color + '28}',
            '#nchat-send:disabled{cursor:default;opacity:.42;box-shadow:none;transform:none}',
            '#nchat-send:hover{opacity:.85;transform:scale(1.05)}',
            '#nchat-send svg{width:18px;height:18px;fill:currentColor}',

            // ── Branding (Subiz-style centered) ──
            '.nchat-brand{text-align:center;padding:7px 8px;font-size:10px;color:#94a3b8;background:#fff;border-top:1px solid #f0f0f5;flex-shrink:0}',
            '.nchat-brand a{color:#64748b;text-decoration:none;font-weight:500;transition:color .2s}',
            '.nchat-brand a:hover{color:' + color + '}',
            '.nchat-brand svg{width:14px;height:14px;vertical-align:middle;margin-right:3px;fill:#94a3b8}',

            // ── Offline state ──
            '.nchat-offline-msg{padding:24px 16px;text-align:center;color:#64748b;font-size:13px;line-height:1.6}',
            '#nchat-offline-form{padding:16px}',
            '#nchat-offline-form label{display:block;font-size:12px;color:#475569;margin-bottom:4px;font-weight:500}',
            '#nchat-offline-form input,#nchat-offline-form textarea{width:100%;padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:13px;margin-bottom:12px;box-sizing:border-box;outline:none;transition:border-color .2s;font-family:inherit;background:#fff}',
            '#nchat-offline-form input:focus,#nchat-offline-form textarea:focus{border-color:' + color + '}',
            '#nchat-offline-form textarea{resize:vertical;min-height:60px}',
            '#nchat-offline-form button{width:100%;padding:12px;border:none;border-radius:12px;background:' + bgVal + ';color:#fff;font-weight:600;cursor:pointer;font-size:14px;transition:all .2s;margin-top:4px}',
            '#nchat-offline-form button:hover{opacity:.92;transform:translateY(-1px)}',

            // ── Image messages ──
            '.nchat-msg-img{max-width:100%;border-radius:10px;cursor:pointer;margin-top:4px;transition:opacity .2s}',
            '.nchat-msg-img:hover{opacity:.88}',
            '.nchat-file-chip{display:flex;align-items:center;gap:7px;font-weight:650;font-size:12px}.nchat-file-chip svg{width:17px;height:17px;fill:currentColor;flex-shrink:0}',
            '.nchat-img-preview{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.88);z-index:2147483647;display:flex;align-items:center;justify-content:center;cursor:zoom-out;animation:nchat-fadeIn .2s ease}',
            '.nchat-img-preview img{max-width:90%;max-height:90%;border-radius:8px}',

            // ── Typing indicator ──
            '.nchat-typing{animation:nchat-typing-in .18s ease-out}',
            '.nchat-typing .nchat-msg-bubble{font-style:normal !important;opacity:1 !important;display:flex;align-items:center;gap:9px;padding:10px 14px}',
            '.nchat-typing-label{font-size:12px;line-height:1;color:#64748b;font-weight:600;white-space:nowrap}',
            '.nchat-dots{display:flex;gap:3px;align-items:center}',
            '.nchat-dots span{width:6px;height:6px;border-radius:50%;background:#94a3b8;animation:nchat-bounce 1.4s infinite ease-in-out both}',
            '.nchat-dots span:nth-child(1){animation-delay:0s}',
            '.nchat-dots span:nth-child(2){animation-delay:.16s}',
            '.nchat-dots span:nth-child(3){animation-delay:.32s}',
            '@keyframes nchat-typing-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}',
            '@keyframes nchat-bounce{0%,80%,100%{transform:scale(0.6);opacity:.4}40%{transform:scale(1);opacity:1}}',

            // ── Greeting Popup Card (Subiz-style floating notification) ──
            '#nchat-greeting{position:fixed;z-index:2147483646;' + (isRight ? 'right:24px;' : 'left:24px;') + 'bottom:96px;background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.12);max-width:300px;opacity:0;transform:translateY(12px) scale(0.95);transition:all .35s cubic-bezier(.4,0,.2,1);pointer-events:none;overflow:hidden}',
            '#nchat-greeting.nchat-greeting-show{opacity:1;transform:translateY(0) scale(1);pointer-events:auto}',
            '#nchat-greeting-inner{padding:14px 16px;display:flex;align-items:flex-start;gap:10px}',
            '#nchat-greeting-avatar{width:36px;height:36px;border-radius:50%;background:' + bgVal + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden}',
            '#nchat-greeting-avatar img{width:100%;height:100%;object-fit:cover}',
            '#nchat-greeting-avatar svg{width:18px;height:18px;fill:#fff}',
            '#nchat-greeting-text{flex:1;min-width:0}',
            '.nchat-greeting-name{font-size:13px;font-weight:600;color:#1a1a2e;margin-bottom:2px}',
            '.nchat-greeting-msg{font-size:12px;color:#475569;line-height:1.4}',
            '#nchat-greeting-cta{display:block;padding:8px 16px;color:' + color + ';font-weight:600;font-size:13px;text-decoration:none;border-top:1px solid #f0f0f5;cursor:pointer;transition:background .2s;text-align:center}',
            '#nchat-greeting-cta:hover{background:#f8f9fb}',
            '#nchat-greeting-close{position:absolute;top:6px;right:6px;width:22px;height:22px;border-radius:50%;background:transparent;border:none;color:#94a3b8;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s;padding:0;font-size:14px}',
            '#nchat-greeting-close:hover{background:#f1f5f9;color:#64748b}',
            '#nchat-greeting-close svg{width:14px;height:14px;fill:currentColor}',

            // ── CSAT Rating (stars after conversation close) ──
            '.nchat-csat{text-align:center;padding:16px}',
            '.nchat-csat-title{font-size:13px;color:#475569;margin-bottom:10px;font-weight:500}',
            '.nchat-csat-stars{display:flex;justify-content:center;gap:6px}',
            '.nchat-csat-star{width:32px;height:32px;cursor:pointer;fill:#d1d5db;transition:all .2s;border:none;background:none;padding:0}',
            '.nchat-csat-star:hover,.nchat-csat-star.nchat-star-active{fill:#f59e0b;transform:scale(1.15)}',
            '.nchat-csat-thanks{font-size:12px;color:#22c55e;margin-top:8px;font-weight:500;display:none}',

            // ── Mobile ──
            '@media(max-width:600px){#nchat-window{inset:0 !important;width:100vw;max-width:100vw;height:100vh;height:100dvh;max-height:none;border:0;border-radius:0;transform:translateY(24px) scale(1)}#nchat-window.nchat-open{transform:none}#nchat-window.nchat-minimized{inset:auto 12px calc(12px + env(safe-area-inset-bottom)) 12px!important;width:auto;max-width:none;height:auto;border:1px solid rgba(15,23,42,.1);border-radius:16px}#nchat-window.nchat-open.nchat-minimized{transform:none!important}#nchat-hdr{padding-top:calc(14px + env(safe-area-inset-top));padding-right:92px;padding-left:16px}#nchat-hdr-actions{top:calc(14px + env(safe-area-inset-top))}#nchat-hdr-size,#nchat-resize-handle{display:none!important}#nchat-body{padding:16px}#nchat-ftr{padding-bottom:calc(10px + env(safe-area-inset-bottom));padding-left:calc(10px + env(safe-area-inset-left));padding-right:calc(10px + env(safe-area-inset-right))}#nchat-ftr textarea{font-size:16px}.nchat-brand{padding-bottom:calc(7px + env(safe-area-inset-bottom))}#nchat-bubble.nchat-opened-bubble{display:none !important}#nchat-tooltip,#nchat-greeting{display:none !important}#nchat-bubble{' + (isSide ? '' : (isRight ? 'right:16px;' : 'left:16px;') + 'bottom:calc(16px + env(safe-area-inset-bottom));width:54px;height:54px;') + '}}',
            '@media(hover:none){.nchat-reply-action{opacity:1;transform:scale(1)}}',
            '@media(min-width:601px) and (max-height:720px){#nchat-window{height:calc(100dvh - 104px);max-height:596px}}',
            '@media(prefers-reduced-motion:reduce){#nchat-window,#nchat-bubble,.nchat-msg{transition:none;animation:none}.nchat-skeleton{animation:none}}',
            '#nchat-window.nchat-theme-minimal{border-radius:8px;box-shadow:0 12px 30px rgba(15,23,42,.14)}',
            '#nchat-window.nchat-theme-minimal #nchat-hdr,#nchat-window.nchat-theme-minimal #nchat-ftr{border-radius:0}',
            '#nchat-window.nchat-theme-glass{background:rgba(255,255,255,.86);backdrop-filter:blur(18px);border-color:rgba(255,255,255,.55);box-shadow:0 26px 80px rgba(15,23,42,.24)}',
            '#nchat-window.nchat-theme-glass #nchat-body,#nchat-window.nchat-theme-glass #nchat-list-view{background:rgba(248,250,252,.72)}',
            '#nchat-window.nchat-theme-compact{--nchat-window-width:334px;--nchat-window-height:510px;border-radius:14px}',
            '#nchat-window.nchat-theme-compact #nchat-hdr{padding:12px 88px 12px 13px}',
            '#nchat-window.nchat-theme-compact #nchat-body{padding:12px}',
            String(cfg.customCss || '')
        ].join('\n');
        document.head.appendChild(css);

        // ── Bubble ──
        var bubble = document.createElement('button');
        bubble.id = 'nchat-bubble';

        var iconHtml = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.2L4 17.2V4h16v12z"/></svg>';
        var launcherIconSrc = safeMediaSource(launcherIcon);
        if (launcherIconSrc) {
            iconHtml = '<img src="' + launcherIconSrc + '" alt="" class="nchat-custom-img" />';
        }

        if (launcherStyle === 'tab' || launcherStyle === 'pill') {
            bubble.innerHTML = iconHtml + (launcherText ? '<span>' + escapeWidgetHtml(launcherText) + '</span>' : '');
        } else {
            bubble.innerHTML = iconHtml;
        }
        bubble.setAttribute('aria-label', 'Open chat');
        bubble.setAttribute('aria-controls', 'nchat-window');
        bubble.setAttribute('aria-expanded', 'false');
        document.body.appendChild(bubble);

        // ── Tooltip (Subiz-style card popup on hover) ──
        var tipEl = null;
        var tooltipText = cfg.tooltipText || '';
        var tipTextRaw = tooltipText || (widgetName || '');
        if (tipTextRaw) {
            tipEl = document.createElement('div');
            tipEl.id = 'nchat-tooltip';
            var tipContent = '<div class="nchat-tip-hdr">'
                + '<span class="nchat-tip-dot' + (online ? '' : ' nchat-offline-dot') + '"></span>'
                + '<span class="nchat-tip-name">' + escapeWidgetHtml(widgetName || (lang === 'vi' ? 'Hỗ trợ' : 'Support')) + '</span>'
                + '</div>';
            if (tooltipText) {
                tipContent += '<div class="nchat-tip-sub">' + escapeWidgetHtml(tooltipText) + '</div>';
            } else {
                tipContent += '<div class="nchat-tip-sub">' + (online ? (lang === 'vi' ? 'Hỗ trợ 24/7' : 'Support 24/7') : (lang === 'vi' ? 'Để lại lời nhắn' : 'Leave a message')) + '</div>';
            }
            tipEl.innerHTML = tipContent;
            document.body.appendChild(tipEl);

            function positionTooltip() {
                var rect = bubble.getBoundingClientRect();
                tipEl.style.bottom = (window.innerHeight - rect.top + 10) + 'px';
                if (isRight) {
                    tipEl.style.right = (window.innerWidth - rect.right) + 'px';
                    tipEl.style.left = 'auto';
                } else {
                    tipEl.style.left = rect.left + 'px';
                    tipEl.style.right = 'auto';
                }
            }

            bubble.addEventListener('mouseenter', function () {
                if (!win.classList.contains('nchat-open')) {
                    positionTooltip();
                    tipEl.classList.add('nchat-tip-visible');
                }
            });
            bubble.addEventListener('mouseleave', function () {
                tipEl.classList.remove('nchat-tip-visible');
            });
        }

        // ── Chat Window ──
        var placeholder = cfg.placeholder || (lang === 'vi' ? 'Nhập tin nhắn...' : 'Type a message...');
        var win = document.createElement('div');
        win.id = 'nchat-window';
        var themePreset = /^(minimal|glass|compact)$/.test(String(cfg.themePreset || '')) ? cfg.themePreset : 'modern';
        win.classList.add('nchat-theme-' + themePreset);
        win.setAttribute('role', 'dialog');
        win.setAttribute('aria-modal', 'false');
        win.setAttribute('aria-label', widgetName || 'Customer support');


        // Header (Subiz-inspired with avatar)
        var statusDot = online
            ? '<div class="nchat-online"><span class="nchat-online-dot"></span>' + (lang === 'vi' ? 'Trực tuyến' : 'Online') + '</div>'
            : '<div class="nchat-online"><span class="nchat-offline-dot"></span>' + (lang === 'vi' ? 'Ngoại tuyến' : 'Offline') + '</div>';
        
        var backIcon = '<svg viewBox="0 0 24 24"><path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/></svg>';
        var headerAvatarSrc = safeMediaSource(cfg.headerAvatar);
        var avatarHtml = headerAvatarSrc
            ? '<img src="' + headerAvatarSrc + '" alt="" />'
            : '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.2L4 17.2V4h16v12z"/></svg>';
        var closeIcon = '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>';
        var minimizeIcon = '<svg viewBox="0 0 24 24"><path d="M5 11h14v2H5z"/></svg>';
        var maximizeIcon = '<svg viewBox="0 0 24 24"><path d="M5 5h14v14H5V5zm2 2v10h10V7H7z"/></svg>';
        var restoreIcon = '<svg viewBox="0 0 24 24"><path d="M7 7V4h13v13h-3V7H7zm-3 0h13v13H4V7zm2 2v9h9V9H6z"/></svg>';
        var headerSubtext = online
            ? (lang === 'vi' ? 'Thường phản hồi trong vài phút' : 'Usually replies in a few minutes')
            : (lang === 'vi' ? 'Để lại lời nhắn, chúng tôi sẽ phản hồi sớm' : 'Leave a message, we\'ll get back to you');
        var hdr = '<div id="nchat-hdr">'
            + '<button type="button" id="nchat-resize-handle" aria-label="Resize chat window" title="Drag to resize; double click to reset"></button>'
            + '<div id="nchat-hdr-inner">'
            + '<button id="nchat-hdr-back" aria-label="Back">' + backIcon + '</button>'
            + '<div id="nchat-hdr-avatar">' + avatarHtml + '</div>'
            + '<div id="nchat-hdr-text">'
            + '<h4>' + escapeWidgetHtml(widgetName || (lang === 'vi' ? 'Hỗ trợ trực tuyến' : 'Live Support')) + '</h4>'
            + '<p>' + escapeWidgetHtml(headerSubtext) + '</p>'
            + statusDot
            + '</div>'
            + '</div>'
            + '<div id="nchat-hdr-actions">'
            + '<button type="button" id="nchat-hdr-minimize" aria-label="Minimize chat" title="Minimize">' + minimizeIcon + '</button>'
            + '<button type="button" id="nchat-hdr-size" aria-label="Maximize chat" aria-pressed="false" title="Maximize">' + maximizeIcon + '</button>'
            + '<button type="button" id="nchat-hdr-close" aria-label="Close chat" title="Close">' + closeIcon + '</button>'
            + '</div>'
            + '</div>';

        // ── LIST VIEW ──
        var newConvIcon = '<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
        var listViewHtml = '<div id="nchat-list-view">'
            + '<div class="nchat-list-items"></div>'
            + '<div class="nchat-list-footer"><button id="nchat-new-conv">' + (lang === 'vi' ? 'Tạo yêu cầu hỗ trợ mới' : 'Start a new request') + ' ' + newConvIcon + '</button>'
            + '<div class="nchat-list-footer-copy">' + (lang === 'vi' ? 'Tin nhắn của bạn được bảo mật' : 'Your messages are private') + '</div></div>'
            + '</div>';

        // ── CHAT VIEW ──
        var existingSession = getVisitorSession();
        var body = '<div id="nchat-chat-view">'
            + '<div id="nchat-connection-state" role="status" aria-live="polite"><span class="nchat-state-dot"></span><span class="nchat-state-copy"></span></div>'
            + '<div id="nchat-body" role="log" aria-live="polite" aria-relevant="additions text">';
        if (!online) {
            // ── OFFLINE MODE: show offline message + leave-message form ──
            var offMsg = cfg.offlineMessage || (lang === 'vi'
                ? 'Hiện tại không có nhân viên trực tuyến. Vui lòng để lại lời nhắn.'
                : 'No agents are currently online. Please leave a message.');
            body += '<div class="nchat-offline-msg">' + escapeWidgetHtml(offMsg) + '</div>';
            body += '<form id="nchat-offline-form">';
            body += '<label>' + (lang === 'vi' ? 'Tên' : 'Name') + ' <span class="nchat-req">*</span></label>';
            body += '<input type="text" name="name" placeholder="' + (lang === 'vi' ? 'Họ và tên...' : 'Your name...') + '" required />';
            body += '<label>Email <span class="nchat-req">*</span></label>';
            body += '<input type="email" name="email" placeholder="email@example.com" required />';
            body += '<label>' + (lang === 'vi' ? 'Lời nhắn' : 'Message') + ' <span class="nchat-req">*</span></label>';
            body += '<textarea name="message" rows="3" placeholder="' + (lang === 'vi' ? 'Nội dung bạn cần hỗ trợ...' : 'How can we help you...') + '" required></textarea>';
            body += '<button type="submit">' + (lang === 'vi' ? 'Gửi lời nhắn' : 'Send message') + '</button>';
            body += '</form>';
        } else if (pcf.enabled && !existingSession) {
            // First visit: show pre-chat form
            body += '<form id="nchat-pcf">';
            body += '<div class="nchat-pcf-title">' + escapeWidgetHtml(pcf.title || (lang === 'vi' ? 'Vui lòng nhập thông tin để bắt đầu' : 'Please fill in your info')) + '</div>';
            var fields = pcf.fields || [];
            var hasMarketingConsentField = fields.some(function (field) {
                return field && field.enabled && field.key === 'marketingConsent';
            });
            var marketingConsentCfg = pcf.marketingConsent || {};
            if (marketingConsentCfg.enabled === true && !hasMarketingConsentField) {
                var defaultConsentText = lang === 'vi'
                    ? 'T\u00f4i \u0111\u1ed3ng \u00fd nh\u1eadn th\u00f4ng tin ch\u0103m s\u00f3c v\u00e0 \u01b0u \u0111\u00e3i qua email. T\u00f4i c\u00f3 th\u1ec3 h\u1ee7y \u0111\u0103ng k\u00fd b\u1ea5t c\u1ee9 l\u00fac n\u00e0o.'
                    : 'I agree to receive customer-care updates and offers by email. I can unsubscribe at any time.';
                var consentText = marketingConsentCfg.text || defaultConsentText;
                body += '<label class="nchat-consent"><input type="checkbox" name="marketingConsent" value="true" data-consent-text="' + escapeWidgetHtml(consentText) + '" /><span>' + escapeWidgetHtml(consentText) + '</span></label>';
            }
            for (var i = 0; i < fields.length; i++) {
                var f = fields[i];
                if (!f.enabled) continue;
                var ph = f.placeholder || f.label + '...';
                var fieldKey = escapeWidgetHtml(f.key || 'field_' + i);
                var fieldLabel = escapeWidgetHtml(f.label || '');
                var fieldPlaceholder = escapeWidgetHtml(ph);

                if (f.type === 'checkbox') {
                    body += '<label class="nchat-consent"><input type="checkbox" name="' + fieldKey + '" value="true"' + (f.required ? ' required' : '') + ' /><span>' + fieldLabel + (f.required ? '<span class="nchat-req">*</span>' : '') + '</span></label>';
                } else if (f.type === 'textarea') {
                    body += '<label>' + fieldLabel + (f.required ? '<span class="nchat-req">*</span>' : '') + '</label>';
                    body += '<textarea name="' + fieldKey + '" placeholder="' + fieldPlaceholder + '"' + (f.required ? ' required' : '') + ' rows="3"></textarea>';
                } else if (f.type === 'select' && f.options && f.options.length) {
                    body += '<label>' + fieldLabel + (f.required ? '<span class="nchat-req">*</span>' : '') + '</label>';
                    body += '<select name="' + fieldKey + '"' + (f.required ? ' required' : '') + '>';
                    body += '<option value="">' + (lang === 'vi' ? 'Chọn ' : 'Select ') + escapeWidgetHtml(String(f.label || '').toLowerCase()) + '</option>';
                    for (var j = 0; j < f.options.length; j++) {
                        var fieldOption = escapeWidgetHtml(f.options[j]);
                        body += '<option value="' + fieldOption + '">' + fieldOption + '</option>';
                    }
                    body += '</select>';
                } else {
                    body += '<label>' + fieldLabel + (f.required ? '<span class="nchat-req">*</span>' : '') + '</label>';
                    var fieldType = /^(text|email|tel)$/.test(f.type || '') ? f.type : 'text';
                    body += '<input type="' + fieldType + '" name="' + fieldKey + '" placeholder="' + fieldPlaceholder + '"' + (f.required ? ' required' : '') + ' />';
                }
            }
            body += '<button type="submit">' + (lang === 'vi' ? 'Bắt đầu chat' : 'Start chat') + '</button>';
            body += '</form>';
        } else if (existingSession) {
            // Returning visitor: restore session, skip form
            var vName = (existingSession && existingSession.info && existingSession.info.name) || (lang === 'vi' ? 'bạn' : 'you');
            window.__nchat_visitor = existingSession.info;
            window.__nchat_visitor_id = vid;
            body += '<div class="nchat-msg nchat-msg-bot"><div class="nchat-msg-bubble">'
                + (lang === 'vi'
                    ? 'Chào mừng <strong>' + escapeWidgetHtml(vName) + '</strong> quay lại! Bạn cần hỗ trợ gì?'
                    : 'Welcome back <strong>' + escapeWidgetHtml(vName) + '</strong>! How can we help?')
                + '</div></div>';
        } else {
            // No pre-chat form: show Subiz-style empty state illustration
            var emptyStateText = lang === 'vi' ? 'Gửi một tin nhắn để bắt đầu hội thoại!' : 'Send a message to start conversation!';
            var emptyTitleText = lang === 'vi' ? 'Chúng tôi sẵn sàng hỗ trợ' : 'We are ready to help';
            var emptyTrustText = lang === 'vi' ? 'Phản hồi nhanh &nbsp;•&nbsp; Hội thoại bảo mật' : 'Fast response &nbsp;•&nbsp; Private conversation';
            body += '<div class="nchat-empty-state">'
                + '<svg viewBox="0 0 200 180" xmlns="http://www.w3.org/2000/svg">'
                + '<circle cx="115" cy="65" r="50" fill="none" stroke="' + color + '" stroke-width="3"/>'
                + '<circle cx="130" cy="55" r="5" fill="' + color + '"/>'
                + '<circle cx="115" cy="55" r="5" fill="' + color + '"/>'
                + '<path d="M105 72 Q115 82 125 72" fill="none" stroke="' + color + '" stroke-width="3" stroke-linecap="round"/>'
                + '<circle cx="75" cy="110" r="35" fill="none" stroke="' + color + '" stroke-width="3"/>'
                + '<circle cx="65" cy="110" r="3.5" fill="' + color + '"/>'
                + '<circle cx="75" cy="110" r="3.5" fill="' + color + '"/>'
                + '<circle cx="85" cy="110" r="3.5" fill="' + color + '"/>'
                + '</svg>'
                + '<div class="nchat-empty-title">' + emptyTitleText + '</div>'
                + '<div class="nchat-empty-text">' + emptyStateText + '</div>'
                + '<div class="nchat-empty-trust">' + emptyTrustText + '</div>'
                + '</div>';
        }
        body += '</div>';

        // Footer with emoji, upload, input, send (Subiz-style)
        var emojiIcon = '<svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>';
        var attachIcon = '<svg viewBox="0 0 24 24"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/></svg>';
        var sendIcon = '<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
        var replyIcon = '<svg viewBox="0 0 24 24"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>';
        var emojiCodeGroups = ['1F600','1F603','1F604','1F601','1F606','1F602','1F60A','1F60D','1F970','1F618','1F609','1F60E','1F914','1F62E','1F622','1F62D','1F621','1F44D','1F44F','1F64F','1F389','1F525','2764,FE0F','1F4AF'];
        var emojiPickerHtml = '';
        for (var emojiIndex = 0; emojiIndex < emojiCodeGroups.length; emojiIndex++) {
            var emojiValue = String.fromCodePoint.apply(String, emojiCodeGroups[emojiIndex].split(',').map(function (code) { return parseInt(code, 16); }));
            emojiPickerHtml += '<button type="button" data-emoji-code="' + emojiCodeGroups[emojiIndex] + '" aria-label="Emoji ' + (emojiIndex + 1) + '">' + emojiValue + '</button>';
        }
        var replyLabel = lang === 'vi' ? 'Tr\u1ea3 l\u1eddi tin nh\u1eafn' : 'Replying to message';
        var cancelReplyLabel = lang === 'vi' ? 'H\u1ee7y tr\u1ea3 l\u1eddi' : 'Cancel reply';
        var ftr = '<div id="nchat-reply-preview" role="status" aria-live="polite">'
            + '<div id="nchat-reply-preview-copy"><strong>' + replyLabel + '</strong><span></span></div>'
            + '<button type="button" id="nchat-reply-cancel" aria-label="' + cancelReplyLabel + '" title="' + cancelReplyLabel + '">' + closeIcon + '</button></div>'
            + '<div id="nchat-emoji-picker" role="group" aria-label="Emoji picker">' + emojiPickerHtml + '</div>'
            + '<div id="nchat-ftr">'
            + '<button type="button" id="nchat-emoji-btn" aria-label="Emoji" aria-expanded="false" aria-controls="nchat-emoji-picker">' + emojiIcon + '</button>'
            + '<label id="nchat-upload-btn" aria-label="Upload">' + attachIcon + '<input type="file" id="nchat-file-input" accept="image/*,.pdf,.doc,.docx" style="display:none" /></label>'
            + '<textarea id="nchat-input" maxlength="4000" autocomplete="off" enterkeyhint="send" rows="1" placeholder="' + escapeWidgetHtml(placeholder) + '"></textarea>'
            + '<button id="nchat-send" aria-label="Send" disabled>' + sendIcon + '</button>'
            + '</div></div>'; // end nchat-chat-view

        // Branding (Subiz-style with icon)
        var brandIcon = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>';
        var brandingName = escapeWidgetHtml(cfg.brandingName || 'NemarkChat');
        var brandingUrl = safeExternalLink(cfg.brandingUrl || 'https://nemarkchat.com');
        var brandLabel = brandingUrl
            ? '<a href="' + brandingUrl + '" target="_blank" rel="noopener noreferrer">' + brandingName + '</a>'
            : '<span>' + brandingName + '</span>';
        var brand = cfg.showBranding !== false
            ? '<div class="nchat-brand">' + brandIcon + ' ' + brandLabel + '</div>'
            : '';

        win.innerHTML = hdr + listViewHtml + body + ftr + brand;
        if (pcf.enabled && !existingSession) win.classList.add('nchat-awaiting-profile');
        document.body.appendChild(win);

        // ── Open / Close flow ──
        var STATE_KEY = 'nchat_ui_state';
        var WINDOW_MODE_KEY = 'nchat_window_mode';
        var hasOpenedOnce = false;

        // Restore previous open/close state from sessionStorage (survives reload, cleared on tab close)
        var savedState = null;
        try { savedState = sessionStorage.getItem(STATE_KEY); } catch (e) { }
        var isOpen = savedState === 'open';
        var savedWindowMode = null;
        try { savedWindowMode = sessionStorage.getItem(WINDOW_MODE_KEY); } catch (e) { }
        var _windowMode = /^(normal|maximized|minimized)$/.test(savedWindowMode || '') ? savedWindowMode : 'normal';
        var WINDOW_SIZE_KEY = 'nchat_window_size_' + id;
        var _windowSize = { width: 372, height: 580 };

        function constrainWindowSize(width, height) {
            var maxWidth = Math.max(340, Math.min(720, window.innerWidth - 32));
            var maxHeight = Math.max(360, window.innerHeight - 104);
            var minWidth = Math.min(340, maxWidth);
            var minHeight = Math.min(420, maxHeight);
            return {
                width: Math.round(Math.max(minWidth, Math.min(maxWidth, Number(width) || 372))),
                height: Math.round(Math.max(minHeight, Math.min(maxHeight, Number(height) || 580)))
            };
        }

        function applyWindowSize(width, height, persist) {
            _windowSize = constrainWindowSize(width, height);
            win.style.setProperty('--nchat-window-width', _windowSize.width + 'px');
            win.style.setProperty('--nchat-window-height', _windowSize.height + 'px');
            if (persist) {
                try { localStorage.setItem(WINDOW_SIZE_KEY, JSON.stringify(_windowSize)); } catch (e) { }
                emitEvent('nchat:resized', { widgetId: id, width: _windowSize.width, height: _windowSize.height });
            }
        }

        try {
            var savedWindowSize = JSON.parse(localStorage.getItem(WINDOW_SIZE_KEY) || 'null');
            if (savedWindowSize && savedWindowSize.width && savedWindowSize.height) {
                _windowSize = constrainWindowSize(savedWindowSize.width, savedWindowSize.height);
            }
        } catch (e) { }
        applyWindowSize(_windowSize.width, _windowSize.height, false);

        var resizeHandle = win.querySelector('#nchat-resize-handle');
        var activeResizeCleanup = null;
        function beginWindowResize(event) {
            if (_windowMode !== 'normal' || (window.matchMedia && window.matchMedia('(max-width: 600px)').matches)) return;
            event.preventDefault();
            var startX = event.clientX;
            var startY = event.clientY;
            var startWidth = _windowSize.width;
            var startHeight = _windowSize.height;
            win.classList.add('nchat-resizing');
            if (resizeHandle.setPointerCapture) resizeHandle.setPointerCapture(event.pointerId);

            function moveWindowResize(moveEvent) {
                var deltaX = moveEvent.clientX - startX;
                var deltaY = moveEvent.clientY - startY;
                var nextWidth = startWidth + (isRight ? -deltaX : deltaX);
                var nextHeight = startHeight - deltaY;
                applyWindowSize(nextWidth, nextHeight, false);
            }
            function endWindowResize() {
                win.classList.remove('nchat-resizing');
                document.removeEventListener('pointermove', moveWindowResize);
                document.removeEventListener('pointerup', endWindowResize);
                document.removeEventListener('pointercancel', endWindowResize);
                activeResizeCleanup = null;
                applyWindowSize(_windowSize.width, _windowSize.height, true);
            }
            activeResizeCleanup = endWindowResize;
            document.addEventListener('pointermove', moveWindowResize);
            document.addEventListener('pointerup', endWindowResize);
            document.addEventListener('pointercancel', endWindowResize);
        }
        if (resizeHandle) {
            resizeHandle.addEventListener('pointerdown', beginWindowResize);
            resizeHandle.addEventListener('dblclick', function () {
                try { localStorage.removeItem(WINDOW_SIZE_KEY); } catch (e) { }
                applyWindowSize(372, 580, true);
            });
            resizeHandle.addEventListener('keydown', function (event) {
                var step = event.shiftKey ? 40 : 16;
                var nextWidth = _windowSize.width;
                var nextHeight = _windowSize.height;
                if (event.key === 'ArrowLeft') nextWidth += isRight ? step : -step;
                else if (event.key === 'ArrowRight') nextWidth += isRight ? -step : step;
                else if (event.key === 'ArrowUp') nextHeight += step;
                else if (event.key === 'ArrowDown') nextHeight -= step;
                else return;
                event.preventDefault();
                applyWindowSize(nextWidth, nextHeight, true);
            });
        }
        function handleWidgetViewportResize() {
            applyWindowSize(_windowSize.width, _windowSize.height, false);
        }
        window.addEventListener('resize', handleWidgetViewportResize);
        _globalCleanup.push(function () {
            window.removeEventListener('resize', handleWidgetViewportResize);
            if (activeResizeCleanup) activeResizeCleanup();
        });

        function setWindowMode(mode, focusControl) {
            var nextMode = /^(normal|maximized|minimized)$/.test(mode || '') ? mode : 'normal';
            _windowMode = nextMode;
            win.classList.toggle('nchat-maximized', nextMode === 'maximized');
            win.classList.toggle('nchat-minimized', nextMode === 'minimized');
            win.setAttribute('data-window-mode', nextMode);
            try { sessionStorage.setItem(WINDOW_MODE_KEY, nextMode); } catch (e) { }

            var minimizeButton = win.querySelector('#nchat-hdr-minimize');
            var sizeButton = win.querySelector('#nchat-hdr-size');
            var isMinimized = nextMode === 'minimized';
            var isMaximized = nextMode === 'maximized';
            var minimizeLabel = isMinimized
                ? (lang === 'vi' ? 'Kh\u00f4i ph\u1ee5c c\u1eeda s\u1ed5 chat' : 'Restore chat window')
                : (lang === 'vi' ? 'Thu nh\u1ecf c\u1eeda s\u1ed5 chat' : 'Minimize chat window');
            var sizeLabel = isMaximized
                ? (lang === 'vi' ? 'Kh\u00f4i ph\u1ee5c k\u00edch th\u01b0\u1edbc' : 'Restore window size')
                : (lang === 'vi' ? 'Ph\u00f3ng to c\u1eeda s\u1ed5 chat' : 'Maximize chat window');
            if (minimizeButton) {
                minimizeButton.innerHTML = isMinimized ? restoreIcon : minimizeIcon;
                minimizeButton.setAttribute('aria-label', minimizeLabel);
                minimizeButton.title = minimizeLabel;
            }
            if (sizeButton) {
                sizeButton.innerHTML = isMaximized ? restoreIcon : maximizeIcon;
                sizeButton.setAttribute('aria-label', sizeLabel);
                sizeButton.setAttribute('aria-pressed', isMaximized ? 'true' : 'false');
                sizeButton.title = sizeLabel;
            }
            emitEvent('nchat:window_mode', { widgetId: id, mode: nextMode });
            if (focusControl === true) {
                setTimeout(function () {
                    var control = isMinimized ? minimizeButton : (isMaximized ? sizeButton : win.querySelector('#nchat-input'));
                    if (control && control.focus) control.focus();
                }, 40);
            }
        }

        setWindowMode(_windowMode, false);

        // ── Widget Notification Helpers ──
        var originalTitle = document.title;
        var unreadCount = 0;
        var __audioCtx = null;
        
        function playWidgetSound() {
            try {
                if (!__audioCtx) __audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                if (__audioCtx.state === 'suspended') __audioCtx.resume();
                
                var playTone = function(freq, startTime, duration) {
                    var osc = __audioCtx.createOscillator();
                    var gain = __audioCtx.createGain();
                    osc.connect(gain);
                    gain.connect(__audioCtx.destination);
                    osc.type = 'sine';
                    osc.frequency.value = freq;
                    gain.gain.setValueAtTime(0, startTime);
                    gain.gain.linearRampToValueAtTime(0.2, startTime + 0.05);
                    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
                    osc.start(startTime);
                    osc.stop(startTime + duration);
                };
                playTone(600, __audioCtx.currentTime, 0.15);
                playTone(800, __audioCtx.currentTime + 0.1, 0.25);
            } catch(e) {}
        }

        function notifyNewMessage() {
            if (!isOpen || _windowMode === 'minimized' || document.hidden) {
                unreadCount++;
                document.title = '(' + unreadCount + ') ' + (lang === 'vi' ? 'Bạn có tin nhắn mới!' : 'New message!');
                playWidgetSound();
                
                if (!isOpen) {
                    var b = document.getElementById('nchat-bubble');
                    if (b && !b.querySelector('.nchat-badge')) {
                        b.innerHTML += '<div class="nchat-badge" style="position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;font-size:11px;font-weight:bold;width:20px;height:20px;border-radius:10px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 4px rgba(0,0,0,0.2)">1</div>';
                    } else if (b) {
                        var badge = b.querySelector('.nchat-badge');
                        if (badge) badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
                    }
                }
            }
        }

        function clearUnreadNotifications() {
            if (unreadCount > 0) {
                unreadCount = 0;
                document.title = originalTitle;
                var badge = document.querySelector('#nchat-bubble .nchat-badge');
                if (badge) badge.remove();
            }
        }

        function handleWidgetWindowFocus() {
            if (isOpen) clearUnreadNotifications();
        }
        window.addEventListener('focus', handleWidgetWindowFocus);
        _globalCleanup.push(function () { window.removeEventListener('focus', handleWidgetWindowFocus); });

        function emitEvent(name, detail) {
            try {
                window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
            } catch (e) { /* IE fallback: ignore */ }
        }

        // Save original launcher HTML to restore when closing
        var _originalBubbleHtml = bubble.innerHTML;

        function toggleChat(open) {
            var newState = typeof open === 'boolean' ? open : !isOpen;
            if (newState === isOpen) return; // no-op
            isOpen = newState;

            // Persist UI state across reload (sessionStorage = same tab only)
            try { sessionStorage.setItem(STATE_KEY, isOpen ? 'open' : 'closed'); } catch (e) { }

            // Update UI
            win.classList.toggle('nchat-open', isOpen);
            win.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
            bubble.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            if (isOpen) {
                bubble.classList.add('nchat-opened-bubble');
                bubble.innerHTML = '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
            } else {
                bubble.classList.remove('nchat-opened-bubble');
                bubble.innerHTML = _originalBubbleHtml;
            }

            // Hide tooltip when chat is open
            if (tipEl) {
                if (isOpen) tipEl.classList.remove('nchat-tip-visible');
            }

            if (isOpen) {
                clearUnreadNotifications();
                // ── OPEN ──
                emitEvent('nchat:opened', { widgetId: id, visitorId: vid, firstOpen: !hasOpenedOnce });


                // Re-join conversation room
                if (_socket && _socket.connected && isValidConversationId(_conversationId)) {
                    _socket.emit('join:conversation', { conversationId: _conversationId });
                }

                // Auto-evaluate view: if has conversations, show list. Else show chat.
                loadConversationList().then(function (hasConversations) {
                    if (hasConversations) {
                        switchView('list', { skipLoad: true });
                    } else {
                        switchView('chat');
                    }
                }).catch(function () {
                    switchView('chat');
                });

                if (!hasOpenedOnce) {
                    hasOpenedOnce = true;
                    // First open: trigger greeting animation (scroll body to top)
                    var bodyEl = win.querySelector('#nchat-body');
                    if (bodyEl) bodyEl.scrollTop = 0;
                }

                // Auto-focus input (or first form field)
                setTimeout(function () {
                    if (window.matchMedia && window.matchMedia('(max-width: 600px)').matches) return;
                    var pcfInput = win.querySelector('#nchat-pcf input');
                    var chatInput = win.querySelector('#nchat-input');
                    if (pcfInput) pcfInput.focus();
                    else if (chatInput) chatInput.focus();
                }, 300); // wait for CSS transition

            } else {
                // ── CLOSE ──
                // Leave conversation room to stop receiving events
                if (_socket && _socket.connected && isValidConversationId(_conversationId)) {
                    _socket.emit('leave:conversation', { conversationId: _conversationId });
                }
                emitEvent('nchat:closed', { widgetId: id, visitorId: vid });
                closeEmojiPicker(false);
                setTimeout(function () { if (bubble && bubble.focus) bubble.focus(); }, 40);
            }
        }

        // ── View Switching ──
        function switchView(view, options) {
            var opts = options || {};
            if (view === 'list') {
                closeEmojiPicker(false);
                clearReplyContext(false);
                win.classList.remove('show-chat');
                win.classList.add('show-list');
                // load list when entering list view unless caller already loaded
                if (!opts.skipLoad) loadConversationList();
            } else {
                win.classList.remove('show-list');
                win.classList.add('show-chat');
                // if we have items, add has-list to show back button
                if (win.querySelector('.nchat-list-items').querySelector('.nchat-list-item')) {
                    win.classList.add('has-list');
                } else {
                    win.classList.remove('has-list');
                }
            }
        }

        win.querySelector('#nchat-hdr-back').addEventListener('click', function() {
            switchView('list');
        });

        win.querySelector('#nchat-new-conv').addEventListener('click', function() {
            startNewConversation();
        });

        function startNewConversation() {
            closeEmojiPicker(false);
            clearReplyContext(false);
            var bodyEl = win.querySelector('#nchat-body');
            if (_socket && _socket.connected && isValidConversationId(_conversationId)) {
                _socket.emit('leave:conversation', { conversationId: _conversationId });
            }
            bodyEl.innerHTML = '<div class="nchat-msg nchat-msg-bot"><div class="nchat-msg-bubble">' + escapeWidgetHtml(greeting) + '</div></div>';
            _conversationId = null;
            _conversationInitPromise = null;
            _forceNewConversationOnNextSend = true;
            _hasMoreMsgs = false;
            _msgPage = 1;
            try { localStorage.removeItem(CONV_KEY); } catch (e) { }
            switchView('chat');
            // Delay creating the record until the visitor actually sends. This
            // keeps the history free of duplicate, empty conversations.
            var freshInput = win.querySelector('#nchat-input');
            if (freshInput && (!window.matchMedia || !window.matchMedia('(max-width: 600px)').matches)) {
                freshInput.focus();
            }
        }

        function formatConversationListTime(value) {
            var date = new Date(value);
            if (!value || Number.isNaN(date.getTime())) return '';
            var now = new Date();
            var sameDay = date.getFullYear() === now.getFullYear()
                && date.getMonth() === now.getMonth()
                && date.getDate() === now.getDate();
            if (sameDay) {
                return date.toLocaleTimeString(lang === 'vi' ? 'vi-VN' : undefined, { hour: '2-digit', minute: '2-digit' });
            }
            return date.toLocaleDateString(lang === 'vi' ? 'vi-VN' : undefined, { day: '2-digit', month: '2-digit' });
        }

        function loadConversationList() {
            var listContainer = win.querySelector('.nchat-list-items');
            if (listContainer) {
                listContainer.innerHTML = '<div class="nchat-skeleton"></div><div class="nchat-skeleton"></div><div class="nchat-skeleton"></div>';
            }
            return fetch(base + '/api/conversations/public/visitor/' + vid + '/widget/' + id)
                .then(function(r) {
                    if (!r.ok) throw new Error('HTTP ' + r.status);
                    return r.json();
                })
                .then(function(res) {
                    if (res.success && res.data && res.data.length > 0) {
                        var supportName = widgetName || (lang === 'vi' ? 'Hỗ trợ CSKH' : 'Support');
                        var initial = String(supportName || 'N').trim().charAt(0).toUpperCase() || 'N';
                        var listHtml = '<div class="nchat-list-intro">'
                            + '<div class="nchat-list-intro-title">' + (lang === 'vi' ? 'Các cuộc trò chuyện của bạn' : 'Your conversations') + '</div>'
                            + '<div class="nchat-list-intro-text">' + (lang === 'vi' ? 'Tiếp tục hội thoại cũ hoặc bắt đầu một yêu cầu hỗ trợ mới.' : 'Continue a previous chat or start a new support request.') + '</div>'
                            + '</div>';
                        var convs = res.data.filter(function (record) {
                            return record && (record.lastMessageSnippet || record.lastMessageAt);
                        });
                        var validConversationCount = 0;
                        for (var i = 0; i < convs.length; i++) {
                            var c = convs[i];
                            var conversationId = getRecordId(c);
                            if (!isValidConversationId(conversationId)) continue;
                            validConversationCount += 1;
                            var dateStr = formatConversationListTime(c.lastMessageAt || c.updatedAt);
                            var snippet = c.lastMessageSnippet || '';
                            var isClosed = c.status === 'closed' || c.status === 'resolved';
                            var statusText = isClosed
                                ? (lang === 'vi' ? 'Đã đóng' : 'Closed')
                                : (lang === 'vi' ? 'Đang mở' : 'Open');
                            listHtml += '<button type="button" class="nchat-list-item" data-id="' + escapeWidgetHtml(conversationId) + '">'
                                + '<div class="nchat-list-avatar">' + initial + '</div>'
                                + '<div class="nchat-list-info">'
                                + '<div class="nchat-list-name">' + escapeWidgetHtml(supportName) + '</div>'
                                + '<div class="nchat-list-msg">' + escapeWidgetHtml(snippet) + '</div>'
                                + '</div><div class="nchat-list-meta"><div class="nchat-list-time">' + escapeWidgetHtml(dateStr) + '</div>'
                                + '<div class="nchat-list-status' + (isClosed ? ' nchat-list-status-closed' : '') + '">' + statusText + '</div></div>'
                                + '<div class="nchat-list-arrow"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M9.29 15.88L13.17 12 9.29 8.12c-.39-.39-.39-1.02 0-1.41.39-.39 1.02-.39 1.41 0l4.59 4.59c.39.39.39 1.02 0 1.41L10.7 17.3c-.39.39-1.02.39-1.41 0-.38-.39-.39-1.03 0-1.42z"/></svg></div>'
                                + '</button>';
                        }
                        if (validConversationCount === 0) {
                            win.querySelector('.nchat-list-items').innerHTML = '<div class="nchat-list-state"><strong>' + (lang === 'vi' ? 'Bắt đầu cuộc trò chuyện' : 'Start a conversation') + '</strong>' + (lang === 'vi' ? 'Gửi tin nhắn đầu tiên để đội ngũ hỗ trợ có thể giúp bạn.' : 'Send your first message so our team can help.') + '</div>';
                            win.classList.remove('has-list');
                            return false;
                        }
                        var listContainer = win.querySelector('.nchat-list-items');
                        listContainer.innerHTML = listHtml;
                        win.classList.add('has-list');

                        // Bind clicks
                        var items = listContainer.querySelectorAll('.nchat-list-item');
                        for (var j = 0; j < items.length; j++) {
                            items[j].addEventListener('click', function(e) {
                                var convId = e.currentTarget.getAttribute('data-id');
                                openConversation(convId);
                            });
                        }
                        return true;
                    }

                    win.querySelector('.nchat-list-items').innerHTML = '<div class="nchat-list-state"><strong>' + (lang === 'vi' ? 'Bắt đầu cuộc trò chuyện' : 'Start a conversation') + '</strong>' + (lang === 'vi' ? 'Bạn chưa có hội thoại nào với đội ngũ hỗ trợ.' : 'You have no support conversations yet.') + '</div>';
                    win.classList.remove('has-list');
                    return false;
                })
                .catch(function() {
                    var listItems = win.querySelector('.nchat-list-items');
                    listItems.innerHTML = '<div class="nchat-list-state"><strong>' + (lang === 'vi' ? 'Chưa tải được hội thoại' : 'Conversations unavailable') + '</strong>' + (lang === 'vi' ? 'Kiểm tra kết nối và thử lại.' : 'Check your connection and try again.') + '<br><button type="button" class="nchat-list-retry">' + (lang === 'vi' ? 'Thử lại' : 'Retry') + '</button></div>';
                    var retry = listItems.querySelector('.nchat-list-retry');
                    if (retry) retry.addEventListener('click', loadConversationList);
                    win.classList.remove('has-list');
                    return false;
                });
        }

        function openConversation(convId) {
            if (!isValidConversationId(convId)) {
                console.warn('[NemarkChat] Refused to open an invalid conversation id');
                return;
            }
            _conversationId = getRecordId(convId);
            closeEmojiPicker(false);
            clearReplyContext(false);
            try { localStorage.setItem(CONV_KEY, _conversationId); } catch(e){}
            if (_socket && _socket.connected && isValidConversationId(_conversationId)) {
                _socket.emit('join:conversation', { conversationId: _conversationId });
            }
            // Clear body and fetch history
            var bodyEl = win.querySelector('#nchat-body');
            bodyEl.innerHTML = '<div style="padding:20px;text-align:center;color:#999;font-size:13px">...</div>';
            switchView('chat');
            
            _msgPage = 1;
            var historyUrl = conversationUrl(base, _conversationId, '/messages?page=1&limit=30&visitorId=' + encodeURIComponent(vid));
            if (!historyUrl) return;
            fetch(historyUrl)
                .then(function(r) {
                    if (!r.ok) throw new Error('HTTP ' + r.status);
                    return r.json();
                })
                .then(function(res) {
                    bodyEl.innerHTML = '';
                    if (res.success && res.data) {
                        var msgs = res.data.items || [];
                        var totalMsgs = res.data.total || 0;
                        _hasMoreMsgs = (_msgPage * 30) < totalMsgs;
                        if (msgs.length > 0) renderMessages(msgs);
                        if (_hasMoreMsgs) renderLoadOlderButton();
                    } else {
                        bodyEl.innerHTML = '<div class="nchat-msg nchat-msg-bot"><div class="nchat-msg-bubble">' + escapeWidgetHtml(greeting) + '</div></div>';
                    }
                }).catch(function(){
                    bodyEl.innerHTML = '<div class="nchat-list-state"><strong>' + (lang === 'vi' ? 'Chưa tải được tin nhắn' : 'Messages unavailable') + '</strong>' + (lang === 'vi' ? 'Vui lòng quay lại và thử lại.' : 'Please go back and try again.') + '</div>';
                });
        }

        // Apply restored state (render correct icon & class without animation)
        if (isOpen) {
            win.classList.add('nchat-open');
            win.setAttribute('aria-hidden', 'false');
            bubble.setAttribute('aria-expanded', 'true');
            bubble.classList.add('nchat-opened-bubble');
            bubble.innerHTML = '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
            hasOpenedOnce = true;
            switchView('chat'); // default to chat, or load list to decide later
            loadConversationList();
        } else {
            win.setAttribute('aria-hidden', 'true');
            switchView('chat'); // default hidden state
        }

        // Keep the initial handler reference so the greeting wrapper below can
        // replace it without leaving two toggle handlers on the launcher.
        bubble.__nchatClick = function () { toggleChat(); };
        bubble.addEventListener('click', bubble.__nchatClick);
        win.querySelector('#nchat-hdr-close').addEventListener('click', function (event) {
            event.stopPropagation();
            toggleChat(false);
        });
        win.querySelector('#nchat-hdr-minimize').addEventListener('click', function (event) {
            event.stopPropagation();
            setWindowMode(_windowMode === 'minimized' ? 'normal' : 'minimized', true);
        });
        win.querySelector('#nchat-hdr-size').addEventListener('click', function (event) {
            event.stopPropagation();
            setWindowMode(_windowMode === 'maximized' ? 'normal' : 'maximized', true);
        });
        win.querySelector('#nchat-hdr').addEventListener('click', function (event) {
            if (_windowMode !== 'minimized') return;
            if (event.target && event.target.closest && event.target.closest('button')) return;
            setWindowMode('normal', true);
        });

        // ESC key closes widget
        function handleWidgetEscape(e) {
            if (e.key !== 'Escape' || !isOpen) return;
            var picker = win.querySelector('#nchat-emoji-picker');
            if (picker && picker.classList.contains('nchat-picker-open')) {
                e.preventDefault();
                closeEmojiPicker(true);
                return;
            }
            if (_replyContext) {
                e.preventDefault();
                clearReplyContext(true);
                return;
            }
            if (_windowMode !== 'normal') {
                e.preventDefault();
                setWindowMode('normal', true);
                return;
            }
            toggleChat(false);
        }
        document.addEventListener('keydown', handleWidgetEscape);
        _globalCleanup.push(function () { document.removeEventListener('keydown', handleWidgetEscape); });

        // ── Greeting Popup Card (Subiz-style floating notification) ──
        var greetingCfg = cfg.greetingPopup || {};
        var greetingDismissed = false;
        var greetingEl = null;
        var GREETING_DISMISS_KEY = 'nchat_greeting_dismissed_' + id;

        try { greetingDismissed = sessionStorage.getItem(GREETING_DISMISS_KEY) === '1'; } catch (e) { }

        if (greetingCfg.enabled !== false && !greetingDismissed && !isOpen) {
            greetingEl = document.createElement('div');
            greetingEl.id = 'nchat-greeting';
            var greetAvatar = headerAvatarSrc
                ? '<img src="' + headerAvatarSrc + '" alt="" />'
                : '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>';
            var closeIcon = '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
            var greetMsg = greetingCfg.message || greeting;
            var greetCta = greetingCfg.ctaText || (lang === 'vi' ? 'Gửi tin nhắn' : 'Send a message');
            greetingEl.innerHTML = '<button id="nchat-greeting-close" aria-label="Close">' + closeIcon + '</button>'
                + '<div id="nchat-greeting-inner">'
                + '<div id="nchat-greeting-avatar">' + greetAvatar + '</div>'
                + '<div id="nchat-greeting-text">'
                + '<div class="nchat-greeting-name">' + escapeWidgetHtml(widgetName || (lang === 'vi' ? 'Hỗ trợ' : 'Support')) + '</div>'
                + '<div class="nchat-greeting-msg">' + escapeWidgetHtml(greetMsg) + '</div>'
                + '</div>'
                + '</div>'
                + '<a id="nchat-greeting-cta">' + escapeWidgetHtml(greetCta) + '</a>';
            document.body.appendChild(greetingEl);

            // Show after delay
            var greetDelay = (greetingCfg.delay || 3) * 1000;
            setTimeout(function () {
                if (!isOpen && greetingEl && !greetingDismissed) {
                    greetingEl.classList.add('nchat-greeting-show');
                }
            }, greetDelay);

            // Click CTA → open widget
            greetingEl.querySelector('#nchat-greeting-cta').addEventListener('click', function () {
                greetingEl.classList.remove('nchat-greeting-show');
                toggleChat(true);
            });

            // Close button
            greetingEl.querySelector('#nchat-greeting-close').addEventListener('click', function (e) {
                e.stopPropagation();
                greetingEl.classList.remove('nchat-greeting-show');
                greetingDismissed = true;
                try { sessionStorage.setItem(GREETING_DISMISS_KEY, '1'); } catch (e2) { }
            });
        }

        // Hide greeting when widget opens
        var _origToggle = toggleChat;
        toggleChat = function (open) {
            _origToggle(open);
            if (greetingEl && isOpen) {
                greetingEl.classList.remove('nchat-greeting-show');
            }
        };
        // Re-bind bubble click with wrapped toggle
        bubble.removeEventListener('click', bubble.__nchatClick);
        bubble.__nchatClick = function () { toggleChat(); };
        bubble.addEventListener('click', bubble.__nchatClick);

        // ── Auto-open Timer ──
        var autoOpenCfg = cfg.autoOpen || {};
        var AUTO_OPEN_KEY = 'nchat_auto_opened_' + id;
        var alreadyAutoOpened = false;
        try { alreadyAutoOpened = sessionStorage.getItem(AUTO_OPEN_KEY) === '1'; } catch (e) { }

        if (autoOpenCfg.mode && autoOpenCfg.mode !== 'none' && !alreadyAutoOpened && !isOpen) {
            var autoDelay = 0;
            if (autoOpenCfg.mode === 'immediate') autoDelay = 500;
            else if (autoOpenCfg.mode === '20s') autoDelay = 20000;
            else if (autoOpenCfg.mode === '5min') autoDelay = 300000;
            else if (autoOpenCfg.mode === 'custom') autoDelay = (autoOpenCfg.customSeconds || 0) * 1000;

            if (autoDelay >= 0) {
                setTimeout(function () {
                    if (!isOpen) {
                        toggleChat(true);
                        try { sessionStorage.setItem(AUTO_OPEN_KEY, '1'); } catch (e) { }
                    }
                }, autoDelay);
            }
        }

        // ── Pre-chat form validation + submit ──
        var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
        var PHONE_RE = /^[+]?[\d\s\-().]{7,20}$/;
        var MIN_LEN = 2;
        var MAX_LEN = 200;

        function clearFieldError(el) {
            el.classList.remove('nchat-invalid');
            var next = el.nextElementSibling;
            if (next && next.classList.contains('nchat-pcf-err')) next.remove();
        }

        function setFieldError(el, msg) {
            el.classList.add('nchat-invalid');
            // Remove existing error for this field first
            var next = el.nextElementSibling;
            if (next && next.classList.contains('nchat-pcf-err')) next.remove();
            var errDiv = document.createElement('div');
            errDiv.className = 'nchat-pcf-err';
            errDiv.textContent = msg;
            el.parentNode.insertBefore(errDiv, el.nextSibling);
        }

        function validateFields(formEl, fieldsCfg) {
            var valid = true;
            var fields = fieldsCfg || [];
            for (var i = 0; i < fields.length; i++) {
                var f = fields[i];
                if (!f.enabled) continue;
                var el = formEl.querySelector('[name="' + f.key + '"]');
                if (!el) continue;
                var val = el.type === 'checkbox' ? (el.checked ? 'true' : '') : (el.value || '').trim();

                clearFieldError(el);

                // Required check
                if (f.required && !val) {
                    setFieldError(el, (lang === 'vi' ? 'Vui lòng nhập ' : 'Please enter ') + f.label.toLowerCase());
                    valid = false;
                    continue;
                }

                if (!val) continue; // optional and empty → ok

                // Min length
                if (val.length < MIN_LEN) {
                    setFieldError(el, (lang === 'vi' ? 'Tối thiểu ' + MIN_LEN + ' ký tự' : 'Minimum ' + MIN_LEN + ' characters'));
                    valid = false;
                    continue;
                }

                // Max length
                if (val.length > MAX_LEN) {
                    setFieldError(el, (lang === 'vi' ? 'Tối đa ' + MAX_LEN + ' ký tự' : 'Maximum ' + MAX_LEN + ' characters'));
                    valid = false;
                    continue;
                }

                // Email format
                if (f.type === 'email' && !EMAIL_RE.test(val)) {
                    setFieldError(el, (lang === 'vi' ? 'Email không hợp lệ' : 'Invalid email address'));
                    valid = false;
                    continue;
                }

                // Phone format
                if (f.type === 'tel' && !PHONE_RE.test(val)) {
                    setFieldError(el, (lang === 'vi' ? 'Số điện thoại không hợp lệ' : 'Invalid phone number'));
                    valid = false;
                    continue;
                }

                // Select must have a non-empty value
                if (f.type === 'select' && !val) {
                    setFieldError(el, (lang === 'vi' ? 'Vui lòng chọn ' : 'Please select ') + f.label.toLowerCase());
                    valid = false;
                    continue;
                }
            }
            return valid;
        }

        var pcfEl = win.querySelector('#nchat-pcf');
        var CONV_KEY = 'nchat_conv_' + id;
        var _conversationId = null;
        var _forceNewConversationOnNextSend = false;
        var _lastMessageTs = null; // track for reconnect sync
        var _msgPage = 1;
        var _hasMoreMsgs = false;
        var _loadingOlder = false;
        var _pendingMessages = []; // { tid, clientMessageId, payload, conversationId, retry, inFlight }
        var _conversationInitPromise = null;
        var _connectionStateTimer = null;
        var _destroyed = false;
        var _replyContext = null;
        var _emojiTargetInput = null;
        var replyCancelButton = win.querySelector('#nchat-reply-cancel');
        if (replyCancelButton) replyCancelButton.addEventListener('click', function () { clearReplyContext(true); });

        function messageReplyContent(message) {
            var copy = String((message && message.content) || '').trim();
            if (!copy && message && message.type === 'image') copy = lang === 'vi' ? '\u1ea2nh' : 'Photo';
            if (!copy && message && message.type === 'file') {
                copy = (message.attachments && message.attachments[0] && message.attachments[0].filename)
                    || (lang === 'vi' ? 'T\u1ec7p \u0111\u00ednh k\u00e8m' : 'Attachment');
            }
            return copy.slice(0, 500);
        }

        function messageReplySender(message) {
            var sender = getMessageSender(message || {});
            if (sender.type === 'visitor') return lang === 'vi' ? 'B\u1ea1n' : 'You';
            return sender.name || widgetName || (lang === 'vi' ? 'H\u1ed7 tr\u1ee3' : 'Support');
        }

        function buildReplyQuote(reply) {
            if (!reply) return '';
            var replyCopy = String(reply.content || '').trim();
            if (replyCopy.length > 90) replyCopy = replyCopy.slice(0, 90) + '...';
            return '<button type="button" class="nchat-msg-quote" data-reply-message-id="' + escapeWidgetHtml(reply.messageId || '') + '">'
                + '<strong>' + escapeWidgetHtml(reply.senderName || (lang === 'vi' ? 'Tin nh\u1eafn' : 'Message')) + '</strong>'
                + '<span>' + escapeWidgetHtml(replyCopy || (lang === 'vi' ? 'N\u1ed9i dung \u0111\u00ednh k\u00e8m' : 'Attachment')) + '</span></button>';
        }

        function buildReplyAction(message) {
            var messageId = getRecordId(message);
            if (!messageId || /^tmp_/i.test(messageId) || message.isRecalled || message.isDeleted) return '';
            var label = lang === 'vi' ? 'Tr\u1ea3 l\u1eddi tin nh\u1eafn n\u00e0y' : 'Reply to this message';
            return '<button type="button" class="nchat-reply-action" aria-label="' + label + '" title="' + label + '">' + replyIcon + '</button>';
        }

        function renderReplyContext() {
            var preview = win.querySelector('#nchat-reply-preview');
            if (!preview) return;
            preview.classList.toggle('nchat-reply-visible', Boolean(_replyContext));
            var title = preview.querySelector('strong');
            var copy = preview.querySelector('span');
            if (title) {
                title.textContent = _replyContext
                    ? ((lang === 'vi' ? 'Tr\u1ea3 l\u1eddi ' : 'Replying to ') + _replyContext.senderName)
                    : '';
            }
            if (copy) copy.textContent = _replyContext ? _replyContext.content : '';
        }

        function clearReplyContext(focusInput) {
            _replyContext = null;
            renderReplyContext();
            if (focusInput) {
                var input = win.querySelector('#nchat-input');
                if (input && input.focus) input.focus();
            }
        }

        function beginReplyToMessage(message) {
            var messageId = getRecordId(message);
            if (!messageId || /^tmp_/i.test(messageId)) return;
            _replyContext = {
                messageId: messageId,
                content: messageReplyContent(message),
                senderName: messageReplySender(message)
            };
            closeEmojiPicker(false);
            renderReplyContext();
            var input = win.querySelector('#nchat-input');
            if (input && input.focus) input.focus();
        }

        function bindMessageReplyActions(element, message) {
            if (!element) return;
            var replyAction = element.querySelector('.nchat-reply-action');
            if (replyAction) replyAction.addEventListener('click', function () { beginReplyToMessage(message); });
            var quote = element.querySelector('.nchat-msg-quote');
            if (quote) quote.addEventListener('click', function () {
                var targetId = quote.getAttribute('data-reply-message-id');
                var target = findRenderedMessage(targetId, '');
                if (!target) return;
                target.scrollIntoView({ block: 'center', behavior: 'smooth' });
                target.classList.remove('nchat-message-flash');
                void target.offsetWidth;
                target.classList.add('nchat-message-flash');
                setTimeout(function () { target.classList.remove('nchat-message-flash'); }, 1200);
            });
        }

        // Try to restore conversationId from localStorage
        try {
            var storedConversationId = localStorage.getItem(CONV_KEY);
            if (isValidConversationId(storedConversationId)) {
                _conversationId = getRecordId(storedConversationId);
            } else if (storedConversationId) {
                localStorage.removeItem(CONV_KEY);
            }
        } catch (e) { }

        function setConnectionState(state, copy) {
            var stateEl = win.querySelector('#nchat-connection-state');
            if (!stateEl) return;
            if (_connectionStateTimer) {
                clearTimeout(_connectionStateTimer);
                _connectionStateTimer = null;
            }
            stateEl.className = '';
            if (!state || state === 'hidden') return;
            stateEl.classList.add('nchat-state-visible');
            if (state === 'error') stateEl.classList.add('nchat-state-error');
            if (state === 'online') stateEl.classList.add('nchat-state-online');
            var copyEl = stateEl.querySelector('.nchat-state-copy');
            if (copyEl) copyEl.textContent = copy || '';
            if (state === 'online') {
                _connectionStateTimer = setTimeout(function () {
                    stateEl.className = '';
                }, 1600);
            }
        }

        function findRenderedMessage(messageId, clientMessageId) {
            var bodyEl = win.querySelector('#nchat-body');
            if (!bodyEl) return null;
            var nodes = bodyEl.querySelectorAll('.nchat-msg');
            for (var i = 0; i < nodes.length; i++) {
                if (messageId && nodes[i].getAttribute('data-msg-id') === messageId) return nodes[i];
                if (clientMessageId && nodes[i].getAttribute('data-client-message-id') === clientMessageId) return nodes[i];
            }
            return null;
        }

        function removePendingMessage(tmpId, clientMessageId) {
            _pendingMessages = _pendingMessages.filter(function (pending) {
                return pending.tid !== tmpId && (!clientMessageId || pending.clientMessageId !== clientMessageId);
            });
        }

        function isPendingMessageTracked(pending) {
            return _pendingMessages.some(function (item) {
                return item === pending
                    || (pending.clientMessageId && item.clientMessageId === pending.clientMessageId);
            });
        }

        // ── Message rendering helper (with dedup + ordering) ──
        function appendMessage(msg, skipScroll) {
            var bodyEl = win.querySelector('#nchat-body');
            if (!bodyEl || !msg) return null;

            var sender = getMessageSender(msg);
            var messageId = getRecordId(msg);
            var clientMessageId = msg.clientMessageId ? String(msg.clientMessageId) : '';

            if (profileDisplay === 'agent' && sender.type === 'agent' && sender.name) {
                var headerName = win.querySelector('#nchat-hdr h4');
                if (headerName) headerName.textContent = sender.name;
            }

            // ── Never expose staff-only notes/system messages in the public widget ──
            if (msg.isInternal === true || sender.type === 'system') return null;

            // ── Dedup: skip if message already rendered ──
            var rendered = findRenderedMessage(messageId, clientMessageId);
            if (rendered) {
                if (messageId) rendered.setAttribute('data-msg-id', messageId);
                if (clientMessageId) rendered.setAttribute('data-client-message-id', clientMessageId);
                if (msg.createdAt) rendered.setAttribute('data-msg-ts', msg.createdAt);
                rendered.classList.remove('nchat-msg-sending', 'nchat-msg-error');
                var oldRetry = rendered.querySelector('.nchat-retry-btn');
                if (oldRetry) oldRetry.remove();
                updateMessageElement(rendered, msg);
                removePendingMessage('', clientMessageId);
                return rendered;
            }

            var emptyState = bodyEl.querySelector('.nchat-empty-state');
            if (emptyState) emptyState.remove();

            var isVisitor = sender.type === 'visitor';
            var div = document.createElement('div');
            div.className = 'nchat-msg ' + (isVisitor ? 'nchat-msg-user' : 'nchat-msg-bot');
            if (messageId) div.setAttribute('data-msg-id', messageId);
            if (clientMessageId) div.setAttribute('data-client-message-id', clientMessageId);
            var ts = msg.createdAt || new Date().toISOString();
            div.setAttribute('data-msg-ts', ts);
            if (!_lastMessageTs || new Date(ts).getTime() > new Date(_lastMessageTs).getTime()) _lastMessageTs = ts;

            if (msg.isRecalled || msg.isDeleted) {
                div.innerHTML = '<div class="nchat-msg-bubble" style="font-style:italic;opacity:0.7">' + (lang === 'vi' ? 'Tin nhắn đã thu hồi' : 'Message recalled') + '</div>';
            } else {
                var replyHtml = buildReplyQuote(getMessageReply(msg));

                var bubbleHtml = '';
                if (msg.type === 'image' && msg.attachments && msg.attachments.length) {
                    for (var a = 0; a < msg.attachments.length; a++) {
                        var imgSrc = safeMediaSource(msg.attachments[a].data || msg.attachments[a].url || '');
                        if (imgSrc) bubbleHtml += '<img src="' + imgSrc + '" class="nchat-msg-img" alt="' + escapeWidgetHtml(msg.attachments[a].filename || 'image') + '" />';
                    }
                    if (msg.content) bubbleHtml += '<div style="margin-top:4px">' + formatMessageText(msg.content) + '</div>';
                } else if (msg.type === 'file' && msg.attachments && msg.attachments.length) {
                    bubbleHtml = '<div class="nchat-file-chip"><svg viewBox="0 0 24 24"><path d="M16.5 6v11.5a4 4 0 01-8 0V5a2.5 2.5 0 015 0v10.5a1 1 0 01-2 0V6H10v9.5a2.5 2.5 0 005 0V5a4 4 0 00-8 0v12.5a5.5 5.5 0 0011 0V6z"/></svg><span>' + escapeWidgetHtml(msg.attachments[0].filename || (lang === 'vi' ? 'Tệp đính kèm' : 'Attachment')) + '</span></div>';
                } else {
                    bubbleHtml = formatMessageText(msg.content || '');
                }

                if (msg.isEdited) {
                    bubbleHtml += ' <span style="font-size:10px;opacity:0.6;margin-left:4px">(' + (lang === 'vi' ? 'đã chỉnh sửa' : 'edited') + ')</span>';
                }

                // Build status tick for visitor messages (own messages)
                var statusHtml = '';
                if (isVisitor && msg.status) {
                    statusHtml = '<span class="nchat-msg-status nchat-msg-status-' + msg.status + '"></span>';
                }

                div.innerHTML = '<div class="nchat-msg-bubble">' + replyHtml + bubbleHtml + '</div>' + statusHtml + buildReplyAction(msg);
            }

            // ── Ordering: insert at correct chronological position ──
            var inserted = false;
            var existing = bodyEl.querySelectorAll('.nchat-msg[data-msg-ts]');
            for (var i = existing.length - 1; i >= 0; i--) {
                var existingTs = existing[i].getAttribute('data-msg-ts');
                if (existingTs && existingTs <= ts) {
                    // Insert after this element
                    if (existing[i].nextSibling) {
                        bodyEl.insertBefore(div, existing[i].nextSibling);
                    } else {
                        bodyEl.appendChild(div);
                    }
                    inserted = true;
                    break;
                }
            }
            if (!inserted) {
                // Oldest message or empty — prepend or append
                if (existing.length > 0) {
                    bodyEl.insertBefore(div, existing[0]);
                } else {
                    bodyEl.appendChild(div);
                }
            }

            if (!skipScroll) {
                bodyEl.scrollTop = bodyEl.scrollHeight;
            }

            // Click image to preview
            if (!msg.isRecalled && !msg.isDeleted) {
                var imgs = div.querySelectorAll('.nchat-msg-img');
                for (var im = 0; im < imgs.length; im++) {
                    imgs[im].addEventListener('click', function (ev) {
                        var overlay = document.createElement('div');
                        overlay.className = 'nchat-img-preview';
                        overlay.innerHTML = '<img src="' + ev.target.src + '" />';
                        overlay.addEventListener('click', function () { overlay.remove(); });
                        document.body.appendChild(overlay);
                    });
                }
            }
            bindMessageReplyActions(div, msg);
            return div;
        }
        
        function updateMessageElement(el, msg) {
            var isVisitor = getMessageSender(msg).type === 'visitor';
            if (msg.isRecalled || msg.isDeleted) {
                el.innerHTML = '<div class="nchat-msg-bubble" style="font-style:italic;opacity:0.7">' + (lang === 'vi' ? 'Tin nhắn đã thu hồi' : 'Message recalled') + '</div>';
            } else {
                var replyHtml = buildReplyQuote(getMessageReply(msg));

                var bubbleHtml = '';
                if (msg.type === 'image' && msg.attachments && msg.attachments.length) {
                    for (var a = 0; a < msg.attachments.length; a++) {
                        var imgSrc = safeMediaSource(msg.attachments[a].data || msg.attachments[a].url || '');
                        if (imgSrc) bubbleHtml += '<img src="' + imgSrc + '" class="nchat-msg-img" alt="' + escapeWidgetHtml(msg.attachments[a].filename || 'image') + '" />';
                    }
                    if (msg.content) bubbleHtml += '<div style="margin-top:4px">' + formatMessageText(msg.content) + '</div>';
                } else if (msg.type === 'file' && msg.attachments && msg.attachments.length) {
                    bubbleHtml = '<div class="nchat-file-chip"><svg viewBox="0 0 24 24"><path d="M16.5 6v11.5a4 4 0 01-8 0V5a2.5 2.5 0 015 0v10.5a1 1 0 01-2 0V6H10v9.5a2.5 2.5 0 005 0V5a4 4 0 00-8 0v12.5a5.5 5.5 0 0011 0V6z"/></svg><span>' + escapeWidgetHtml(msg.attachments[0].filename || (lang === 'vi' ? 'Tệp đính kèm' : 'Attachment')) + '</span></div>';
                } else {
                    bubbleHtml = formatMessageText(msg.content || '');
                }

                if (msg.isEdited) {
                    bubbleHtml += ' <span style="font-size:10px;opacity:0.6;margin-left:4px">(' + (lang === 'vi' ? 'đã chỉnh sửa' : 'edited') + ')</span>';
                }

                var statusHtml = '';
                if (isVisitor && msg.status) {
                    statusHtml = '<span class="nchat-msg-status nchat-msg-status-' + msg.status + '"></span>';
                }
                el.innerHTML = '<div class="nchat-msg-bubble">' + replyHtml + bubbleHtml + '</div>' + statusHtml + buildReplyAction(msg);

                // Re-bind image clicks
                var imgs = el.querySelectorAll('.nchat-msg-img');
                for (var im = 0; im < imgs.length; im++) {
                    imgs[im].addEventListener('click', function (ev) {
                        var overlay = document.createElement('div');
                        overlay.className = 'nchat-img-preview';
                        overlay.innerHTML = '<img src="' + ev.target.src + '" />';
                        overlay.addEventListener('click', function () { overlay.remove(); });
                        document.body.appendChild(overlay);
                    });
                }
                bindMessageReplyActions(el, msg);
            }
        }

        function renderMessages(messages) {
            var bodyEl = win.querySelector('#nchat-body');
            if (!bodyEl) return;
            bodyEl.innerHTML = '';
            for (var m = 0; m < messages.length; m++) {
                appendMessage(messages[m], true);
            }
            bodyEl.scrollTop = bodyEl.scrollHeight;
        }

        function renderLoadOlderButton() {
            var bodyEl = win.querySelector('#nchat-body');
            if (!bodyEl) return;

            var btnId = 'nchat-load-older-btn';
            var existingBtn = bodyEl.querySelector('#' + btnId);

            if (!_hasMoreMsgs) {
                if (existingBtn) existingBtn.remove();
                return;
            }

            if (!existingBtn) {
                var btnWrap = document.createElement('div');
                btnWrap.id = btnId;
                btnWrap.style.textAlign = 'center';
                btnWrap.style.margin = '10px 0';

                var btn = document.createElement('button');
                btn.textContent = lang === 'vi' ? 'Tải tin nhắn cũ hơn' : 'Load older messages';
                btn.style.padding = '6px 12px';
                btn.style.fontSize = '12px';
                btn.style.borderRadius = '16px';
                btn.style.border = '1px solid #ddd';
                btn.style.background = '#f9f9f9';
                btn.style.color = '#555';
                btn.style.cursor = 'pointer';

                btn.onclick = function () {
                    if (_loadingOlder) return;
                    btn.textContent = '...';
                    _loadingOlder = true;
                    var nextPage = _msgPage + 1;
                    var olderUrl = conversationUrl(base, _conversationId, '/messages?page=' + nextPage + '&limit=30&visitorId=' + encodeURIComponent(vid));
                    if (!olderUrl) {
                        _loadingOlder = false;
                        btn.textContent = lang === 'vi' ? 'Tải tin nhắn cũ hơn' : 'Load older messages';
                        return;
                    }
                    fetch(olderUrl)
                        .then(function (r) {
                            if (!r.ok) throw new Error('HTTP ' + r.status);
                            return r.json();
                        })
                        .then(function (res) {
                            _loadingOlder = false;
                            btn.textContent = lang === 'vi' ? 'Tải tin nhắn cũ hơn' : 'Load older messages';
                            if (res.success && res.data) {
                                var olderItems = res.data.items || [];
                                var total = res.data.total || 0;
                                _msgPage = nextPage;
                                _hasMoreMsgs = (_msgPage * 30) < total;

                                var oldScrollHeight = bodyEl.scrollHeight;

                                for (var m = 0; m < olderItems.length; m++) {
                                    appendMessage(olderItems[m], true);
                                }

                                if (!_hasMoreMsgs) {
                                    btnWrap.remove();
                                } else {
                                    bodyEl.insertBefore(btnWrap, bodyEl.firstChild);
                                }

                                setTimeout(function () {
                                    bodyEl.scrollTop = bodyEl.scrollHeight - oldScrollHeight;
                                }, 10);
                            }
                        })
                        .catch(function () {
                            _loadingOlder = false;
                            btn.textContent = lang === 'vi' ? 'Tải tin nhắn cũ hơn' : 'Load older messages';
                        });
                };
                btnWrap.appendChild(btn);
                bodyEl.insertBefore(btnWrap, bodyEl.firstChild);
            } else {
                bodyEl.insertBefore(existingBtn, bodyEl.firstChild);
            }
        }

        // ── Send message helpers (ACK + optimistic UI + error rollback) ──
        var _tempIdCounter = 0;
        function tempId() { return 'tmp_' + Date.now() + '_' + (++_tempIdCounter); }

        function newClientMessageId() {
            return 'nchat_' + generateId();
        }

        function markMessageAck(tmpId, clientMessageId, serverMsg) {
            var serverId = getRecordId(serverMsg);
            var el = findRenderedMessage(tmpId, clientMessageId);
            if (!el || !serverId) return false;
            el.setAttribute('data-msg-id', serverId);
            if (clientMessageId) el.setAttribute('data-client-message-id', clientMessageId);
            if (serverMsg.createdAt) el.setAttribute('data-msg-ts', serverMsg.createdAt);
            el.classList.remove('nchat-msg-sending', 'nchat-msg-error');
            var retryBtn = el.querySelector('.nchat-retry-btn');
            if (retryBtn) retryBtn.remove();
            updateMessageElement(el, serverMsg);
            if (serverMsg.createdAt) _lastMessageTs = serverMsg.createdAt;
            removePendingMessage(tmpId, clientMessageId);
            return true;
        }

        function markMessageError(pending, error) {
            pending.inFlight = false;
            var el = findRenderedMessage(pending.tid, pending.clientMessageId);
            if (!el) return;
            el.classList.remove('nchat-msg-sending');
            el.classList.add('nchat-msg-error');
            var existingRetry = el.querySelector('.nchat-retry-btn');
            if (existingRetry) existingRetry.remove();
            var retryBtn = document.createElement('button');
            retryBtn.type = 'button';
            retryBtn.className = 'nchat-retry-btn';
            retryBtn.textContent = lang === 'vi' ? 'Gửi lại' : 'Retry';
            retryBtn.onclick = function () { sendPendingMessage(pending); };
            el.appendChild(retryBtn);
            setConnectionState('error', navigator.onLine === false
                ? (lang === 'vi' ? 'Mất kết nối — tin nhắn đang chờ gửi' : 'Offline — message queued')
                : (lang === 'vi' ? 'Tin nhắn chưa gửi được' : 'Message was not sent'));
            if (error) console.warn('[NemarkChat] Send error: ' + (error.message || String(error)));
        }

        function sendPendingMessage(pending) {
            if (!pending || pending.inFlight || _destroyed) return;
            pending.inFlight = true;
            var el = findRenderedMessage(pending.tid, pending.clientMessageId);
            if (el) {
                el.classList.remove('nchat-msg-error');
                el.classList.add('nchat-msg-sending');
                var retryBtn = el.querySelector('.nchat-retry-btn');
                if (retryBtn) retryBtn.remove();
            }

            var ready = isValidConversationId(pending.conversationId)
                ? Promise.resolve(pending.conversationId)
                : initConversation(
                    window.__nchat_visitor || (existingSession && existingSession.info) || {},
                    null,
                    _forceNewConversationOnNextSend,
                );

            ready.then(function (conversationId) {
                if (!isValidConversationId(conversationId)) throw new Error('Conversation is not ready');
                pending.conversationId = getRecordId(conversationId);
                var requestUrl = conversationUrl(base, pending.conversationId, '/messages');
                if (!requestUrl) throw new Error('Invalid conversation id');
                return fetch(requestUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(pending.payload)
                });
            }).then(function (response) {
                return response.json().catch(function () { return {}; }).then(function (result) {
                    if (!response.ok || !result.success || !result.data) {
                        throw new Error(apiErrorMessage(result, response.status));
                    }
                    return result.data;
                });
            }).then(function (serverMsg) {
                pending.inFlight = false;
                if (!markMessageAck(pending.tid, pending.clientMessageId, serverMsg)) {
                    throw new Error('Server response did not include a message id');
                }
                setConnectionState('online', lang === 'vi' ? 'Đã gửi' : 'Sent');
            }).catch(function (error) {
                // A realtime socket ACK may arrive before the HTTP response is lost.
                // appendMessage removes the outbox item in that case, so never turn
                // an already-delivered bubble back into an error/retry state.
                if (!isPendingMessageTracked(pending)) {
                    pending.inFlight = false;
                    return;
                }
                markMessageError(pending, error);
            });
        }

        function queueOptimisticMessage(message, payload) {
            var pending = {
                tid: getRecordId(message),
                clientMessageId: message.clientMessageId,
                payload: payload,
                conversationId: isValidConversationId(_conversationId) ? getRecordId(_conversationId) : '',
                inFlight: false,
                retry: null
            };
            pending.retry = function () { sendPendingMessage(pending); };
            _pendingMessages.push(pending);
            appendMessage(message);
            var el = findRenderedMessage(pending.tid, pending.clientMessageId);
            if (el) el.classList.add('nchat-msg-sending');
            sendPendingMessage(pending);
            return pending.tid;
        }

        function sendTextMessage(text) {
            var content = String(text || '').trim();
            if (!content) return null;
            if (content.length > 5000) content = content.slice(0, 5000);
            var tid = tempId();
            var clientMessageId = newClientMessageId();
            var payload = { content: content, visitorId: vid, type: 'text', clientMessageId: clientMessageId };
            var replyContext = _replyContext ? {
                messageId: _replyContext.messageId,
                content: _replyContext.content,
                senderName: _replyContext.senderName
            } : null;
            if (replyContext) payload.replyTo = replyContext;
            var queuedId = queueOptimisticMessage({
                id: tid,
                clientMessageId: clientMessageId,
                senderType: 'visitor',
                sender: { type: 'visitor' },
                content: content,
                type: 'text',
                replyTo: replyContext,
                createdAt: new Date().toISOString()
            }, payload);
            clearReplyContext(false);
            return queuedId;
        }

        // ── Upload file → base64 inline ──
        function uploadFile(file) {
            if (!file) return;
            if (file.size > 10 * 1024 * 1024) {
                setConnectionState('error', lang === 'vi' ? 'Tệp vượt quá giới hạn 10 MB' : 'File exceeds the 10 MB limit');
                return;
            }

            var reader = new FileReader();
            reader.onload = function (ev) {
                var b64 = ev.target.result;
                var attachment = { data: b64, filename: file.name, mimeType: file.type, size: file.size };
                var msgType = file.type.indexOf('image/') === 0 ? 'image' : 'file';
                var tid = tempId();
                var clientMessageId = newClientMessageId();
                var payload = { content: '', visitorId: vid, type: msgType, attachments: [attachment], clientMessageId: clientMessageId };
                var replyContext = _replyContext ? {
                    messageId: _replyContext.messageId,
                    content: _replyContext.content,
                    senderName: _replyContext.senderName
                } : null;
                if (replyContext) payload.replyTo = replyContext;
                queueOptimisticMessage({
                    id: tid,
                    clientMessageId: clientMessageId,
                    sender: { type: 'visitor' },
                    senderType: 'visitor',
                    content: '',
                    type: msgType,
                    attachments: [attachment],
                    replyTo: replyContext,
                    createdAt: new Date().toISOString()
                }, payload);
                clearReplyContext(false);
            };
            reader.onerror = function () {
                setConnectionState('error', lang === 'vi' ? 'Không đọc được tệp đã chọn' : 'Unable to read the selected file');
            };
            reader.readAsDataURL(file);
        }

        // ── Collect session metadata ──
        function collectMetadata() {
            var viewportWidth = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
            var deviceType = viewportWidth <= 767
                ? 'mobile'
                : (viewportWidth <= 1100 ? 'tablet' : 'desktop');
            var meta = {
                pageUrl: window.location.href,
                referrer: document.referrer || '',
                domain: window.location.hostname,
                language: navigator.language || '',
                platform: navigator.platform || '',
                deviceType: deviceType,
                viewport: viewportWidth + 'x' + Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0),
                timezone: (typeof Intl !== 'undefined' && Intl.DateTimeFormat)
                    ? (Intl.DateTimeFormat().resolvedOptions().timeZone || '')
                    : ''
            };
            // Extract UTM params from URL
            try {
                var params = new URLSearchParams(window.location.search);
                ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(function (k) {
                    var v = params.get(k);
                    if (v) meta[k] = v;
                });
            } catch (e) { /* URLSearchParams not supported */ }
            return meta;
        }

        // ── Init conversation (findOrCreate) ──
        function initConversation(visitorInfo, callback, forceNew) {
            if (_conversationInitPromise) {
                return _conversationInitPromise;
            }
            var meta = collectMetadata();
            if (visitorInfo && Object.prototype.hasOwnProperty.call(visitorInfo, 'marketingConsent')) {
                meta.marketingConsent = visitorInfo.marketingConsent === true;
                meta.consentText = String(visitorInfo.consentText || '').slice(0, 1000);
                if (visitorInfo.marketingConsent === true) {
                    meta.consentAt = visitorInfo.consentAt || new Date().toISOString();
                }
            }
            setConnectionState('loading', lang === 'vi' ? 'Đang kết nối hội thoại…' : 'Connecting conversation…');
            var initPromise = fetch(base + '/api/conversations/public/find-or-create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    widgetId: id,
                    visitorId: vid,
                    visitorInfo: visitorInfo || {},
                    metadata: meta,
                    forceNew: forceNew === true
                })
            })
                .then(function (r) {
                    return r.json().catch(function () { return {}; }).then(function (result) {
                        if (!r.ok || !result.success || !result.data) {
                            throw new Error(apiErrorMessage(result, r.status));
                        }
                        return result;
                    });
                })
                .then(function (res) {
                    if (_destroyed) throw new Error('Widget was destroyed');
                    var nextConversationId = getRecordId(res.data.conversation);
                    if (!isValidConversationId(nextConversationId)) {
                        try { localStorage.removeItem(CONV_KEY); } catch (e) { }
                        throw new Error('API returned an invalid conversation id');
                    }
                    _conversationId = nextConversationId;
                    if (forceNew === true) _forceNewConversationOnNextSend = false;
                    _visitorToken = res.data.visitorToken || '';
                    try {
                        localStorage.setItem(CONV_KEY, _conversationId);
                        if (_visitorToken) localStorage.setItem(TOKEN_KEY, _visitorToken);
                    } catch (e) { }

                    connectSocket();
                    function joinConvRoom() {
                        if (_socket && _socket.connected && isValidConversationId(_conversationId)) {
                            _socket.emit('join:conversation', { conversationId: _conversationId });
                        }
                    }
                    joinConvRoom();
                    setTimeout(joinConvRoom, 1000);

                    if (meta.utm_source || meta.utm_medium || meta.utm_campaign) {
                        fetch(base + '/api/conversations/public/visitor/enrich', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ visitorId: vid, widgetId: id, attributes: meta })
                        }).catch(function () { });
                    }

                    var msgs = Array.isArray(res.data.messages) ? res.data.messages : [];
                    var totalMsgs = Number(res.data.totalMessages || 0);
                    _hasMoreMsgs = (_msgPage * 30) < totalMsgs;
                    if (_pendingMessages.length > 0) {
                        for (var pendingIndex = 0; pendingIndex < msgs.length; pendingIndex++) {
                            appendMessage(msgs[pendingIndex], true);
                        }
                    } else if (msgs.length > 0) {
                        renderMessages(msgs);
                    } else if (!forceNew) {
                        var bodyEl = win.querySelector('#nchat-body');
                        if (bodyEl && !bodyEl.querySelector('.nchat-empty-state')) {
                            bodyEl.innerHTML = '<div class="nchat-msg nchat-msg-bot"><div class="nchat-msg-bubble">' + escapeWidgetHtml(greeting) + '</div></div>';
                        }
                    }
                    if (_hasMoreMsgs) renderLoadOlderButton();
                    setConnectionState('online', lang === 'vi' ? 'Đã kết nối' : 'Connected');
                    if (callback) callback(res.data);
                    return _conversationId;
                })
                .catch(function (err) {
                    _conversationInitPromise = null;
                    setConnectionState('error', lang === 'vi' ? 'Chưa kết nối được. Tin nhắn sẽ được giữ để gửi lại.' : 'Unable to connect. Your message is queued.');
                    console.warn('[NemarkChat] Conversation init failed: ' + (err.message || String(err)));
                    throw err;
                });
            _conversationInitPromise = initPromise;
            return initPromise;
        }

        // ── Resume existing conversation on load ──
        if (isValidConversationId(_conversationId)) {
            initConversation(existingSession ? existingSession.info : {}).catch(function () { });
        }

        // ── SPA page tracking ──
        (function () {
            var _lastUrl = window.location.href;
            var _trackTimer = null;

            function onRouteChange() {
                var newUrl = window.location.href;
                if (newUrl === _lastUrl || !isValidConversationId(_conversationId)) return;
                _lastUrl = newUrl;

                // Debounce 500ms — avoid spamming during rapid nav
                if (_trackTimer) clearTimeout(_trackTimer);
                _trackTimer = setTimeout(function () {
                    var trackingUrl = conversationUrl(base, _conversationId, '/tracking');
                    if (!trackingUrl) return;
                    fetch(trackingUrl, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ visitorId: vid, pageUrl: newUrl })
                    }).catch(function () { });
                }, 500);
            }

            // Intercept pushState / replaceState
            var origPush = history.pushState;
            var origReplace = history.replaceState;
            var widgetPushState = function () {
                origPush.apply(this, arguments);
                onRouteChange();
            };
            var widgetReplaceState = function () {
                origReplace.apply(this, arguments);
                onRouteChange();
            };
            history.pushState = widgetPushState;
            history.replaceState = widgetReplaceState;

            // Back/forward button
            window.addEventListener('popstate', onRouteChange);
            _globalCleanup.push(function () {
                if (_trackTimer) clearTimeout(_trackTimer);
                window.removeEventListener('popstate', onRouteChange);
                if (history.pushState === widgetPushState) history.pushState = origPush;
                if (history.replaceState === widgetReplaceState) history.replaceState = origReplace;
            });
        })();

        // ── Auto-retry offline messages ──
        function handleWidgetOnline() {
            if (_pendingMessages.length > 0) {
                console.log('[NemarkChat] Network restored. Retrying', _pendingMessages.length, 'messages...');
                var queue = _pendingMessages.slice();
                for (var i = 0; i < queue.length; i++) {
                    if (queue[i].retry) queue[i].retry();
                }
            }
        }
        window.addEventListener('online', handleWidgetOnline);
        _globalCleanup.push(function () { window.removeEventListener('online', handleWidgetOnline); });

        if (pcfEl) {
            // Clear errors on input/change
            pcfEl.addEventListener('input', function (ev) {
                if (ev.target && ev.target.classList) clearFieldError(ev.target);
            });
            pcfEl.addEventListener('change', function (ev) {
                if (ev.target && ev.target.classList) clearFieldError(ev.target);
            });

            pcfEl.addEventListener('submit', function (e) {
                e.preventDefault();

                // Validate against widget config fields
                var fieldsCfg = pcf.fields || [];
                if (!validateFields(pcfEl, fieldsCfg)) {
                    var firstErr = pcfEl.querySelector('.nchat-invalid');
                    if (firstErr) firstErr.focus();
                    return;
                }

                var fd = new FormData(pcfEl);
                var info = {};
                fd.forEach(function (val, key) { info[key] = val; });
                for (var fieldIndex = 0; fieldIndex < fieldsCfg.length; fieldIndex++) {
                    var fieldConfig = fieldsCfg[fieldIndex];
                    if (!fieldConfig || fieldConfig.type !== 'checkbox') continue;
                    var checkboxField = pcfEl.querySelector('[name="' + fieldConfig.key + '"]');
                    info[fieldConfig.key] = Boolean(checkboxField && checkboxField.checked);
                }
                var consentInput = pcfEl.querySelector('[name="marketingConsent"]');
                if (consentInput) {
                    info.marketingConsent = Boolean(consentInput.checked);
                    info.consentText = consentInput.getAttribute('data-consent-text')
                        || String((fieldsCfg.find(function (field) { return field && field.key === 'marketingConsent'; }) || {}).label || '');
                    if (info.marketingConsent) info.consentAt = new Date().toISOString();
                }

                // Store visitor info + persist
                info.visitorId = vid;
                window.__nchat_visitor = info;
                window.__nchat_widget_id = id;
                window.__nchat_api_base = base;
                window.__nchat_visitor_id = vid;
                saveVisitorSession(info);

                // Create conversation via API
                initConversation(info, function (data) {
                    win.classList.remove('nchat-awaiting-profile');
                    // Replace form with welcome message
                    var bodyEl = win.querySelector('#nchat-body');
                    if (data.messages && data.messages.length > 0) {
                        renderMessages(data.messages);
                    } else {
                        bodyEl.innerHTML = '<div class="nchat-msg nchat-msg-bot">'
                            + '<div class="nchat-msg-bubble">'
                            + (lang === 'vi'
                                ? 'Cảm ơn <strong>' + escapeWidgetHtml(info.name || 'bạn') + '</strong>! Một nhân viên sẽ hỗ trợ bạn ngay.'
                                : 'Thanks <strong>' + escapeWidgetHtml(info.name || 'you') + '</strong>! An agent will be with you shortly.')
                            + '</div></div>';
                    }

                    var input = win.querySelector('#nchat-input');
                    if (input && (!window.matchMedia || !window.matchMedia('(max-width: 600px)').matches)) input.focus();
                }).catch(function () { });
            });
        }

        // ── Enter to send + Send button ──
        var chatInput = win.querySelector('#nchat-input');
        var sendBtn = win.querySelector('#nchat-send');

        function resizeChatInput(input) {
            if (!input || input.tagName !== 'TEXTAREA') return;
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 108) + 'px';
        }

        function resetChatInput(input) {
            if (!input) return;
            input.value = '';
            resizeChatInput(input);
        }

        function updateSendAvailability() {
            if (sendBtn) sendBtn.disabled = !chatInput || !chatInput.value.trim();
        }

        function emojiFromCodeGroup(codeGroup) {
            return String.fromCodePoint.apply(String, String(codeGroup || '').split(',').map(function (code) {
                return parseInt(code, 16);
            }));
        }

        function closeEmojiPicker(focusButton) {
            var picker = win.querySelector('#nchat-emoji-picker');
            var targetInput = _emojiTargetInput;
            if (picker) picker.classList.remove('nchat-picker-open');
            var buttons = win.querySelectorAll('#nchat-emoji-btn');
            for (var buttonIndex = 0; buttonIndex < buttons.length; buttonIndex++) {
                buttons[buttonIndex].setAttribute('aria-expanded', 'false');
            }
            _emojiTargetInput = null;
            if (focusButton) {
                var emojiButton = win.querySelector('#nchat-emoji-btn');
                if (emojiButton && emojiButton.focus) emojiButton.focus();
            } else if (targetInput && document.activeElement && document.activeElement.closest && document.activeElement.closest('#nchat-emoji-picker')) {
                targetInput.focus();
            }
        }

        function bindEmojiButton(button, input) {
            if (!button || !input || button.__nchatEmojiBound) return;
            button.__nchatEmojiBound = true;
            button.addEventListener('click', function (event) {
                event.stopPropagation();
                var picker = win.querySelector('#nchat-emoji-picker');
                if (!picker) return;
                var shouldOpen = !picker.classList.contains('nchat-picker-open');
                closeEmojiPicker(false);
                if (!shouldOpen) return;
                _emojiTargetInput = input;
                picker.classList.add('nchat-picker-open');
                button.setAttribute('aria-expanded', 'true');
                var firstEmoji = picker.querySelector('button');
                if (firstEmoji && firstEmoji.focus) firstEmoji.focus();
            });
        }

        var emojiPicker = win.querySelector('#nchat-emoji-picker');
        if (emojiPicker) {
            emojiPicker.addEventListener('click', function (event) {
                var choice = event.target && event.target.closest ? event.target.closest('[data-emoji-code]') : null;
                if (!choice || !_emojiTargetInput) return;
                var input = _emojiTargetInput;
                var emoji = emojiFromCodeGroup(choice.getAttribute('data-emoji-code'));
                var start = typeof input.selectionStart === 'number' ? input.selectionStart : input.value.length;
                var end = typeof input.selectionEnd === 'number' ? input.selectionEnd : start;
                input.value = input.value.slice(0, start) + emoji + input.value.slice(end);
                if (input.setSelectionRange) input.setSelectionRange(start + emoji.length, start + emoji.length);
                input.dispatchEvent(new Event('input', { bubbles: true }));
                closeEmojiPicker(false);
                input.focus();
            });
            emojiPicker.addEventListener('keydown', function (event) {
                var choices = Array.prototype.slice.call(emojiPicker.querySelectorAll('button'));
                var currentIndex = choices.indexOf(document.activeElement);
                if (currentIndex < 0) return;
                var nextIndex = currentIndex;
                if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % choices.length;
                else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + choices.length) % choices.length;
                else if (event.key === 'ArrowDown') nextIndex = Math.min(currentIndex + 6, choices.length - 1);
                else if (event.key === 'ArrowUp') nextIndex = Math.max(currentIndex - 6, 0);
                else if (event.key === 'Home') nextIndex = 0;
                else if (event.key === 'End') nextIndex = choices.length - 1;
                else return;
                event.preventDefault();
                choices[nextIndex].focus();
            });
        }

        function handleEmojiOutsideClick(event) {
            var picker = win.querySelector('#nchat-emoji-picker');
            if (!picker || !picker.classList.contains('nchat-picker-open')) return;
            if (event.target && event.target.closest && (event.target.closest('#nchat-emoji-picker') || event.target.closest('#nchat-emoji-btn'))) return;
            closeEmojiPicker(false);
        }
        document.addEventListener('click', handleEmojiOutsideClick);
        _globalCleanup.push(function () { document.removeEventListener('click', handleEmojiOutsideClick); });

        if (chatInput) {
            chatInput.addEventListener('input', function () {
                resizeChatInput(chatInput);
                updateSendAvailability();
            });
            chatInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    var text = chatInput.value.trim();
                    if (text) {
                        sendTextMessage(text);
                        resetChatInput(chatInput);
                        updateSendAvailability();
                    }
                }
            });

            // Paste image from clipboard
            chatInput.addEventListener('paste', function (e) {
                var items = (e.clipboardData || e.originalEvent.clipboardData).items;
                for (var i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf('image/') === 0) {
                        e.preventDefault();
                        var blob = items[i].getAsFile();
                        if (blob) uploadFile(blob);
                        return;
                    }
                }
            });
        }

        if (sendBtn) {
            sendBtn.addEventListener('click', function () {
                if (!chatInput) return;
                var text = chatInput.value.trim();
                if (text) {
                    sendTextMessage(text);
                    resetChatInput(chatInput);
                    updateSendAvailability();
                    if (!window.matchMedia || !window.matchMedia('(max-width: 600px)').matches) chatInput.focus();
                }
            });
        }

        var emojiBtn = win.querySelector('#nchat-emoji-btn');
        bindEmojiButton(emojiBtn, chatInput);
        resizeChatInput(chatInput);
        updateSendAvailability();

        // ── File upload button ──
        var fileInput = win.querySelector('#nchat-file-input');
        if (fileInput) {
            fileInput.addEventListener('change', function () {
                if (fileInput.files && fileInput.files[0]) {
                    uploadFile(fileInput.files[0]);
                    fileInput.value = ''; // reset for re-upload
                }
            });
        }

        // ── Offline form submit ──
        var offlineFormEl = win.querySelector('#nchat-offline-form');
        if (offlineFormEl) {
            offlineFormEl.addEventListener('submit', function (e) {
                e.preventDefault();
                var fd = new FormData(offlineFormEl);
                var data = {};
                fd.forEach(function (val, key) { data[key] = val; });
                data.widgetId = id;
                data.visitorId = vid;
                data.timestamp = new Date().toISOString();

                window.__nchat_offline_messages = window.__nchat_offline_messages || [];
                window.__nchat_offline_messages.push(data);

                window.dispatchEvent(new CustomEvent('nchat:offline_message', { detail: data }));

                try {
                    fetch(base + '/api/workspaces/public/widgets/' + id + '/offline-messages', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    }).catch(function () { });
                } catch (ex) { }

                var bodyEl = win.querySelector('#nchat-body');
                bodyEl.innerHTML = '<div class="nchat-offline-msg" style="padding:32px 16px">'
                    + '<div style="font-size:32px;margin-bottom:12px">✉️</div>'
                    + '<div style="font-weight:600;margin-bottom:6px;color:#333">'
                    + (lang === 'vi' ? 'Đã gửi lời nhắn!' : 'Message sent!')
                    + '</div><div>'
                    + (lang === 'vi'
                        ? 'Cảm ơn <strong>' + escapeWidgetHtml(data.name || 'bạn') + '</strong>! Chúng tôi sẽ phản hồi qua email sớm nhất.'
                        : 'Thanks <strong>' + escapeWidgetHtml(data.name || 'you') + '</strong>! We\'ll reply to your email shortly.')
                    + '</div></div>';
            });
        }

        // Hide footer input when offline
        if (!online) {
            var ftrEl = win.querySelector('#nchat-ftr');
            if (ftrEl) ftrEl.style.display = 'none';
        }

        // ── Socket.IO Realtime Connection ──
        var _socket = null;
        var TOKEN_KEY = 'nchat_visitor_token';
        var _visitorToken = '';
        var _typingActors = {};
        var _typingExpiryTimer = null;
        try { _visitorToken = localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { }

        function loadSocketClient(cb) {
            if (window.io) return cb();
            var s = document.createElement('script');
            s.src = base + '/socket.io/socket.io.js'; // served by socket.io server
            s.onload = cb;
            s.onerror = function () { console.warn('[NemarkChat] Socket.IO client load failed — realtime disabled'); };
            document.head.appendChild(s);
        }

        function connectSocket() {
            if (_socket || !online || !_visitorToken || !isValidConversationId(_conversationId)) return;
            loadSocketClient(function () {
                if (_destroyed || !isValidConversationId(_conversationId)) return;
                _socket = io(base + '/visitor', {
                    auth: { token: _visitorToken },
                    query: { conversationId: getRecordId(_conversationId), widgetId: id },
                    transports: ['websocket', 'polling'],
                    reconnection: true,
                    reconnectionDelay: 2000,        // start at 2s
                    reconnectionDelayMax: 30000,     // cap at 30s
                    reconnectionAttempts: Infinity,   // never give up
                    randomizationFactor: 0.5,        // jitter ±50% to avoid thundering herd
                });

                _socket.on('connect', function () {
                    console.log('[NemarkChat] Socket connected:', _socket.id);
                    setConnectionState('online', lang === 'vi' ? 'Đã kết nối thời gian thực' : 'Live connection ready');
                    if (isValidConversationId(_conversationId)) {
                        _socket.emit('join:conversation', { conversationId: _conversationId });

                        // Sync missed messages if reconnecting
                        if (_lastMessageTs) {
                            var syncUrl = conversationUrl(base, _conversationId, '/sync?since=' + encodeURIComponent(_lastMessageTs) + '&visitorId=' + encodeURIComponent(vid));
                            if (!syncUrl) return;
                            fetch(syncUrl)
                                .then(function (r) { return r.json(); })
                                .then(function (res) {
                                    if (res.success && res.data && res.data.length > 0) {
                                        for (var i = 0; i < res.data.length; i++) {
                                            appendMessage(res.data[i]); // dedup + ordering handled inside
                                        }
                                    }
                                })
                                .catch(function () { });
                        }
                    }
                });

                // Incoming message from agent
                _socket.on('message:new', function (msg) {
                    console.log('[NemarkChat] Received message:new payload:', msg);
                    var sender = getMessageSender(msg);
                    if (sender.type !== 'visitor') {
                        // The durable message is the source of truth. Clear any
                        // composing state even if typing:stop was delayed/lost.
                        hideTypingIndicator();
                        appendMessage(msg);
                        notifyNewMessage();
                    } else {
                        appendMessage(msg); // reconcile optimistic visitor message by clientMessageId
                    }
                });

                _socket.on('message:edited', function (msg) {
                    console.log('[NemarkChat] Received message:edited:', msg);
                    var messageId = getRecordId(msg);
                    if (!messageId) return;
                    var el = findRenderedMessage(messageId, msg && msg.clientMessageId);
                    if (el) updateMessageElement(el, msg);
                });

                _socket.on('message:recalled', function (data) {
                    console.log('[NemarkChat] Received message:recalled:', data);
                    var recalledId = data && (data.messageId || getRecordId(data));
                    if (!recalledId) return;
                    var el = findRenderedMessage(String(recalledId), data && data.clientMessageId);
                    if (el) {
                        updateMessageElement(el, { isRecalled: true, sender: { type: 'agent' } });
                    }
                });

                // Typing indicators
                _socket.on('typing:start', function (data) {
                    var typingSender = getMessageSender(data || {});
                    if (typingIndicatorsEnabled && typingSender.type === 'agent') {
                        showTypingIndicator(data || {});
                    }
                });

                _socket.on('typing:stop', function (data) {
                    hideTypingIndicator(data || {});
                });

                // ── Conversation closed by agent ──
                _socket.on('conversation:closed', function () {
                    hideTypingIndicator();
                    closeEmojiPicker(false);
                    clearReplyContext(false);
                    var ftrEl = win.querySelector('#nchat-ftr');
                    if (ftrEl) {
                        ftrEl.innerHTML = '<div style="padding:12px 16px;text-align:center;color:#888;font-size:13px;background:#f3f4f6;border-top:1px solid #eee">'
                            + '🔒 ' + (lang === 'vi' ? 'Cuộc hội thoại đã đóng' : 'Conversation closed') + '</div>';
                    }

                    // ── CSAT Rating ──
                    if (cfg.requestRating) {
                        var bodyEl = win.querySelector('#nchat-body');
                        if (bodyEl) {
                            var csatDiv = document.createElement('div');
                            csatDiv.className = 'nchat-csat';
                            var csatTitle = lang === 'vi' ? 'Bạn đánh giá cuộc hội thoại này thế nào?' : 'How would you rate this conversation?';
                            var starSvg = '<svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
                            csatDiv.innerHTML = '<div class="nchat-csat-title">' + csatTitle + '</div>'
                                + '<div class="nchat-csat-stars">'
                                + '<button class="nchat-csat-star" data-rating="1">' + starSvg + '</button>'
                                + '<button class="nchat-csat-star" data-rating="2">' + starSvg + '</button>'
                                + '<button class="nchat-csat-star" data-rating="3">' + starSvg + '</button>'
                                + '<button class="nchat-csat-star" data-rating="4">' + starSvg + '</button>'
                                + '<button class="nchat-csat-star" data-rating="5">' + starSvg + '</button>'
                                + '</div>'
                                + '<div class="nchat-csat-thanks">' + (lang === 'vi' ? 'Cảm ơn bạn đã đánh giá! ⭐' : 'Thank you for your feedback! ⭐') + '</div>';
                            bodyEl.appendChild(csatDiv);
                            bodyEl.scrollTop = bodyEl.scrollHeight;

                            // Star click handlers
                            var stars = csatDiv.querySelectorAll('.nchat-csat-star');
                            for (var si = 0; si < stars.length; si++) {
                                stars[si].addEventListener('click', function () {
                                    var rating = parseInt(this.getAttribute('data-rating'));
                                    // Highlight stars up to selected
                                    for (var sj = 0; sj < stars.length; sj++) {
                                        if (sj < rating) stars[sj].classList.add('nchat-star-active');
                                        else stars[sj].classList.remove('nchat-star-active');
                                        stars[sj].style.pointerEvents = 'none'; // disable re-click
                                    }
                                    // Show thanks
                                    var thanks = csatDiv.querySelector('.nchat-csat-thanks');
                                    if (thanks) thanks.style.display = 'block';
                                    // Emit rating
                                    if (_socket && _socket.connected && isValidConversationId(_conversationId)) {
                                        _socket.emit('conversation:rate', { conversationId: _conversationId, rating: rating });
                                    }
                                });
                            }
                        }
                    }
                });

                // ── Conversation reopened by agent ──
                _socket.on('conversation:reopened', function () {
                    var ftrEl = win.querySelector('#nchat-ftr');
                    if (ftrEl) {
                        ftrEl.innerHTML = '<button type="button" id="nchat-emoji-btn" aria-label="Emoji" aria-expanded="false" aria-controls="nchat-emoji-picker">' + emojiIcon + '</button>'
                            + '<label id="nchat-upload-btn" aria-label="Upload">' + attachIcon + '<input type="file" id="nchat-file-input" accept="image/*,.pdf,.doc,.docx" style="display:none" /></label>'
                            + '<textarea id="nchat-input" maxlength="4000" autocomplete="off" enterkeyhint="send" rows="1" placeholder="' + escapeWidgetHtml(placeholder) + '"></textarea>'
                            + '<button id="nchat-send" aria-label="Send" disabled>' + sendIcon + '</button>';
                        // Re-attach send handlers
                        var inp2 = ftrEl.querySelector('#nchat-input');
                        var btn2 = ftrEl.querySelector('#nchat-send');
                        function updateReopenedSend() {
                            if (btn2) btn2.disabled = !inp2 || !inp2.value.trim();
                        }
                        if (btn2) btn2.addEventListener('click', function () {
                            if (inp2 && inp2.value.trim()) {
                                sendTextMessage(inp2.value.trim());
                                resetChatInput(inp2);
                                updateReopenedSend();
                            }
                        });
                        if (inp2) {
                            inp2.addEventListener('input', function () { resizeChatInput(inp2); updateReopenedSend(); });
                            inp2.addEventListener('keydown', function (e) {
                                if (e.key === 'Enter' && !e.shiftKey && inp2.value.trim()) {
                                    e.preventDefault();
                                    sendTextMessage(inp2.value.trim());
                                    resetChatInput(inp2);
                                    updateReopenedSend();
                                }
                            });
                        }
                        bindEmojiButton(ftrEl.querySelector('#nchat-emoji-btn'), inp2);
                        updateReopenedSend();
                    }
                });

                _socket.on('connect_error', function () {
                    hideTypingIndicator();
                });

                _socket.on('error', function () {
                    hideTypingIndicator();
                });

                _socket.on('disconnect', function (reason) {
                    hideTypingIndicator();
                    console.log('[NemarkChat] Socket disconnected:', reason);
                    if (!_destroyed) setConnectionState('loading', lang === 'vi' ? 'Đang kết nối lại…' : 'Reconnecting…');
                });
            });
        }

        // Typing indicator UI helpers
        function getTypingActorKey(data) {
            var sender = getMessageSender(data || {});
            return String((data && data.typingId) || (sender.type + ':' + (sender.id || sender.name || 'support')));
        }

        function showTypingIndicator(data) {
            var bodyEl = win.querySelector('#nchat-body');
            if (!bodyEl) return;
            _typingActors[getTypingActorKey(data)] = true;
            var configuredLabel = data && typeof data.label === 'string'
                ? data.label.replace(/\s+/g, ' ').trim().slice(0, 40)
                : '';
            var typingLabel = configuredLabel || (lang === 'vi' ? 'Đang phản hồi…' : 'Typing…');

            if (_typingExpiryTimer) clearTimeout(_typingExpiryTimer);
            _typingExpiryTimer = setTimeout(function () {
                hideTypingIndicator();
            }, 15000);

            var existing = bodyEl.querySelector('.nchat-typing');
            if (existing) {
                var existingLabel = existing.querySelector('.nchat-typing-label');
                if (existingLabel) existingLabel.textContent = typingLabel;
                existing.setAttribute('aria-label', typingLabel);
                bodyEl.scrollTop = bodyEl.scrollHeight;
                return;
            }

            var div = document.createElement('div');
            div.className = 'nchat-msg nchat-msg-bot nchat-typing';
            div.setAttribute('role', 'status');
            div.setAttribute('aria-label', typingLabel);
            var bubble = document.createElement('div');
            bubble.className = 'nchat-msg-bubble';
            var dots = document.createElement('div');
            dots.className = 'nchat-dots';
            dots.innerHTML = '<span></span><span></span><span></span>';
            var label = document.createElement('span');
            label.className = 'nchat-typing-label';
            label.textContent = typingLabel;
            bubble.appendChild(dots);
            bubble.appendChild(label);
            div.appendChild(bubble);
            bodyEl.appendChild(div);
            bodyEl.scrollTop = bodyEl.scrollHeight;
        }

        function hideTypingIndicator(data) {
            if (data && Object.keys(data).length > 0) {
                delete _typingActors[getTypingActorKey(data)];
                if (Object.keys(_typingActors).length > 0) return;
            } else {
                _typingActors = {};
            }

            if (_typingExpiryTimer) {
                clearTimeout(_typingExpiryTimer);
                _typingExpiryTimer = null;
            }
            var bodyEl = win.querySelector('#nchat-body');
            if (!bodyEl) return;
            var el = bodyEl.querySelector('.nchat-typing');
            if (el) el.remove();
        }

        // Connect socket if we already have a token (resume)
        if (_visitorToken) connectSocket();

        // ── Expose API ──
        var globalObjName = typeof window.NemarkChat === 'string' ? window.NemarkChat : 'NemarkChat';
        var apiObj = window[globalObjName] || {};
        apiObj.open = function () { toggleChat(true); };
        apiObj.close = function () { toggleChat(false); };
        apiObj.toggle = function () { toggleChat(); };
        apiObj.widgetId = id;
        apiObj.visitorId = vid;
        apiObj.isOnline = online;
        apiObj.sendMessage = sendTextMessage;
        apiObj.uploadFile = uploadFile;
        apiObj.socket = function () { return _socket; };
        apiObj.destroy = function () {
            if (_destroyed) return;
            _destroyed = true;
            window.__nchat_destroyed = true;
            hideTypingIndicator();
            if (_connectionStateTimer) clearTimeout(_connectionStateTimer);
            for (var cleanupIndex = 0; cleanupIndex < _globalCleanup.length; cleanupIndex++) {
                try { _globalCleanup[cleanupIndex](); } catch (e) { }
            }
            _globalCleanup = [];
            if (_socket) {
                try { if (_socket.removeAllListeners) _socket.removeAllListeners(); } catch (e) { }
                try { _socket.disconnect(); } catch (e) { }
                _socket = null;
            }
            if (__audioCtx && __audioCtx.close) {
                try { __audioCtx.close(); } catch (e) { }
                __audioCtx = null;
            }
            document.title = originalTitle;
            [
                'nchat-bubble', 'nchat-window', 'nchat-tooltip', 'nchat-greeting',
                'nchat-styles', 'nchat-marketing-popup', 'nchat-marketing-style',
                'nchat-fallback-bubble', 'nchat-fallback-tip', 'nchat-fallback-styles'
            ].forEach(function (elementId) {
                var element = document.getElementById(elementId);
                if (element) element.remove();
            });
            var previews = document.querySelectorAll('.nchat-img-preview');
            for (var previewIndex = 0; previewIndex < previews.length; previewIndex++) previews[previewIndex].remove();
            _rendered = false;
            window.__nchat_loaded = false;
        };
        window[globalObjName] = apiObj;
    }
})();
