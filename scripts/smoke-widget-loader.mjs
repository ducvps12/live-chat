import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer';

const loaderPath = path.join(process.cwd(), 'public', 'widget', 'loader.js');
const loaderSource = await readFile(loaderPath, 'utf8');

const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>
<main style="min-height:150vh">Host page</main>
<script>
window.__nchatSocketHandlers = {};
window.io = function () {
  const handlers = window.__nchatSocketHandlers;
  const socket = {
    connected: true,
    id: 'socket-smoke',
    on(event, callback) {
      (handlers[event] = handlers[event] || []).push(callback);
      if (event === 'connect') setTimeout(() => callback(), 0);
      return socket;
    },
    emit() { return socket; },
    disconnect() { socket.connected = false; }
  };
  window.__nchatTestSocket = socket;
  return socket;
};
window.__emitNchatSocket = function (event, payload) {
  (window.__nchatSocketHandlers[event] || []).forEach((handler) => handler(payload));
};
if (!window.__prechatMode) {
  localStorage.setItem('nchat_conv_widget-smoke', 'conversation-smoke');
  localStorage.setItem('nchat_visitor_token', 'visitor-token-smoke');
}
const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = String(input);
  if (url.includes('/config')) return new Response(JSON.stringify({success:true,data:{
    name:'NemarkChat Hỗ trợ', workspaceId:'workspace-test', config:{
      primaryColor:'#2563eb',position:'bottom-right',language:'vi',greeting:'Xin chào!',showTypingIndicator:true,
      preChatForm: window.__prechatMode ? {enabled:true,title:'Bắt đầu hỗ trợ',fields:[
        {key:'name',label:'Họ tên',type:'text',required:true,enabled:true},
        {key:'email',label:'Email',type:'email',required:true,enabled:true},
        {key:'goal',label:'Nhu cầu',type:'select',required:true,enabled:true,options:['Tư vấn','Báo giá']}
      ]} : {enabled:false,fields:[]}
    }, domainRules:{domains:[]}, businessHours:{enabled:false}
  }}), {status:200,headers:{'content-type':'application/json'}});
  if (url.includes('/api/conversations/public/find-or-create')) return new Response(JSON.stringify({success:true,data:{
    conversation:{id:'conversation-smoke'}, visitorToken:'visitor-token-smoke', messages:[], totalMessages:0
  }}), {status:200,headers:{'content-type':'application/json'}});
  if (url.includes('/api/conversations/public/conversation-smoke/messages')) {
    const method = String(init?.method || 'GET').toUpperCase();
    if (method === 'POST') {
      const payload = JSON.parse(String(init?.body || '{}'));
      window.__lastSentMessage = payload;
      return new Response(JSON.stringify({success:true,data:{
        id:'visitor-reply-smoke',
        clientMessageId:payload.clientMessageId,
        senderType:'visitor',
        senderName:'Khách',
        content:payload.content,
        type:payload.type,
        replyTo:payload.replyTo,
        status:'sent',
        createdAt:new Date().toISOString()
      }}), {status:200,headers:{'content-type':'application/json'}});
    }
    return new Response(JSON.stringify({success:true,data:{items:[],total:0}}), {status:200,headers:{'content-type':'application/json'}});
  }
  if (url.includes('/api/conversations/public/visitor/')) return new Response(JSON.stringify({success:true,data:[
    {
      id:'conversation-smoke',
      status:'open',
      lastMessageSnippet:'Conversation fixture one',
      lastMessageAt:'2026-07-31T08:30:00.000Z',
      updatedAt:'2026-07-31T08:30:00.000Z'
    },
    {
      id:'conversation-followup',
      status:'open',
      lastMessageSnippet:'Conversation fixture two',
      lastMessageAt:'2026-07-30T08:30:00.000Z',
      updatedAt:'2026-07-30T08:30:00.000Z'
    }
  ]}), {status:200,headers:{'content-type':'application/json'}});
  if (url.includes('/popups')) return new Response(JSON.stringify({success:true,data:[]}), {status:200,headers:{'content-type':'application/json'}});
  return nativeFetch(input, init);
};
</script>
<script data-widget-id="widget-smoke" data-api-base="__ORIGIN__">${loaderSource.replaceAll('</script>', '<\\/script>')}</script>
</body></html>`;

const server = http.createServer((request, response) => {
  response.writeHead(200, {'content-type':'text/html; charset=utf-8'});
  const requestOrigin = `http://${request.headers.host}`;
  response.end(html.replace('__ORIGIN__', requestOrigin));
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const origin = `http://127.0.0.1:${address.port}`;
console.log('Widget smoke server ready');
const browser = await puppeteer.launch({headless:true, args:['--no-sandbox','--disable-setuid-sandbox','--disable-gpu']});
console.log('Headless browser ready');

try {
  const page = await browser.newPage();
  page.on('console', (message) => console.log(`[browser:${message.type()}] ${message.text()}`));
  page.on('pageerror', (error) => console.error(`[browser:error] ${error.message}`));
  await page.setViewport({width:1280,height:800});
  console.log('Opening widget fixture');
  await page.goto(origin, {waitUntil:'domcontentloaded', timeout:5000}).catch(() => undefined);
  console.log('Widget fixture opened');
  await page.waitForSelector('#nchat-bubble', {timeout:5000}).catch(async (error) => {
    const debug = await page.evaluate(() => ({loaded:window.__nchat_loaded,destroyed:window.__nchat_destroyed,scripts:[...document.scripts].map((item) => ({src:item.src,widget:item.dataset.widgetId})),html:document.body.innerHTML.slice(-800)}));
    throw new Error(`launcher did not render: ${JSON.stringify(debug)}`, {cause:error});
  });

  const assertState = async (label, predicate) => {
    const state = await page.evaluate(() => ({
      bubbles: document.querySelectorAll('#nchat-bubble').length,
      windows: document.querySelectorAll('#nchat-window').length,
      open: document.querySelector('#nchat-window')?.classList.contains('nchat-open') || false,
      bubbleVisibility: getComputedStyle(document.querySelector('#nchat-bubble')).visibility,
      bubbleOpacity: getComputedStyle(document.querySelector('#nchat-bubble')).opacity,
      bubblePointerEvents: getComputedStyle(document.querySelector('#nchat-bubble')).pointerEvents,
      bodyOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));
    if (!predicate(state)) throw new Error(`${label}: ${JSON.stringify(state)}`);
  };

  await assertState('closed launcher', (s) => s.bubbles === 1 && s.windows === 1 && !s.open && s.bubbleVisibility === 'visible' && !s.bodyOverflowX);
  await page.click('#nchat-bubble');
  await page.waitForSelector('#nchat-window.nchat-open');
  await new Promise((resolve) => setTimeout(resolve, 400));
  await assertState('opened widget', (s) => s.open && s.bubbleVisibility === 'hidden' && s.bubbleOpacity === '0' && s.bubblePointerEvents === 'none');

  await page.waitForFunction(() => (
    document.querySelectorAll('#nchat-window.show-list .nchat-list-item').length === 2
  ));
  const conversationListLayout = await page.evaluate(() => {
    const px = (value) => Number.parseFloat(value) || 0;
    const list = document.querySelector('.nchat-list-items');
    const intro = document.querySelector('.nchat-list-intro');
    const introTitle = document.querySelector('.nchat-list-intro-title');
    const items = [...document.querySelectorAll('.nchat-list-item')];
    const footer = document.querySelector('.nchat-list-footer');
    const status = document.querySelector('.nchat-list-status');
    const listStyle = getComputedStyle(list);
    const introStyle = getComputedStyle(intro);
    const introTitleStyle = getComputedStyle(introTitle);
    const itemStyle = getComputedStyle(items[0]);
    const footerStyle = getComputedStyle(footer);
    const statusStyle = getComputedStyle(status);
    const introRect = intro.getBoundingClientRect();
    const firstRect = items[0].getBoundingClientRect();
    const secondRect = items[1].getBoundingClientRect();
    return {
      itemCount: items.length,
      listPaddingTop: px(listStyle.paddingTop),
      listPaddingRight: px(listStyle.paddingRight),
      listPaddingBottom: px(listStyle.paddingBottom),
      listPaddingLeft: px(listStyle.paddingLeft),
      listGap: px(listStyle.rowGap),
      introPaddingBottom: px(introStyle.paddingBottom),
      introTitleMarginBottom: px(introTitleStyle.marginBottom),
      itemPaddingTop: px(itemStyle.paddingTop),
      itemPaddingRight: px(itemStyle.paddingRight),
      itemPaddingBottom: px(itemStyle.paddingBottom),
      itemPaddingLeft: px(itemStyle.paddingLeft),
      itemRadius: px(itemStyle.borderTopLeftRadius),
      itemMinHeight: px(itemStyle.minHeight),
      introToFirstGap: firstRect.top - introRect.bottom,
      cardGap: secondRect.top - firstRect.bottom,
      footerPaddingTop: px(footerStyle.paddingTop),
      footerPaddingRight: px(footerStyle.paddingRight),
      footerPaddingBottom: px(footerStyle.paddingBottom),
      footerPaddingLeft: px(footerStyle.paddingLeft),
      statusPaddingLeft: px(statusStyle.paddingLeft),
      statusPaddingRight: px(statusStyle.paddingRight),
    };
  });
  const listLayoutMinimums = {
    itemCount: 2,
    listPaddingTop: 16,
    listPaddingRight: 14,
    listPaddingBottom: 10,
    listPaddingLeft: 14,
    listGap: 10,
    introPaddingBottom: 4,
    introTitleMarginBottom: 4,
    itemPaddingTop: 10,
    itemPaddingRight: 10,
    itemPaddingBottom: 10,
    itemPaddingLeft: 10,
    itemRadius: 14,
    itemMinHeight: 64,
    introToFirstGap: 10,
    cardGap: 10,
    footerPaddingTop: 10,
    footerPaddingRight: 14,
    footerPaddingBottom: 12,
    footerPaddingLeft: 14,
    statusPaddingLeft: 5,
    statusPaddingRight: 5,
  };
  const listLayoutFailures = Object.entries(listLayoutMinimums)
    .filter(([property, minimum]) => conversationListLayout[property] < minimum)
    .map(([property, minimum]) => `${property}=${conversationListLayout[property]} (expected >= ${minimum})`);
  if (listLayoutFailures.length > 0) {
    throw new Error(`conversation list spacing regression: ${listLayoutFailures.join(', ')}`);
  }
  if (process.env.WIDGET_SCREENSHOT_PATH) {
    const widgetWindow = await page.$('#nchat-window');
    await widgetWindow.screenshot({path:process.env.WIDGET_SCREENSHOT_PATH});
    console.log(`Widget screenshot saved to ${process.env.WIDGET_SCREENSHOT_PATH}`);
  }

  await page.click('#nchat-hdr-minimize');
  await new Promise((resolve) => setTimeout(resolve, 80));
  const minimized = await page.evaluate(() => {
    const windowElement = document.querySelector('#nchat-window');
    const rect = windowElement.getBoundingClientRect();
    return {mode:windowElement.dataset.windowMode,height:rect.height,listItems:document.querySelectorAll('.nchat-list-item').length};
  });
  if (minimized.mode !== 'minimized' || minimized.height > 120 || minimized.listItems !== 2) {
    throw new Error(`minimized window regression: ${JSON.stringify(minimized)}`);
  }
  await page.click('#nchat-hdr-minimize');

  await page.click('#nchat-hdr-size');
  await new Promise((resolve) => setTimeout(resolve, 320));
  const maximized = await page.evaluate(() => {
    const windowElement = document.querySelector('#nchat-window');
    const rect = windowElement.getBoundingClientRect();
    return {mode:windowElement.dataset.windowMode,width:rect.width,height:rect.height,pressed:document.querySelector('#nchat-hdr-size').getAttribute('aria-pressed')};
  });
  if (maximized.mode !== 'maximized' || maximized.width < 600 || maximized.height < 650 || maximized.pressed !== 'true') {
    throw new Error(`maximized window regression: ${JSON.stringify(maximized)}`);
  }
  await page.click('#nchat-hdr-size');
  await new Promise((resolve) => setTimeout(resolve, 320));

  const resizeStart = await page.$eval('#nchat-resize-handle', (element) => {
    const handle = element.getBoundingClientRect();
    const widget = document.querySelector('#nchat-window').getBoundingClientRect();
    return {x:handle.left + handle.width / 2,y:handle.top + handle.height / 2,width:widget.width,height:widget.height};
  });
  await page.mouse.move(resizeStart.x, resizeStart.y);
  await page.mouse.down();
  await page.mouse.move(resizeStart.x - 48, resizeStart.y - 36, {steps:4});
  await page.mouse.up();
  const resized = await page.evaluate(() => {
    const rect = document.querySelector('#nchat-window').getBoundingClientRect();
    return {width:rect.width,height:rect.height,saved:JSON.parse(localStorage.getItem('nchat_window_size_widget-smoke') || 'null')};
  });
  if (resized.width <= resizeStart.width || resized.height <= resizeStart.height || !resized.saved) {
    throw new Error(`drag resize regression: ${JSON.stringify({resizeStart,resized})}`);
  }
  await page.click('#nchat-resize-handle', {clickCount:2});
  await new Promise((resolve) => setTimeout(resolve, 80));

  await page.click('.nchat-list-item[data-id="conversation-smoke"]');
  await page.waitForSelector('#nchat-window.show-chat #nchat-input');
  await page.waitForFunction(() => document.querySelector('#nchat-body')?.textContent?.trim() !== '...');

  await page.waitForFunction(() => typeof window.__emitNchatSocket === 'function' && Boolean(window.__nchatTestSocket));
  await page.evaluate(() => {
    window.__emitNchatSocket('typing:start', {
      conversationId: 'conversation-smoke',
      typingId: 'auto-reply:message-smoke',
      label: 'Đang kiểm tra giúp bạn…',
      sender: {type:'agent',id:'auto-reply',name:'Hỗ trợ khách hàng'}
    });
  });
  await page.waitForSelector('.nchat-typing .nchat-typing-label');
  const typingCopy = await page.$eval('.nchat-typing .nchat-typing-label', (element) => element.textContent);
  if (typingCopy !== 'Đang kiểm tra giúp bạn…') throw new Error(`unexpected typing copy: ${typingCopy}`);

  await page.evaluate(() => {
    window.__emitNchatSocket('typing:start', {
      conversationId: 'conversation-smoke',
      sender: {type:'agent',id:'human-agent-smoke',name:'Mai'}
    });
    window.__emitNchatSocket('typing:stop', {
      conversationId: 'conversation-smoke',
      typingId: 'auto-reply:message-smoke',
      sender: {type:'agent',id:'auto-reply',name:'Hỗ trợ khách hàng'}
    });
  });
  if (!await page.$('.nchat-typing')) throw new Error('one typing actor stopped the remaining active actor');

  await page.evaluate(() => {
    window.__emitNchatSocket('message:new', {
      id: 'agent-message-smoke',
      senderType: 'agent',
      senderId: 'agent-smoke',
      senderName: 'Hỗ trợ khách hàng',
      content: 'Mình đang kiểm tra giúp bạn nhé.',
      type: 'text',
      createdAt: new Date().toISOString()
    });
  });
  await page.waitForFunction(() => !document.querySelector('.nchat-typing'));
  const receivedReply = await page.$eval('[data-msg-id="agent-message-smoke"] .nchat-msg-bubble', (element) => element.textContent);
  if (!receivedReply.includes('Mình đang kiểm tra')) throw new Error(`agent reply did not render: ${receivedReply}`);

  await page.click('#nchat-emoji-btn');
  await page.waitForSelector('#nchat-emoji-picker.nchat-picker-open');
  const emojiPickerState = await page.evaluate(() => ({
    count: document.querySelectorAll('#nchat-emoji-picker [data-emoji-code]').length,
    expanded: document.querySelector('#nchat-emoji-btn')?.getAttribute('aria-expanded'),
  }));
  if (emojiPickerState.count < 20 || emojiPickerState.expanded !== 'true') {
    throw new Error(`emoji picker regression: ${JSON.stringify(emojiPickerState)}`);
  }
  await page.click('#nchat-emoji-picker [data-emoji-code]');
  const emojiInsertState = await page.evaluate(() => ({
    value: document.querySelector('#nchat-input')?.value || '',
    open: document.querySelector('#nchat-emoji-picker')?.classList.contains('nchat-picker-open') || false,
    expanded: document.querySelector('#nchat-emoji-btn')?.getAttribute('aria-expanded'),
  }));
  if (!emojiInsertState.value || emojiInsertState.open || emojiInsertState.expanded !== 'false') {
    throw new Error(`emoji insertion regression: ${JSON.stringify(emojiInsertState)}`);
  }
  await page.$eval('#nchat-input', (input) => {
    input.value = '';
    input.dispatchEvent(new Event('input', {bubbles:true}));
  });

  await page.hover('[data-msg-id="agent-message-smoke"]');
  await page.click('[data-msg-id="agent-message-smoke"] .nchat-reply-action');
  await page.waitForSelector('#nchat-reply-preview.nchat-reply-visible');
  const replyPreview = await page.$eval('#nchat-reply-preview', (element) => element.textContent || '');
  if (!replyPreview.includes('Mình đang kiểm tra')) throw new Error(`reply preview regression: ${replyPreview}`);
  await page.type('#nchat-input', 'Cam on ban nhe');
  await page.click('#nchat-send');
  await page.waitForFunction(() => Boolean(window.__lastSentMessage?.replyTo));
  const replyPost = await page.evaluate(() => ({
    payload: window.__lastSentMessage,
    previewVisible: document.querySelector('#nchat-reply-preview')?.classList.contains('nchat-reply-visible') || false,
  }));
  if (replyPost.payload.content !== 'Cam on ban nhe'
      || replyPost.payload.replyTo?.messageId !== 'agent-message-smoke'
      || !replyPost.payload.replyTo?.content
      || !replyPost.payload.replyTo?.senderName
      || replyPost.previewVisible) {
    throw new Error(`reply POST contract regression: ${JSON.stringify(replyPost)}`);
  }
  await page.waitForSelector('[data-msg-id="visitor-reply-smoke"] .nchat-msg-quote');
  const replyQuote = await page.$eval('[data-msg-id="visitor-reply-smoke"] .nchat-msg-quote', (element) => ({
    target: element.getAttribute('data-reply-message-id'),
    copy: element.textContent || '',
  }));
  if (replyQuote.target !== 'agent-message-smoke' || !replyQuote.copy) {
    throw new Error(`reply quote regression: ${JSON.stringify(replyQuote)}`);
  }

  await page.evaluate(() => {
    window.__emitNchatSocket('typing:start', {
      conversationId: 'conversation-smoke',
      sender: {type:'agent',id:'agent-smoke',name:'Hỗ trợ khách hàng'}
    });
    window.__emitNchatSocket('connect_error', new Error('test disconnect'));
  });
  await page.waitForFunction(() => !document.querySelector('.nchat-typing'));

  await page.click('#nchat-hdr-close');
  await new Promise((resolve) => setTimeout(resolve, 400));
  await assertState('closed widget', (s) => !s.open && s.bubbleVisibility === 'visible');

  await page.evaluate((source) => {
    const script = document.createElement('script');
    script.dataset.widgetId = 'widget-smoke';
    script.dataset.apiBase = location.origin;
    script.textContent = source;
    document.head.appendChild(script);
  }, loaderSource);
  await new Promise((resolve) => setTimeout(resolve, 100));
  await assertState('duplicate guard', (s) => s.bubbles === 1 && s.windows === 1);

  await page.setViewport({width:390,height:700});
  await page.click('#nchat-bubble');
  await page.waitForSelector('#nchat-window.nchat-open');
  await new Promise((resolve) => setTimeout(resolve, 350));
  const mobile = await page.evaluate(() => {
    const rect = document.querySelector('#nchat-window').getBoundingClientRect();
    const handle = document.querySelector('#nchat-resize-handle');
    return {
      width:rect.width,
      height:rect.height,
      viewportWidth:innerWidth,
      viewportHeight:innerHeight,
      mode:document.querySelector('#nchat-window').dataset.windowMode,
      resizeVisible:handle ? getComputedStyle(handle).display !== 'none' : false,
    };
  });
  if (Math.abs(mobile.width - mobile.viewportWidth) > 1
      || Math.abs(mobile.height - mobile.viewportHeight) > 1
      || mobile.mode !== 'normal'
      || mobile.resizeVisible) {
    throw new Error(`mobile fullscreen regression: ${JSON.stringify(mobile)}`);
  }
  await page.click('#nchat-hdr-minimize');
  await new Promise((resolve) => setTimeout(resolve, 320));
  const mobileMinimized = await page.evaluate(() => {
    const widget = document.querySelector('#nchat-window');
    const rect = widget.getBoundingClientRect();
    return {mode:widget.dataset.windowMode,width:rect.width,height:rect.height,viewportWidth:innerWidth};
  });
  if (mobileMinimized.mode !== 'minimized'
      || Math.abs(mobileMinimized.width - (mobileMinimized.viewportWidth - 24)) > 1
      || mobileMinimized.height > 120) {
    throw new Error(`mobile minimize regression: ${JSON.stringify(mobileMinimized)}`);
  }
  await page.click('#nchat-hdr-minimize');
  await new Promise((resolve) => setTimeout(resolve, 320));
  const mobileRestored = await page.evaluate(() => {
    const widget = document.querySelector('#nchat-window');
    const rect = widget.getBoundingClientRect();
    return {mode:widget.dataset.windowMode,width:rect.width,height:rect.height,viewportWidth:innerWidth,viewportHeight:innerHeight};
  });
  if (mobileRestored.mode !== 'normal'
      || Math.abs(mobileRestored.width - mobileRestored.viewportWidth) > 1
      || Math.abs(mobileRestored.height - mobileRestored.viewportHeight) > 1) {
    throw new Error(`mobile restore regression: ${JSON.stringify(mobileRestored)}`);
  }

  // A first-time visitor should see only one prompt at a time, while the final
  // payload still contains every configured field.
  const prechatPage = await browser.newPage();
  await prechatPage.evaluateOnNewDocument(() => {
    window.__prechatMode = true;
    localStorage.clear();
  });
  await prechatPage.setViewport({width:390,height:760});
  await prechatPage.goto(origin, {waitUntil:'domcontentloaded', timeout:5000});
  await prechatPage.waitForSelector('#nchat-bubble');
  await prechatPage.click('#nchat-bubble');
  await prechatPage.waitForSelector('#nchat-pcf');
  const initialPrechat = await prechatPage.evaluate(() => ({
    steps: document.querySelectorAll('#nchat-pcf .nchat-pcf-step').length,
    active: document.querySelector('#nchat-pcf .nchat-pcf-step.is-active')?.getAttribute('data-pcf-step'),
    visibleControls: [...document.querySelectorAll('#nchat-pcf .nchat-pcf-step.is-active input, #nchat-pcf .nchat-pcf-step.is-active select')].map((item) => item.getAttribute('name')),
    submitHidden: document.querySelector('#nchat-pcf button[type="submit"]')?.hidden,
  }));
  if (initialPrechat.steps !== 2 || initialPrechat.active !== '1' || initialPrechat.visibleControls.join(',') !== 'name' || !initialPrechat.submitHidden) {
    throw new Error(`progressive pre-chat initial-state regression: ${JSON.stringify(initialPrechat)}`);
  }
  const nextButtonState = await prechatPage.$eval('#nchat-pcf-next', (next) => ({
    hidden: next.hidden,
    display: getComputedStyle(next).display,
    visibility: getComputedStyle(next).visibility,
    rect: next.getBoundingClientRect().toJSON(),
    parent: next.parentElement?.getBoundingClientRect().toJSON(),
    form: next.closest('form')?.getBoundingClientRect().toJSON(),
  }));
  if (nextButtonState.hidden || nextButtonState.display === 'none' || nextButtonState.rect.height === 0) {
    throw new Error(`progressive pre-chat next button is not interactable: ${JSON.stringify(nextButtonState)}`);
  }
  await prechatPage.click('#nchat-pcf-next');
  await prechatPage.waitForSelector('#nchat-pcf [name="name"].nchat-invalid');
  await prechatPage.type('#nchat-pcf [name="name"]', 'Lan');
  await prechatPage.click('#nchat-pcf-next');
  await prechatPage.waitForSelector('#nchat-pcf [data-pcf-step="2"].is-active');
  await prechatPage.click('#nchat-pcf .nchat-pcf-back');
  await prechatPage.waitForSelector('#nchat-pcf [data-pcf-step="1"].is-active');
  await prechatPage.click('#nchat-pcf-next');
  await prechatPage.waitForSelector('#nchat-pcf [data-pcf-step="2"].is-active');
  await prechatPage.type('#nchat-pcf [name="email"]', 'lan@example.com');
  await prechatPage.select('#nchat-pcf [name="goal"]', 'Báo giá');
  await prechatPage.waitForFunction(() => {
    const submit = document.querySelector('#nchat-pcf button[type="submit"]');
    return Boolean(submit && !submit.hidden && getComputedStyle(submit).display !== 'none' && submit.getBoundingClientRect().height > 0);
  });
  await prechatPage.click('#nchat-pcf button[type="submit"]');
  await prechatPage.waitForFunction(() => Boolean(window.__nchat_visitor?.name));
  await prechatPage.waitForFunction(() => !document.querySelector('#nchat-window')?.classList.contains('nchat-awaiting-profile'));
  const completedPrechat = await prechatPage.evaluate(() => ({
    visitor: window.__nchat_visitor,
    persisted: JSON.parse(localStorage.getItem('nchat_visitor_session') || 'null'),
    awaitingProfile: document.querySelector('#nchat-window')?.classList.contains('nchat-awaiting-profile') || false,
  }));
  if (completedPrechat.visitor.name !== 'Lan'
      || completedPrechat.visitor.email !== 'lan@example.com'
      || completedPrechat.visitor.goal !== 'Báo giá'
      || completedPrechat.persisted?.info?.goal !== 'Báo giá'
      || completedPrechat.awaitingProfile) {
    throw new Error(`progressive pre-chat payload regression: ${JSON.stringify(completedPrechat)}`);
  }

  console.log('Widget loader smoke passed');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
