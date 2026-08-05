import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import puppeteer from 'puppeteer';

const portProbe = net.createServer();
await new Promise((resolve, reject) => {
  portProbe.once('error', reject);
  portProbe.listen(0, '127.0.0.1', resolve);
});
const probeAddress = portProbe.address();
if (!probeAddress || typeof probeAddress === 'string') throw new Error('Could not reserve a smoke-test port');
const port = probeAddress.port;
await new Promise((resolve, reject) => portProbe.close((error) => error ? reject(error) : resolve()));
const origin = `http://127.0.0.1:${port}`;
const nextBin = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');
const server = spawn(process.execPath, [nextBin, 'start', '-p', String(port)], {
  cwd: process.cwd(),
  env: {...process.env, NODE_ENV:'production'},
  stdio:['ignore','pipe','pipe'],
});

let serverOutput = '';
server.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
server.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });

async function waitForServer() {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(origin, {redirect:'manual'});
      if (response.status < 500) return;
    } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Next server did not start:\n${serverOutput}`);
}

const routes = [
  '/', '/404', '/about', '/acceptable-use', '/admin', '/auth/forgot-password',
  '/auth/login', '/auth/register', '/auth/reset-password', '/blog', '/changelog',
  '/contact', '/data-processing', '/help', '/panel', '/panel/users/user-smoke',
  '/privacy', '/profile', '/refund', '/security', '/status', '/terms', '/workspace',
  '/w/demo', '/w/demo/page', '/workspace/workspace-smoke',
  '/workspace/workspace-smoke/analytics', '/workspace/workspace-smoke/analytics/live',
  '/workspace/workspace-smoke/analytics/settings', '/workspace/workspace-smoke/bank',
  '/workspace/workspace-smoke/billing', '/workspace/workspace-smoke/business-hours',
  '/workspace/workspace-smoke/campaigns', '/workspace/workspace-smoke/channels',
  '/workspace/workspace-smoke/chatbot', '/workspace/workspace-smoke/contacts',
  '/workspace/workspace-smoke/distribution', '/workspace/workspace-smoke/email',
  '/workspace/workspace-smoke/inbox', '/workspace/workspace-smoke/knowledge',
  '/workspace/workspace-smoke/leads', '/workspace/workspace-smoke/macros',
  '/workspace/workspace-smoke/orders', '/workspace/workspace-smoke/payment/invoice-smoke',
  '/workspace/workspace-smoke/popups', '/workspace/workspace-smoke/products',
  '/workspace/workspace-smoke/remote-session', '/workspace/workspace-smoke/settings',
  '/workspace/workspace-smoke/teams', '/workspace/workspace-smoke/widgets',
];
const visualRoutes = ['/', '/auth/login', '/auth/register'];

await waitForServer();
const browser = await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-gpu']});
const failures = [];
const results = await Promise.all(routes.map(async (route) => {
  try {
    const response = await fetch(`${origin}${route}`, {redirect:'follow'});
    await response.arrayBuffer();
    const ok = response.status < 500;
    if (!ok) failures.push({route,status:response.status,check:'http'});
    return {route,status:response.status,ok};
  } catch (error) {
    failures.push({route,status:0,check:'http',error:error instanceof Error ? error.message : String(error)});
    return {route,status:0,ok:false};
  }
}));

try {
  for (const route of visualRoutes) {
    const routePage = await browser.newPage();
    await routePage.setViewport({width:1280,height:800});
    const pageErrors = [];
    const assetErrors = [];
    const requestUrls = [];
    routePage.on('pageerror', (error) => pageErrors.push(error.message));
    routePage.on('request', (request) => requestUrls.push(request.url()));
    routePage.on('response', (response) => {
      const type = response.request().resourceType();
      if ((type === 'stylesheet' || type === 'script') && response.status() >= 400) {
        assetErrors.push({url:response.url(),status:response.status(),type});
      }
    });
    const response = await routePage.goto(`${origin}${route}`, {waitUntil:'domcontentloaded',timeout:5000}).catch(() => null);
    await routePage.waitForSelector('link[rel="stylesheet"]', {timeout:3000}).catch(() => undefined);
    const result = await routePage.evaluate(() => ({
      title:document.title,
      overflowX:document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      text:document.body.innerText.slice(0,120),
      bodyMargin:getComputedStyle(document.body).margin,
      appStylesLoaded:Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some((link) => Boolean(link.sheet)),
    })).catch(() => ({title:'',overflowX:false,text:''}));
    const status = response?.status() || 0;
    const fatalErrors = pageErrors.filter((message) => /hydration|chunk|module|syntax|referenceerror|typeerror/i.test(message));
    const documentLoaded = status > 0 || (result.title.length > 0 && result.text.length > 0);
    const ok = documentLoaded && status < 500 && !result.overflowX && result.bodyMargin === '0px'
      && result.appStylesLoaded && fatalErrors.length === 0 && assetErrors.length === 0;
    if (!ok) failures.push({route,status,overflowX:result.overflowX,bodyMargin:result.bodyMargin,appStylesLoaded:result.appStylesLoaded,pageErrors:fatalErrors,assetErrors,check:'visual'});

    if (route === '/') {
      const landingState = await routePage.evaluate(() => {
        const securityCard = document.querySelector('#security .p-6');
        const deploymentCard = document.querySelector('#deployment .p-5');
        const moduleBlocks = Array.from(document.querySelectorAll('.nk-module-block'));
        return {
          securityPadding:securityCard ? Number.parseFloat(getComputedStyle(securityCard).paddingTop) : 0,
          deploymentPadding:deploymentCard ? Number.parseFloat(getComputedStyle(deploymentCard).paddingTop) : 0,
          moduleOverflow:moduleBlocks.some((element) => element.scrollWidth > element.clientWidth + 1),
        };
      });
      if (landingState.securityPadding < 20 || landingState.deploymentPadding < 16 || landingState.moduleOverflow) {
        failures.push({route,check:'landing-card-layout',landingState});
      }
    }

    if (route === '/auth/login') {
      await routePage.waitForSelector('style[data-css-hash]', {timeout:3000}).catch(() => undefined);
      const submit = await routePage.$('button[type="submit"]');
      if (!submit) {
        failures.push({route,check:'auth-hydration',reason:'submit button missing'});
      } else {
        await submit.click();
        await new Promise((resolve) => setTimeout(resolve, 100));
        const authState = await routePage.evaluate(() => ({
          antStyles:Boolean(document.querySelector('style[data-css-hash]')),
          validationErrors:document.querySelectorAll('.ant-form-item-explain-error').length,
          submitBackground:getComputedStyle(document.querySelector('button[type="submit"]')).backgroundColor,
        }));
        if (!authState.antStyles || authState.validationErrors < 2 || authState.submitBackground === 'rgba(0, 0, 0, 0)') {
          failures.push({route,check:'auth-hydration',authState});
        }
      }

      const authConfigRequests = requestUrls.filter((url) => url.endsWith('/api/auth/public-config'));
      if (authConfigRequests.length !== 1) {
        failures.push({route,check:'auth-api-base',authConfigRequests,requestUrls:requestUrls.filter((url) => url.includes('/api/'))});
      }
    }
    await routePage.close();
  }

  const mobilePage = await browser.newPage();
  await mobilePage.setViewport({width:390,height:844});
  await mobilePage.goto(origin, {waitUntil:'domcontentloaded',timeout:10000}).catch(() => undefined);
  await mobilePage.waitForSelector('.mobile-menu-toggle', {timeout:5000}).catch(() => undefined);
  const menuButton = await mobilePage.$('.mobile-menu-toggle');
  if (!menuButton) failures.push({route:'/',reason:'mobile menu toggle missing'});
  else {
    const mobile = await mobilePage.evaluate(() => ({
      menuVisible:getComputedStyle(document.querySelector('.mobile-menu-toggle')).display !== 'none',
      menuExpanded:document.querySelector('.mobile-menu-toggle')?.getAttribute('aria-expanded'),
      overflowX:document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      heroWidth:document.querySelector('.hero-enterprise')?.getBoundingClientRect().width,
      desktopActionsHidden:Array.from(document.querySelectorAll('.nk-nav-actions > .nk-btn'))
        .every((element) => getComputedStyle(element).display === 'none'),
      viewportWidth:innerWidth,
    }));
    if (!mobile.menuVisible || mobile.menuExpanded !== 'false' || !mobile.desktopActionsHidden
      || mobile.overflowX || (mobile.heroWidth || 0) > mobile.viewportWidth) failures.push({route:'/',mobile});
  }
  await mobilePage.close();

  const mobileAuthPage = await browser.newPage();
  await mobileAuthPage.setViewport({width:390,height:844});
  await mobileAuthPage.goto(`${origin}/auth/login`, {waitUntil:'domcontentloaded',timeout:10000}).catch(() => undefined);
  await mobileAuthPage.waitForSelector('.auth-shell', {timeout:5000}).catch(() => undefined);
  const mobileAuth = await mobileAuthPage.evaluate(() => {
    const productPanel = document.querySelector('.auth-product-panel');
    const shell = document.querySelector('.auth-shell');
    const card = document.querySelector('.auth-content .enterprise-card');
    const cardRect = card?.getBoundingClientRect();
    return {
      productPanelHidden:productPanel ? getComputedStyle(productPanel).display === 'none' : false,
      overflowX:document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      shellWidth:shell?.getBoundingClientRect().width || 0,
      cardLeft:cardRect?.left || 0,
      cardRight:cardRect?.right || 0,
      mobileBrandVisible:getComputedStyle(document.querySelector('.auth-mobile-brand')).display !== 'none',
      viewportWidth:innerWidth,
    };
  });
  if (!mobileAuth.productPanelHidden || mobileAuth.overflowX || mobileAuth.shellWidth > mobileAuth.viewportWidth
    || mobileAuth.cardLeft < 0 || mobileAuth.cardRight > mobileAuth.viewportWidth || !mobileAuth.mobileBrandVisible) {
    failures.push({route:'/auth/login',check:'mobile-auth',mobileAuth});
  }
  await mobileAuthPage.close();

  console.log(JSON.stringify({httpChecked:results.length,httpPassed:results.filter((item) => item.ok).length,visualChecked:visualRoutes.length,failures},null,2));
  if (failures.length) process.exitCode = 1;
} finally {
  await browser.close();
  server.kill('SIGTERM');
  server.stdout.destroy();
  server.stderr.destroy();
  server.unref();
}
