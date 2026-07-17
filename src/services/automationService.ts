// Layanan Otomatisasi — Menghubungkan frontend dengan Playwright melalui perintah IPC Rust
import { useAuthStore } from '@/stores/useAuthStore';
import type { PostResult } from '@/stores/useAutoPostStore';

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════
export interface IPCMessage {
  type: 'IPC_RESPONSE' | 'IPC_LOG' | 'IPC_PROGRESS' | 'IPC_RESULT';
  success?: boolean;
  error?: string;
  message?: string;
  level?: string;
  index?: number;
  total?: number;
  groupName?: string;
  groupId?: string;
  groupUrl?: string;
  status?: string;
  groups?: Array<{ id: string; name: string; url: string; memberCount: number }>;
  isLoggedIn?: boolean;
  [key: string]: any;
}

export type LogCallback = (level: string, message: string) => void;
export type ProgressCallback = (index: number, total: number, groupName: string) => void;
export type ResultCallback = (result: PostResult) => void;

// ═══════════════════════════════════════════════════════════════════
// Cek apakah berjalan di dalam Tauri
// ═══════════════════════════════════════════════════════════════════
function isTauri(): boolean {
  try {
    return typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
  } catch {
    return false;
  }
}

function normalizeAutomationError(error: string): string {
  if (!error) return 'Kesalahan tidak diketahui';

  if (error.includes('ProcessSingleton') || error.includes('profile is already in use')) {
    return 'Profil Chrome sedang digunakan atau terkunci. Tutup dulu jendela Chrome yang dibuka oleh aplikasi, lalu coba lagi. Jika masih error, jalankan: pkill -f ".autopost/chrome-profile"';
  }

  if (error.includes('Không tìm thấy automation/index.js')) {
    return error;
  }

  if (error.includes('Executable doesn\'t exist') || error.includes('ENOENT')) {
    return 'Tidak menemukan Chrome. Buka Pengaturan atau Chrome Profile dan periksa kembali Chrome Path.';
  }

  return error;
}

// ═══════════════════════════════════════════════════════════════════
// Jalankan aksi otomatisasi
// ═══════════════════════════════════════════════════════════════════
export async function executeAction(
  action: string,
  payload: Record<string, any> = {},
  callbacks?: {
    onLog?: LogCallback;
    onProgress?: ProgressCallback;
    onResult?: ResultCallback;
  }
): Promise<IPCMessage> {
  const publicActions = new Set(['test_connection']);
  const auth = useAuthStore.getState();
  
  if (!publicActions.has(action)) {
    if (!auth.isAuthenticated() || !auth.hasActiveSubscription()) {
      const error = 'Akun belum memiliki paket berlangganan aktif. Silakan login dan bayar/perpanjang untuk menggunakan fitur otomatisasi.';
      callbacks?.onLog?.('error', error);
      return { type: 'IPC_RESPONSE', success: false, error };
    }

    const active = await auth.validateLicense().catch(() => false);
    if (!active) {
      const error = 'Backend melaporkan lisensi tidak aktif. Silakan perpanjang sebelum menjalankan otomatisasi.';
      callbacks?.onLog?.('error', error);
      return { type: 'IPC_RESPONSE', success: false, error };
    }
  }

  if (isTauri()) {
    return executeTauriAction(action, payload, callbacks);
  }
  // Fallback untuk mode development di browser
  return executeSimulatedAction(action, payload, callbacks);
}

// ═══════════════════════════════════════════════════════════════════
// Cek dependensi (node, playwright)
// ═══════════════════════════════════════════════════════════════════
export async function checkDependencies(): Promise<{ node: string; hasDeps: boolean }> {
  if (!isTauri()) {
    return { node: 'simulated', hasDeps: true };
  }
  const { invoke } = await import('@tauri-apps/api/core');
  const result = await invoke<string>('check_dependencies');
  return JSON.parse(result);
}

// ═══════════════════════════════════════════════════════════════════
// Instal dependensi otomatisasi
// ═══════════════════════════════════════════════════════════════════
export async function installDependencies(): Promise<string> {
  if (!isTauri()) return 'Simulated';
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string>('install_automation_deps');
}

// ═══════════════════════════════════════════════════════════════════
// Eksekusi via Tauri IPC (Rust)
// ═══════════════════════════════════════════════════════════════════
async function executeTauriAction(
  action: string,
  payload: Record<string, any>,
  callbacks?: {
    onLog?: LogCallback;
    onProgress?: ProgressCallback;
    onResult?: ResultCallback;
  }
): Promise<IPCMessage> {
  const { invoke } = await import('@tauri-apps/api/core');

  callbacks?.onLog?.('info', `Sedang menjalankan: ${action}...`);

  try {
    const payloadStr = JSON.stringify(payload);
    const rawOutput = await invoke<string>('run_automation', {
      action,
      payload: payloadStr,
    });

    // Parse output JSON multi-line dari Node.js
    const lines = rawOutput.split('\n').filter((l) => l.trim());
    let lastResponse: IPCMessage = { type: 'IPC_RESPONSE', success: false, error: 'Tidak ada respons' };

    for (const line of lines) {
      try {
        const msg: IPCMessage = JSON.parse(line.trim());
        switch (msg.type) {
          case 'IPC_LOG':
            callbacks?.onLog?.(msg.level || 'info', msg.message || '');
            break;
          case 'IPC_PROGRESS':
            callbacks?.onProgress?.(msg.index || 0, msg.total || 0, msg.groupName || '');
            break;
          case 'IPC_RESULT':
            callbacks?.onResult?.({
              groupId: msg.groupId || '',
              groupName: msg.groupName || '',
              groupUrl: msg.groupUrl || '',
              status: (msg.status as 'success' | 'failed' | 'skipped') || 'failed',
              message: msg.message,
              timestamp: new Date().toISOString(),
            });
            break;
          case 'IPC_RESPONSE':
            lastResponse = {
              ...msg,
              error: msg.error ? normalizeAutomationError(msg.error) : msg.error,
            };
            break;
        }
      } catch {
        // Baris bukan JSON, abaikan
      }
    }

    return lastResponse;
  } catch (err: any) {
    const normalized = normalizeAutomationError(err.toString());
    callbacks?.onLog?.('error', `Kesalahan: ${normalized}`);
    return { type: 'IPC_RESPONSE', success: false, error: normalized };
  }
}

// ═══════════════════════════════════════════════════════════════════
// Simulasi eksekusi (untuk mode development di browser)
// ═══════════════════════════════════════════════════════════════════
async function executeSimulatedAction(
  action: string,
  payload: Record<string, any>,
  callbacks?: {
    onLog?: LogCallback;
    onProgress?: ProgressCallback;
    onResult?: ResultCallback;
  }
): Promise<IPCMessage> {
  callbacks?.onLog?.('info', `[DEV] Aksi: ${action}`);
  await new Promise((r) => setTimeout(r, 800));

  switch (action) {
    case 'test_connection':
      callbacks?.onLog?.('success', 'Playwright siap (dev mode)');
      return { type: 'IPC_RESPONSE', success: true, message: 'Koneksi OK (dev mode)' };

    case 'open_chrome':
      callbacks?.onLog?.('success', 'Chrome telah dibuka (dev mode)');
      return { type: 'IPC_RESPONSE', success: true, isLoggedIn: false, message: 'Chrome dibuka (dev mode)' };

    case 'check_session':
      callbacks?.onLog?.('info', 'Memeriksa sesi (dev mode)');
      return { type: 'IPC_RESPONSE', success: true, isLoggedIn: false, message: 'Belum login (dev mode)' };

    case 'scan_groups':
      callbacks?.onLog?.('info', 'Sedang memindai grup...');
      await new Promise((r) => setTimeout(r, 2000));
      return { type: 'IPC_RESPONSE', success: false, error: 'Harus dijalankan di aplikasi Tauri untuk memindai grup' };

    case 'auto_post': {
      const groups = payload.groups || [];
      for (let i = 0; i < groups.length; i++) {
        const g = groups[i];
        callbacks?.onProgress?.(i + 1, groups.length, g.name);
        callbacks?.onLog?.('info', `[${i + 1}/${groups.length}] Sedang posting: ${g.name}`);
        await new Promise((r) => setTimeout(r, 1500));
        callbacks?.onResult?.({
          groupId: g.id, 
          groupName: g.name, 
          groupUrl: g.url,
          status: 'failed',
          message: 'Harus dijalankan di aplikasi Tauri',
          timestamp: new Date().toISOString(),
        });
        callbacks?.onLog?.('error', `${g.name}: Harus menggunakan Tauri untuk menjalankan otomatisasi`);
      }
      return { type: 'IPC_RESPONSE', success: false, error: 'Jalankan di aplikasi Tauri untuk menggunakan auto post' };
    }

    default:
      return { type: 'IPC_RESPONSE', success: false, error: `Aksi tidak dikenal: ${action}` };
  }
}
