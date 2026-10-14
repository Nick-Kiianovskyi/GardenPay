import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ExportColumn, ExportRow } from '@/features/reports/export/excel'

const toMajor = (minor: number): number => Math.round(minor) / 100

const formatCell = (column: ExportColumn, value: string | number | null): string => {
  if (value === null || value === undefined || value === '') return '—'
  if (column.kind === 'money' && typeof value === 'number') {
    return `${toMajor(value).toLocaleString('uk-UA', { minimumFractionDigits: 2 })} ₴`
  }
  if (column.kind === 'number' && typeof value === 'number') {
    return value.toLocaleString('uk-UA', { maximumFractionDigits: 3 })
  }
  return String(value)
}

export type PdfTable = {
  title: string
  columns: ExportColumn[]
  rows: ExportRow[]
}

export function exportPdf(opts: {
  title: string
  subtitle?: string
  columns: ExportColumn[]
  rows: ExportRow[]
  filename: string
  landscape?: boolean
  extraTables?: PdfTable[]
}) {
  const doc = new jsPDF({ orientation: opts.landscape ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' })

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(opts.title, 40, 40)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  const meta = `${opts.subtitle ? opts.subtitle + ' · ' : ''}Сформовано: ${new Date().toLocaleString('uk-UA')}`
  doc.setTextColor(110)
  doc.text(meta, 40, 56)
  doc.setTextColor(0)

  let startY = 72
  autoTable(doc, {
    startY,
    head: [opts.columns.map((c) => c.header)],
    body: opts.rows.map((row) =>
      opts.columns.map((c) => formatCell(c, row[c.key]))
    ),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [31, 111, 235], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [242, 244, 248] },
    margin: { left: 40, right: 40, bottom: 40 },
    didParseCell: (data) => {
      const column = opts.columns[data.column.index]
      if (column.align === 'right') {
        data.cell.styles.halign = 'right'
      } else if (column.align === 'center') {
        data.cell.styles.halign = 'center'
      }
    },
  })

  for (const table of opts.extraTables ?? []) {
    if ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable) {
      startY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 28
      if (startY > doc.internal.pageSize.getHeight() - 120) {
        doc.addPage()
        startY = 60
      }
    }
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(table.title, 40, startY)
    startY += 12
    autoTable(doc, {
      startY,
      head: [table.columns.map((c) => c.header)],
      body: table.rows.map((row) =>
        table.columns.map((c) => formatCell(c, row[c.key]))
      ),
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [31, 111, 235], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [242, 244, 248] },
      margin: { left: 40, right: 40, bottom: 40 },
    })
  }

  doc.save(opts.filename)
}