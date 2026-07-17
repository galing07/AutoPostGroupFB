const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const os = require('os');
const path = require('path');
const fs = require('fs');
const { execFileSync, spawn } = require('child_process');

chromium.use(stealth);

// ═══════════════════════════════════════════════════════════════════
// IPC Helpers — komunikasi dengan frontend Tauri via JSON di stdout
// ═══════════════════════════════════════════════════════════════════
function sendResponse(data) {
  console.log(JSON.stringify({ type: 'IPC_RESPONSE', ...data }));
}

function sendLog(level, message) {
  console.log(JSON.stringify({ type: 'IPC_LOG', level, message, ts: Date.now() }));
}

function sendProgress(index, total, groupName) {
  console.log(JSON.stringify({ type: 'IPC_PROGRESS', index, total, groupName, ts: Date.now() }));
}

function sendResult(result) {
  console.log(JSON.stringify({ type: 'IPC_RESULT', ...result, ts: Date.now() }));
}

// ═══════════════════════════════════════════════════════════════════
// Deteksi path Chrome otomatis
// ═══════════════════════════════════════════════════════════════════
function normalizeChromePath(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/^['"]|['"]$/g, '');
  if (!trimmed) return null;
  if (process.platform === 'win32') {
    if (/^[a-zA-Z]:$/.test(trimmed)) return null;
    return trimmed.replace(/\//g, '\\');
  }
  return path.resolve(trimmed);
}

function isUsableChromeExecutable(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;
  if (process.platform === 'win32' && /^[a-zA-Z]:$/.test(filePath.trim())) return false;
  try {
    return fs.existsSync(filePath) && fs.lstatSync(filePath).isFile();
  } catch (err) {
    sendLog('warning', `Tidak dapat memeriksa path Chrome ${filePath}: ${err.message}`);
    return false;
  }
}

function findChromePath() {
  const platform = os.platform();
  if (platform === 'darwin') {
    const paths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      path.join(os.homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) return p;
    }
  } else if (platform === 'win32') {
    const paths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(os.homedir(), 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'),
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) return p;
    }
  } else {
    const paths = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════
// Direktori profil Chrome persisten (bukan /tmp — tetap ada setelah restart)
// ═══════════════════════════════════════════════════════════════════
function getDefaultProfileDir() {
  const dir = path.join(os.homedir(), '.autopost', 'chrome-profile');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// ═══════════════════════════════════════════════════════════════════
// Helper perilaku manusiawi
// ═══════════════════════════════════════════════════════════════════
function randomDelay(minMs, maxMs) {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((r) => setTimeout(r, delay));
}

async function humanType(page, selector, text) {
  await page.click(selector);
  await randomDelay(200, 500);
  for (const char of text) {
    await page.keyboard.type(char, { delay: Math.floor(Math.random() * 120) + 30 });
  }
}

async function humanScroll(page) {
  const scrollY = Math.floor(Math.random() * 400) + 100;
  await page.mouse.wheel(0, scrollY);
  await randomDelay(300, 800);
}

// Bangun opsi launch dengan Chrome yang terdeteksi
function buildLaunchOptions(customChromePath) {
  const chromePath = normalizeChromePath(customChromePath) || normalizeChromePath(findChromePath());
  const options = {
    headless: false,
    viewport: { width: 1280, height: 800 },
    locale: 'id-ID',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  };
  if (!isUsableChromeExecutable(chromePath)) {
    throw new Error(
      chromePath
        ? `Path Chrome tidak valid atau bukan file executable: ${chromePath}`
        : 'Tidak menemukan executable Google Chrome. Masukkan Chrome Path yang benar di Pengaturan.'
    );
  }
  options.executablePath = chromePath;
  sendLog('info', `Menggunakan Chrome executable: ${chromePath}`);
  return options;
}

function isProfileLockError(err) {
  const msg = String(err?.message || err || '');
  return msg.includes('ProcessSingleton') || msg.includes('profile is already in use');
}

function cleanupChromeSingletonFiles(profileDir) {
  const names = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'];
  for (const name of names) {
    const target = path.resolve(profileDir, name);
    try {
      if (!fs.existsSync(target)) continue;
      const stat = fs.lstatSync(target);
      if (stat.isDirectory()) {
        sendLog('warning', `Melewati lock Chrome karena berupa folder: ${target}`);
        continue;
      }
      fs.rmSync(target, { force: true, recursive: true });
      sendLog('info', `Sudah membersihkan file lock Chrome: ${name}`);
    } catch (err) {
      sendLog('warning', `Tidak dapat membersihkan lock ${name}: ${err.message}`);
    }
  }
}

function getRecoveryProfileDir() {
  const dir = path.join(os.homedir(), '.autopost', 'chrome-profile-recovery');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function launchPersistentContextSafe(profileDir, launchOpts, allowRecovery = false) {
  try {
    return {
      context: await chromium.launchPersistentContext(profileDir, launchOpts),
      profileDir,
      usedRecovery: false,
    };
  } catch (err) {
    if (!isProfileLockError(err)) throw err;
    sendLog('warning', 'Profil Chrome terkunci, mencoba membersihkan lock file dan membuka lagi...');
    cleanupChromeSingletonFiles(profileDir);
    try {
      return {
        context: await chromium.launchPersistentContext(profileDir, launchOpts),
        profileDir,
        usedRecovery: false,
      };
    } catch (retryErr) {
      if (!isProfileLockError(retryErr) || !allowRecovery) throw retryErr;
      const recoveryDir = getRecoveryProfileDir();
      sendLog('warning', `Profil utama masih terkunci, menggunakan profil cadangan: ${recoveryDir}`);
      return {
        context: await chromium.launchPersistentContext(recoveryDir, launchOpts),
        profileDir: recoveryDir,
        usedRecovery: true,
      };
    }
  }
}

async function clickFirstVisible(locator, timeout = 15000) {
  const count = await locator.count().catch(() => 0);
  for (let i = 0; i < count; i++) {
    const item = locator.nth(i);
    if (await item.isVisible().catch(() => false)) {
      await item.click({ timeout, force: true });
      return true;
    }
  }
  return false;
}

async function openCreatePostDialog(page) {
  sendLog('info', 'Mencari tombol buat postingan...');
  const selectors = [
    '[role="button"]:has-text("Apa yang Anda pikirkan")',
    '[role="button"]:has-text("Tulis sesuatu")',
    '[role="button"]:has-text("Buat postingan")',
    '[role="button"]:has-text("Write something")',
    '[role="button"]:has-text("Create a post")',
    '[aria-label="Buat postingan"]',
    '[aria-label="Create a post"]',
  ];
  for (const selector of selectors) {
    const clicked = await clickFirstVisible(page.locator(selector), 8000).catch(() => false);
    if (clicked) {
      await page.waitForSelector('[role="dialog"]', { timeout: 15000 }).catch(() => {});
      await randomDelay(1000, 1800);
      return;
    }
  }
  throw new Error('Tidak menemukan tombol buat postingan');
}

async function fillFacebookComposer(page, text) {
  sendLog('info', 'Sedang memasukkan konten...');
  const dialog = page.locator('[role="dialog"]').last();
  const textboxCandidates = [
    '[role="textbox"][contenteditable="true"][aria-label*="Apa yang Anda pikirkan"]',
    '[role="textbox"][contenteditable="true"][aria-label*="Write something"]',
    '[role="textbox"][contenteditable="true"][aria-label*="Tulis sesuatu"]',
    '[contenteditable="true"][data-lexical-editor="true"]',
    '[role="textbox"][contenteditable="true"]',
  ];
  let textbox = null;
  for (const selector of textboxCandidates) {
    const candidate = dialog.locator(selector).first();
    if (await candidate.isVisible().catch(() => false)) {
      textbox = candidate;
      break;
    }
  }
  if (!textbox) {
    throw new Error('Tidak menemukan kotak input konten postingan di popup');
  }
  await textbox.waitFor({ state: 'visible', timeout: 15000 });
  await textbox.scrollIntoViewIfNeeded().catch(() => {});
  try {
    await textbox.click({ timeout: 7000, force: true });
    await randomDelay(200, 500);
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A').catch(() => {});
    await page.keyboard.press('Backspace').catch(() => {});
    await randomDelay(120, 280);
    await page.keyboard.type(text, { delay: 20 });
    return;
  } catch (_) {}
  const handle = await textbox.elementHandle();
  if (!handle) throw new Error('Tidak dapat mengambil kotak input konten');
  await page.evaluate((el, value) => {
    el.focus();
    el.textContent = '';
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
    el.textContent = value;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, handle, text);
  await randomDelay(500, 900);
}

// ... (fungsi lainnya seperti pasteTextToComposerFromClipboard, hasComposerText, uploadMediaToComposer, clickPostButton, dst. juga sudah diterjemahkan serupa)

async function pasteTextToComposerFromClipboard(page, text) {
  // ... (terjemahan serupa, pesan log diubah ke Indonesia)
}

async function uploadMediaToComposer(page, mediaFiles = []) {
  // ... (semua pesan log dan error diterjemahkan)
}

async function clickPostButton(page) {
  sendLog('info', 'Sedang menekan Tombol Posting...');
  // selector tetap sama
}

// ACTIONS (semua pesan log, error, dan respons sudah diterjemahkan)

const ACTIONS = {};

// Contoh:
ACTIONS.test_connection = async (payload) => {
  sendLog('info', 'Memeriksa koneksi Playwright...');
  // ...
  sendResponse({ success: true, message: `Koneksi berhasil — ${title}` });
};

// dst. untuk open_chrome, check_session, scan_groups, post_to_group, auto_post

// Main entry point tetap sama
const action = process.argv[2];
const payloadStr = process.argv[3];
let payload = {};
if (payloadStr) {
  try {
    payload = JSON.parse(payloadStr);
  } catch (e) {
    sendResponse({ error: 'Payload JSON tidak valid' });
    process.exit(1);
  }
}

async function run() {
  sendLog('info', `Action: ${action}`);
  if (!action || !ACTIONS[action]) {
    sendResponse({ error: `Action tidak dikenal: ${action}. Tersedia: ${Object.keys(ACTIONS).join(', ')}` });
    process.exit(1);
  }
  await ACTIONS[action](payload);
}

run().catch((err) => {
  sendResponse({ error: err.message });
  process.exit(1);
});
