import { useState, useRef } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Plus,
  Upload,
  Search,
  ScanSearch,
  Trash2,
  CheckSquare,
  Square,
  ExternalLink,
  Loader2,
  Users,
} from 'lucide-react';
import { useGroupStore } from '@/stores/useGroupStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { executeAction } from '@/services/automationService';
import { toast } from 'sonner';

export function GroupList() {
  const {
    groups,
    searchQuery,
    filterStatus,
    addGroups,
    removeGroup,
    toggleGroupSelection,
    selectAll,
    deselectAll,
    setSearchQuery,
    setFilterStatus,
    getFilteredGroups,
    getSelectedGroups,
  } = useGroupStore();

  const [bulkLinks, setBulkLinks] = useState('');
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [scanning, setScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredGroups = getFilteredGroups();
  const selectedGroups = getSelectedGroups();

  const handleAddBulk = () => {
    if (!bulkLinks.trim()) {
      toast.error('Silakan masukkan link grup');
      return;
    }
    const urls = bulkLinks
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    addGroups(urls);
    setBulkLinks('');
    setShowAddPanel(false);
    toast.success(`Berhasil menambahkan ${urls.length} grup`);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const urls = text
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith('http'));
      addGroups(urls);
      toast.success(`Berhasil import ${urls.length} grup dari file`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleScanGroups = async () => {
    setScanning(true);
    try {
      const result = await executeAction('scan_groups', {
        chromePath: useSettingsStore.getState().chromePath || undefined,
      });
      if (result.success && result.groups) {
        const urls = result.groups.map((g: any) => g.url);
        addGroups(urls);

        // Update group names and status
        setTimeout(() => {
          const currentGroups = useGroupStore.getState().groups;
          result.groups!.forEach((scanned: any) => {
            const found = currentGroups.find((g) => g.url === scanned.url);
            if (found) {
              useGroupStore.getState().updateGroup(found.id, {
                name: scanned.name,
                status: 'joined',
                memberCount: scanned.memberCount,
              });
            }
          });
        }, 100);

        toast.success(`Selesai! Ditemukan ${result.groups.length} grup`);
      } else {
        toast.error(result.error || 'Pemindaian grup gagal');
      }
    } catch (err: any) {
      toast.error(`Kesalahan: ${err.message}`);
    }
    setScanning(false);
  };

  const allSelected =
    filteredGroups.length > 0 && filteredGroups.every((g) => g.isSelected);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Daftar Grup Facebook
          </h2>
          <p className="text-sm text-muted-foreground">
            Mengelola {groups.length} grup •{' '}
            <span className="text-primary font-medium">
              {selectedGroups.length} dipilih
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-xs"
            onClick={handleScanGroups}
            disabled={scanning}
          >
            {scanning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ScanSearch className="w-3.5 h-3.5" />
            )}
            Scan Grup yang Bergabung
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".txt"
            className="hidden"
            onChange={handleImportFile}
          />
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-xs"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-3.5 h-3.5" />
            Impor .txt
          </Button>

          <Button
            size="sm"
            className="gap-2 text-xs"
            onClick={() => setShowAddPanel(!showAddPanel)}
          >
            <Plus className="w-3.5 h-3.5" />
            Tambah Grup
          </Button>
        </div>
      </div>

      {/* Add Panel */}
      {showAddPanel && (
        <Card className="animate-fade-up">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Tambah Grup Baru</CardTitle>
            <CardDescription className="text-xs">
              Masukkan setiap link grup di baris baru
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder={`https://www.facebook.com/groups/contoh1\nhttps://www.facebook.com/groups/contoh2`}
              value={bulkLinks}
              onChange={(e) => setBulkLinks(e.target.value)}
              rows={5}
              className="text-xs font-mono"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddPanel(false)}
              >
                Batal
              </Button>
              <Button size="sm" onClick={handleAddBulk}>
                Tambah Grup
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Cari grup..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <Select
          value={filterStatus}
          onValueChange={(v) =>
            setFilterStatus(v as 'all' | 'joined' | 'pending' | 'unknown')
          }
        >
          <SelectTrigger className="w-[160px] h-9 text-xs">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua</SelectItem>
            <SelectItem value="joined">Sudah Bergabung</SelectItem>
            <SelectItem value="pending">Menunggu</SelectItem>
            <SelectItem value="unknown">Tidak Diketahui</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={allSelected ? deselectAll : selectAll}
          >
            {allSelected ? (
              <Square className="w-3.5 h-3.5" />
            ) : (
              <CheckSquare className="w-3.5 h-3.5" />
            )}
            {allSelected ? 'Batalkan Pilih Semua' : 'Pilih Semua'}
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {filteredGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="w-10 h-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                Belum ada grup
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Tambah grup atau scan grup yang sudah bergabung untuk mulai
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10" />
                  <TableHead className="text-xs font-semibold">
                    Nama Grup
                  </TableHead>
                  <TableHead className="text-xs font-semibold">
                    Link
                  </TableHead>
                  <TableHead className="text-xs font-semibold">
                    Status
                  </TableHead>
                  <TableHead className="text-xs font-semibold w-20">
                    Aksi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGroups.map((group) => (
                  <TableRow
                    key={group.id}
                    className="cursor-pointer"
                    onClick={() => toggleGroupSelection(group.id)}
                  >
                    <TableCell>
                      <Checkbox
                        checked={group.isSelected}
                        onCheckedChange={() => toggleGroupSelection(group.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      {group.name}
                    </TableCell>
                    <TableCell>
                      <a
                        href={group.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {group.url.substring(0, 50)}...
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] border-0 ${
                          group.status === 'joined'
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : group.status === 'pending'
                              ? 'bg-amber-500/10 text-amber-500'
                              : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {group.status === 'joined'
                          ? 'Sudah Bergabung'
                          : group.status === 'pending'
                            ? 'Menunggu'
                            : 'Tidak Diketahui'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-7 h-7 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeGroup(group.id);
                          toast.info('Grup berhasil dihapus');
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      {groups.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            Total: <strong className="text-foreground">{groups.length}</strong>{' '}
            grup
          </span>
          <span>
            Dipilih:{' '}
            <strong className="text-primary">{selectedGroups.length}</strong>
          </span>
          <span>
            Sudah bergabung:{' '}
            <strong className="text-emerald-500">
              {groups.filter((g) => g.status === 'joined').length}
            </strong>
          </span>
        </div>
      )}
    </div>
  );
}
