import { useState } from 'react';
import { useThemeStore } from '@/stores/useThemeStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { executeAction } from '@/services/automationService';
import { Button } from '@/components/ui/button';
import { Globe, Sun, Moon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Trang Chủ',
  accounts: 'Konfigurasi Chrome',
  groups: 'Daftar Grup',
  compose: 'Susun Tulisan dengan AI',
  autopost: 'Jalankan Auto Post',
  history: 'Riwayat Posting',
  logs: 'Log Aktivitas',
  settings: 'Pengaturan',
};

interface HeaderProps {
  currentPage: string;
}

export function Header({ currentPage }: HeaderProps) {
  const { isDark, toggleTheme } = useThemeStore();
  const chromePath = useSettingsStore((s) => s.chromePath);
  const [openingChrome, setOpeningChrome] = useState(false);

  const handleOpenChrome = async () => {
    setOpeningChrome(true);
    try {
      const result = await executeAction('open_chrome', {
        chromePath: chromePath || undefined,
      });

      if (result.success) {
        if (result.isLoggedIn) {
          toast.success('Chrome dibuka — Facebook sudah login siap! ✅');
        } else {
          toast.info('Chrome dibuka — silakan login Facebook di jendela yang muncul');
        }
      } else {
        toast.error(result.error || 'Tidak bisa membuka Chrome');
      }
    } catch (err: any) {
      toast.error(`Kesalahan: ${err.message}`);
    }
    setOpeningChrome(false);
  };

  return (
    <header className="flex items-center justify-between h-14 px-6 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-30">
      {/* Page Title */}
      <div>
        <h2 className="text-base font-semibold tracking-tight">
          {PAGE_TITLES[currentPage] || 'AutoPost FB AI Pro'}
        </h2>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {/* Open Chrome Button */}
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-xs font-medium"
          onClick={handleOpenChrome}
          disabled={openingChrome}
        >
          {openingChrome ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Globe className="w-3.5 h-3.5" />
          )}
          {openingChrome ? 'Sedang membuka...' : 'Buka Chrome'}
        </Button>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8"
          onClick={toggleTheme}
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-yellow-400" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </Button>
      </div>
    </header>
  );
}
