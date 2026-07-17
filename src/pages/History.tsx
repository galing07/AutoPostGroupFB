import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { History, Download, Trash2, ExternalLink, CheckCircle2, XCircle, Search, Inbox } from 'lucide-react';
import { useHistoryStore } from '@/stores/useHistoryStore';
import { toast } from 'sonner';

export function HistoryPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const clearHistory = useHistoryStore((s) => s.clearHistory);
  const entries = useHistoryStore((s) => s.entries);
  const filtered = entries.filter((e) => {
    const matchSearch =
      !search ||
      e.groupName.toLowerCase().includes(search.toLowerCase()) ||
      e.content.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || e.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleExport = () => {
    if (filtered.length === 0) {
      toast.info('Tidak ada riwayat untuk diekspor');
      return;
    }
    const text = filtered
      .map((e) => `[${new Date(e.timestamp).toLocaleString('vi-VN')}] [${e.status}] ${e.groupName} - ${e.content}`)
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `history_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Riwayat berhasil diekspor!');
  };

  const handleClear = () => {
    clearHistory();
    toast.info('Riwayat berhasil dihapus');
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />Riwayat Posting
          </h2>
          <p className="text-sm text-muted-foreground">{entries.length} posting telah dilakukan</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={handleExport}>
            <Download className="w-3.5 h-3.5" />Ekspor
          </Button>
          <Button variant="outline" size="sm" className="gap-2 text-xs text-destructive" onClick={handleClear}>
            <Trash2 className="w-3.5 h-3.5" />Hapus Semua
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Cari..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-xs" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua</SelectItem>
            <SelectItem value="success">Berhasil</SelectItem>
            <SelectItem value="failed">Gagal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Inbox className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                {entries.length === 0 ? 'Belum ada riwayat posting' : 'Tidak ada hasil yang ditemukan'}
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                {entries.length === 0 ? 'Ketika auto post berhasil/gagal, riwayat akan muncul di sini' : 'Coba ubah kata kunci atau filter'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-semibold">Waktu</TableHead>
                  <TableHead className="text-xs font-semibold">Grup</TableHead>
                  <TableHead className="text-xs font-semibold">Isi</TableHead>
                  <TableHead className="text-xs font-semibold">Foto</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  <TableHead className="text-xs font-semibold w-16">Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(entry.timestamp).toLocaleString('vi-VN')}</TableCell>
                    <TableCell className="text-xs font-medium">{entry.groupName}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{entry.content}</TableCell>
                    <TableCell className="text-xs">{entry.mediaCount}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`text-[10px] border-0 gap-1 ${entry.status === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'}`}>
                        {entry.status === 'success' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {entry.status === 'success' ? 'OK' : 'Gagal'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {entry.postUrl && (
                        <a href={entry.postUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline"><ExternalLink className="w-3.5 h-3.5" /></a>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
