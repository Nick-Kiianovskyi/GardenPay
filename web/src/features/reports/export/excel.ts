import ExcelJS from 'exceljs'

export type ExportColumn = {
  header: string
  key: string
  width?: number
  align?: 'left' | 'right' | 'center'
  kind?: 'money' | 'number' | 'text'
}

export type ExportRow = Record<string, string | number | null>

type Down = (blob: Blob, filename: string) => void

const download: Down = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const toMajor = (minor: number): number => Math.round(minor) / 100

export type ExportSheet = {
  name: string
  columns: ExportColumn[]
  rows: ExportRow[]
}

type ExportBlock = {
  title: string
  subtitle?: string
  columns: ExportColumn[]
  rows: ExportRow[]
}

const sheetRange = (rows: ExportRow[]): number =>
  Math.max(1, rows.length)

export async function exportExcel(opts: {
  title: string
  subtitle?: string
  columns: ExportColumn[]
  rows: ExportRow[]
  filename: string
  sheets?: ExportSheet[]
}) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'GardenPay'
  const ws = wb.addWorksheet(opts.title)

  writeSheet(ws, opts, opts.sheets ? `(файл містить ${1 + opts.sheets.length} аркушів)` : undefined)

  if (opts.sheets) {
    for (const sheet of opts.sheets) {
      const s = wb.addWorksheet(sheet.name)
      writeSheet(s, { title: sheet.name, columns: sheet.columns, rows: sheet.rows })
    }
  }

  const buf = await wb.xlsx.writeBuffer()
  download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), opts.filename)
}

function writeSheet(
  ws: ExcelJS.Worksheet,
  opts: ExportBlock,
  extraSubtitle?: string
) {
  const titleRow = ws.addRow([opts.title])
  titleRow.font = { bold: true, size: 14 }
  ws.mergeCells(1, 1, 1, opts.columns.length)

  const subtitle = extraSubtitle ? `${opts.subtitle ?? ''} · ${extraSubtitle}` : opts.subtitle
  if (subtitle) {
    const subRow = ws.addRow([subtitle])
    subRow.font = { italic: true, size: 10, color: { argb: 'FF666666' } }
    ws.mergeCells(2, 1, 2, opts.columns.length)
  }

  const headerRow = ws.addRow(opts.columns.map((c) => c.header))
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F6FEB' },
  }
  headerRow.alignment = { vertical: 'middle' }
  ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 0 }]

  for (const row of opts.rows) {
    const values = opts.columns.map((c) => {
      const v = row[c.key]
      if (v === null || v === undefined) return ''
      if (c.kind === 'money' && typeof v === 'number') return toMajor(v)
      if (typeof v === 'number') return v
      return String(v)
    })
    const r = ws.addRow(values)
    opts.columns.forEach((c, i) => {
      const cell = r.getCell(i + 1)
      cell.alignment = {
        horizontal: c.align === 'right' ? 'right' : c.align === 'center' ? 'center' : 'left',
        vertical: 'top',
      }
      if (c.kind === 'money' && typeof values[i] === 'number') {
        cell.numFmt = '#,##0.00'
      }
    })
  }

  opts.columns.forEach((c, i) => {
    ws.getColumn(i + 1).width = c.width ?? 16
  })
  ws.autoFilter = {
    from: { row: 2 + (opts.subtitle ? 1 : 0) + 1, column: 1 },
    to: {
      row: 2 + (opts.subtitle ? 1 : 0) + 1 + sheetRange(opts.rows),
      column: opts.columns.length,
    },
  }
}