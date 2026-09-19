import { Platform, Share } from 'react-native';
import { ExportExpenseRow } from './queries';

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function expensesToCsv(groupName: string, rows: ExportExpenseRow[]): string {
  const header = ['Date', 'Description', 'Category', 'Amount', 'Currency', 'Paid by', 'Split'];
  const lines = rows.map((r) => {
    const split = r.splits.map((s) => `${s.name}: ${s.amount}`).join('; ');
    return [r.date, r.description, r.category, String(r.amount), r.currency, r.paidBy, split].map(csvCell).join(',');
  });
  return [`# ${groupName} — expenses`, header.join(','), ...lines].join('\n');
}

export async function exportCsv(groupName: string, rows: ExportExpenseRow[]): Promise<void> {
  const csv = expensesToCsv(groupName, rows);
  const filename = `${groupName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-expenses.csv`;

  if (Platform.OS === 'web') {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  }

  // No expo-sharing/expo-file-system (native modules — would need a dev-client rebuild),
  // so this shares the CSV as plain text via the OS share sheet rather than a real .csv file.
  await Share.share({ message: csv, title: filename });
}
