import type { ReceiptCopy } from './printReceipt';

function pdfEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function ascii(value: string): string {
  return value.replace(/₵/g, '').replace(/GH\s+/g, 'GHS ').replace(/[^\x20-\x7E]/g, '?');
}

function money(amount: number): string {
  return `GHS ${amount.toFixed(2)}`;
}

function wrap(text: string, width = 78): string[] {
  const words = ascii(text).split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function receiptLines(copy: ReceiptCopy): string[] {
  const when = new Date(copy.paidAt).toLocaleString();
  const lines = [
    'CLINIC RECEIPT',
    'Ghana cedis (GHS) - Official payment copy',
    '',
    `Receipt: ${copy.receiptNo}`,
    `Hospital no: ${copy.hospitalNo}`,
    `Patient: ${copy.patientName}`,
    `Insurance: ${copy.insurance}`,
    `Clinic: ${copy.clinic}`,
    `Date: ${when}`,
    '',
  ];
  for (const item of copy.items) {
    const name = ascii(item.name);
    const amt = money(item.amount);
    const pad = Math.max(1, 46 - name.slice(0, 40).length);
    lines.push(`${name.slice(0, 40)}${' '.repeat(pad)}${amt}`);
  }
  lines.push('----------------------------------------------');
  lines.push(`Amount paid${' '.repeat(24)}${money(copy.paidTotal)}`);
  if (copy.balance > 0) lines.push(`Balance unpaid${' '.repeat(21)}${money(copy.balance)}`);
  lines.push('');
  lines.push(copy.balance > 0 ? 'PART PAID' : 'PAID');
  lines.push(`Received by: ${copy.receivedBy}`);
  lines.push(`Keep this receipt. Quote ${copy.hospitalNo} next visit.`);
  return lines.flatMap((line) => wrap(line));
}

export function receiptsPdfBytes(copies: ReceiptCopy[]): Uint8Array {
  const pages = (copies.length ? copies : []).map((copy) => receiptLines(copy));
  if (pages.length === 0) pages.push(['No paid receipts.']);

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let length = 0;

  function write(text: string) {
    const bytes = encoder.encode(text);
    chunks.push(bytes);
    length += bytes.length;
  }

  write('%PDF-1.4\n');
  const objectStarts: number[] = [];
  function startObject() {
    objectStarts.push(length);
  }

  startObject();
  write('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  const pageIds: number[] = [];
  let nextId = 3;
  const contentIds: number[] = [];
  for (let i = 0; i < pages.length; i += 1) {
    pageIds.push(nextId);
    contentIds.push(nextId + 1);
    nextId += 2;
  }
  const fontId = nextId;

  startObject();
  write(
    `2 0 obj\n<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>\nendobj\n`,
  );

  pages.forEach((lines, index) => {
    const commands = ['BT', '/F1 11 Tf', '14 TL', '50 800 Td'];
    lines.forEach((line, lineIndex) => {
      if (lineIndex > 0) commands.push('T*');
      commands.push(`(${pdfEscape(ascii(line))}) Tj`);
    });
    commands.push('ET');
    const stream = commands.join('\n');
    const pageId = pageIds[index];
    const contentId = contentIds[index];

    startObject();
    write(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>\nendobj\n`,
    );
    startObject();
    write(`${contentId} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`);
  });

  startObject();
  write(`${fontId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n`);

  const xrefAt = length;
  write(`xref\n0 ${objectStarts.length + 1}\n`);
  write('0000000000 65535 f \n');
  for (const offset of objectStarts) {
    write(`${String(offset).padStart(10, '0')} 00000 n \n`);
  }
  write(`trailer\n<< /Size ${objectStarts.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`);

  const output = new Uint8Array(length);
  let cursor = 0;
  for (const chunk of chunks) {
    output.set(chunk, cursor);
    cursor += chunk.length;
  }
  return output;
}

export function downloadReceiptsPdf(copies: ReceiptCopy[], filename?: string) {
  const bytes = receiptsPdfBytes(copies);
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = filename ?? (copies.length === 1 ? `${copies[0].receiptNo || 'receipt'}.pdf` : `clinic-receipts-${stamp}.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
