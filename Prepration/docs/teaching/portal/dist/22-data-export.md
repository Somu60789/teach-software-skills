# 22 — Data Export & File Processing

## 1. Prerequisites

Before working through this document you should be comfortable with:

- **React (01)** — hooks, component state, file input handling
- **Spring Boot (02)** — controllers, streaming responses, JPA queries
- **Python Django (04)** — views, QuerySets, HTTP responses (for the Python sections)

---

## 2. What & Why

Manufacturing operations run on Excel. Supply chain managers, production planners, and logistics coordinators live in spreadsheets. They do not use web portals to analyse data — they download an Excel file, pivot it, filter it, and email it to their manager. If your system cannot produce Excel output, it cannot integrate into the real workflow.

**Excel for supply chain teams** — the adherence report, the replenishment schedule, the material master extract: all of these are Excel files. Apache POI on the JVM and openpyxl/XlsxWriter in Python cover the complete feature set including styles, formulas, charts, and named ranges.

**PDF for printed labels and reports** — shop-floor label sheets, quality certificates, and delivery receipts must be printed. PDF is the only reliable format for print: it preserves layout and fonts regardless of the printer or operating system. jsPDF with the autotable plugin handles tabular reports; react-to-pdf handles printing arbitrary React component trees.

**Excel ingestion from SAP** — SAP frequently delivers master data as Excel dumps. A material master update, a BOM export, or a vendor list arrives as an .xlsx file that must be parsed, validated, and loaded into the application database. SheetJS (xlsx) in the browser and openpyxl on the backend handle this parsing.

---

## 3. Core Concepts

**Workbook → Sheet → Row → Cell** is the universal hierarchy for spreadsheet files:

```
XSSFWorkbook (file)
  └── XSSFSheet ("Orders")
        └── XSSFRow (row index 0)
              └── XSSFCell (column index 0) = "Order ID"
```

Every library — Apache POI, openpyxl, ExcelJS — models this hierarchy. Learn it once and the API is consistent across libraries.

**Streaming API for large files** — the standard in-memory workbook API loads the entire file into heap memory. For a 100,000-row report at roughly 100 bytes per cell times 10 columns, that is 100MB of heap. For 10 concurrent downloads, that is 1GB. SXSSFWorkbook (Java) and `ExcelJS.stream.xlsx.WorkbookWriter` (Node) write rows to disk as they are generated, keeping only a small window of rows in memory. Use streaming whenever a report can exceed 10,000 rows.

**Style separation from data** — create `CellStyle` objects once and reuse them across all cells of the same type. Creating a new style per cell is a common mistake; Apache POI has a hard limit of 64,000 styles per workbook and creating per-cell styles exhausts it quickly on large reports.

---

## 4. Installation & Setup

### Java (build.gradle.kts)

```kotlin
dependencies {
    implementation("org.apache.poi:poi-ooxml:5.2.5")
    // poi-ooxml includes poi (for .xls) and all XML dependencies
}
```

### Python

```bash
pip install openpyxl xlsxwriter

# openpyxl — read and write .xlsx with full style support
# xlsxwriter — write-only but supports charts; cannot read existing files
```

### JavaScript

```bash
npm install xlsx                  # SheetJS — read and write, browser and Node
npm install jspdf jspdf-autotable # PDF generation with table support
npm install exceljs               # Full Excel with streaming support
npm install react-to-pdf          # Print React component trees to PDF
```

---

## 5. Beginner

### Apache POI — write a workbook to HTTP response

```java
@GetMapping("/api/orders/export")
public void exportOrders(HttpServletResponse response) throws IOException {

    response.setContentType(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    response.setHeader("Content-Disposition",
        "attachment; filename=\"orders-" + LocalDate.now() + ".xlsx\"");

    try (XSSFWorkbook wb = new XSSFWorkbook()) {
        XSSFSheet sheet = wb.createSheet("Orders");

        // Header row
        XSSFRow headerRow = sheet.createRow(0);
        headerRow.createCell(0).setCellValue("Order ID");
        headerRow.createCell(1).setCellValue("Material Code");
        headerRow.createCell(2).setCellValue("Quantity");
        headerRow.createCell(3).setCellValue("Plant");
        headerRow.createCell(4).setCellValue("Created Date");

        // Data rows from service
        List<Order> orders = orderService.findAll();
        for (int i = 0; i < orders.size(); i++) {
            Order o = orders.get(i);
            XSSFRow row = sheet.createRow(i + 1);
            row.createCell(0).setCellValue(o.getId());
            row.createCell(1).setCellValue(o.getMaterialCode());
            row.createCell(2).setCellValue(o.getQuantity());
            row.createCell(3).setCellValue(o.getPlantCode());
            row.createCell(4).setCellValue(o.getCreatedAt().toString());
        }

        // Auto-size columns after data is written
        for (int col = 0; col < 5; col++) {
            sheet.autoSizeColumn(col);
        }

        wb.write(response.getOutputStream());
    }
}
```

### openpyxl — write a workbook

```python
from openpyxl import Workbook
from openpyxl.utils import get_column_letter
from django.http import HttpResponse

def export_replenishment_schedule(request):
    wb = Workbook()
    ws = wb.active
    ws.title = "Replenishment Schedule"

    # Header
    headers = ["Material Code", "Description", "Reorder Qty", "Lead Time (days)"]
    ws.append(headers)

    # Data rows from QuerySet
    for material in Material.objects.filter(plant_code=request.GET.get("plant")):
        ws.append([
            material.code,
            material.description,
            material.reorder_quantity,
            material.lead_time_days,
        ])

    # Auto-size columns
    for col_idx, _ in enumerate(headers, start=1):
        col_letter = get_column_letter(col_idx)
        ws.column_dimensions[col_letter].auto_size = True

    response = HttpResponse(
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    response["Content-Disposition"] = 'attachment; filename="replenishment.xlsx"'
    wb.save(response)
    return response
```

### SheetJS — parse an uploaded Excel file in the browser

```javascript
// MaterialImport.jsx
import * as XLSX from 'xlsx';

function MaterialImport() {
  const [rows, setRows] = useState([]);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target.result;
      const workbook = XLSX.read(buffer, { type: 'buffer' });

      // Use first sheet
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert to array of objects using first row as headers
      const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      const [headerRow, ...dataRows] = json;

      const parsed = dataRows.map(row => ({
        materialCode: row[0],
        description: row[1],
        quantity: Number(row[2]),
        plantCode: row[3],
      }));

      setRows(parsed);
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div>
      <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} />
      {rows.length > 0 && (
        <p>{rows.length} materials parsed — ready for import</p>
      )}
    </div>
  );
}
```

---

## 6. Intermediate

### Apache POI cell styles

```java
private static CellStyle createHeaderStyle(XSSFWorkbook wb) {
    CellStyle style = wb.createCellStyle();

    // Bold font
    Font font = wb.createFont();
    font.setBold(true);
    font.setFontHeightInPoints((short) 11);
    style.setFont(font);

    // Background color — light blue
    style.setFillForegroundColor(IndexedColors.LIGHT_BLUE.getIndex());
    style.setFillPattern(FillPatternType.SOLID_FOREGROUND);

    // Borders on all sides
    style.setBorderTop(BorderStyle.THIN);
    style.setBorderBottom(BorderStyle.THIN);
    style.setBorderLeft(BorderStyle.THIN);
    style.setBorderRight(BorderStyle.THIN);

    // Center alignment
    style.setAlignment(HorizontalAlignment.CENTER);

    return style;
}

private static CellStyle createDateStyle(XSSFWorkbook wb) {
    CellStyle style = wb.createCellStyle();
    // Use Excel's built-in date format index 14 = "m/d/yy"
    style.setDataFormat(wb.createDataFormat().getFormat("dd-MMM-yyyy"));
    return style;
}

// Usage — create styles ONCE outside the data loop, reuse per cell
XSSFWorkbook wb = new XSSFWorkbook();
CellStyle headerStyle = createHeaderStyle(wb);
CellStyle dateStyle = createDateStyle(wb);

XSSFRow header = sheet.createRow(0);
for (int col = 0; col < columns.length; col++) {
    XSSFCell cell = header.createCell(col);
    cell.setCellValue(columns[col]);
    cell.setCellStyle(headerStyle);  // reuse the same style object
}
```

### Generate Excel from paginated JPA query

```java
public void writeOrdersToSheet(XSSFSheet sheet, String plantCode) {
    CellStyle numberStyle = createNumberStyle(sheet.getWorkbook());
    int rowNum = 1; // 0 is header
    int pageSize = 500;
    int page = 0;

    Page<Order> batch;
    do {
        batch = orderRepository.findByPlantCode(
            plantCode,
            PageRequest.of(page, pageSize, Sort.by("createdAt"))
        );

        for (Order order : batch.getContent()) {
            XSSFRow row = sheet.createRow(rowNum++);
            row.createCell(0).setCellValue(order.getId());
            row.createCell(1).setCellValue(order.getMaterialCode());

            XSSFCell qtyCell = row.createCell(2);
            qtyCell.setCellValue(order.getQuantity());
            qtyCell.setCellStyle(numberStyle);
        }
        page++;
    } while (batch.hasNext());
}
```

### jsPDF with jspdf-autotable

```javascript
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function exportToPdf(orders, reportTitle) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(reportTitle, 14, 20);

  // Subtitle
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, 28);

  autoTable(doc, {
    startY: 35,
    head: [['Order ID', 'Material', 'Qty', 'Plant', 'Status', 'Created']],
    body: orders.map(o => [
      o.id,
      o.materialCode,
      o.quantity.toLocaleString(),
      o.plantCode,
      o.status,
      new Date(o.createdAt).toLocaleDateString('en-IN'),
    ]),
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    columnStyles: {
      2: { halign: 'right' }, // Qty column — right-align numbers
    },
  });

  doc.save(`orders-${new Date().toISOString().slice(0, 10)}.pdf`);
}
```

### react-to-pdf

```javascript
import { usePDF } from 'react-to-pdf';

function AdherenceReport({ data }) {
  const { targetRef, toPDF } = usePDF({
    filename: `adherence-report-${new Date().toISOString().slice(0, 10)}.pdf`,
    page: {
      margin: 20,
      format: 'A4',
      orientation: 'landscape',
    },
  });

  return (
    <div>
      <button onClick={() => toPDF()}>Download PDF</button>

      {/* Everything inside this div is captured */}
      <div ref={targetRef} style={{ padding: '20px', background: 'white' }}>
        <h2>Weekly Adherence Report</h2>
        <AdherenceTable data={data} />
        <AdherenceChart data={data} />
      </div>
    </div>
  );
}
```

---

## 7. Advanced

### SXSSFWorkbook — streaming for large reports

```java
@GetMapping("/api/production/export/large")
public void exportLargeReport(HttpServletResponse response) throws IOException {

    response.setContentType(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    response.setHeader("Content-Disposition",
        "attachment; filename=\"production-data.xlsx\"");

    // Keep only 500 rows in memory at a time — flushes older rows to disk
    // This allows exporting millions of rows without OOM errors
    try (SXSSFWorkbook wb = new SXSSFWorkbook(500)) {
        SXSSFSheet sheet = wb.createSheet("Production Data");
        sheet.trackAllColumnsForAutoSizing(); // must be called before writing

        // Write headers
        Row headerRow = sheet.createRow(0);
        String[] headers = {"ID", "Material", "Qty", "Plant", "Timestamp"};
        for (int i = 0; i < headers.length; i++) {
            headerRow.createCell(i).setCellValue(headers[i]);
        }

        // Stream data from database in batches
        int rowNum = 1;
        try (Stream<ProductionRecord> stream = productionRepo.streamByDateRange(
                LocalDate.now().minusDays(90), LocalDate.now())) {

            Iterator<ProductionRecord> it = stream.iterator();
            while (it.hasNext()) {
                ProductionRecord rec = it.next();
                Row row = sheet.createRow(rowNum++);
                row.createCell(0).setCellValue(rec.getId());
                row.createCell(1).setCellValue(rec.getMaterialCode());
                row.createCell(2).setCellValue(rec.getQuantity());
                row.createCell(3).setCellValue(rec.getPlantCode());
                row.createCell(4).setCellValue(rec.getTimestamp().toString());
            }
        }

        wb.write(response.getOutputStream());
        wb.dispose(); // delete temp files from disk
    }
}
```

The JPA repository method uses `@Query` with a `Stream<T>` return type backed by `@QueryHints({@QueryHint(name = HINT_FETCH_SIZE, value = "500")})` to stream database rows without loading all of them into memory at once.

### ExcelJS streaming write to HTTP response (Node.js)

```javascript
// GET /api/export/orders
async function exportOrdersExcel(req, res) {
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.xlsx"`
  );

  // StreamWriter pipes directly to the HTTP response — no intermediate buffer
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res });
  const sheet = workbook.addWorksheet('Orders');

  // Define columns with widths
  sheet.columns = [
    { header: 'Order ID', key: 'id', width: 12 },
    { header: 'Material', key: 'material', width: 20 },
    { header: 'Quantity', key: 'quantity', width: 12 },
    { header: 'Plant', key: 'plant', width: 10 },
  ];

  // Style the header row
  sheet.getRow(1).eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2980B9' },
    };
  });
  sheet.getRow(1).commit();

  // Stream rows from database cursor
  const cursor = await OrderModel.find({ plant: req.query.plant }).cursor();
  for await (const order of cursor) {
    sheet.addRow({
      id: order._id.toString(),
      material: order.materialCode,
      quantity: order.quantity,
      plant: order.plantCode,
    }).commit(); // commit() flushes row to stream — don't hold rows in memory
  }

  await workbook.commit(); // finalise the ZIP archive and close the stream
}
```

### XlsxWriter with charts (Python)

```python
import xlsxwriter

def export_logistics_report_with_chart(data, output_path):
    workbook = xlsxwriter.Workbook(output_path)
    worksheet = workbook.add_worksheet("Logistics")

    # Formats
    header_fmt = workbook.add_format({
        'bold': True,
        'bg_color': '#2980B9',
        'font_color': 'white',
        'border': 1,
    })
    number_fmt = workbook.add_format({'num_format': '#,##0'})

    # Headers
    headers = ['Week', 'Dispatched', 'Delivered', 'Pending']
    for col, header in enumerate(headers):
        worksheet.write(0, col, header, header_fmt)

    # Data
    for row, record in enumerate(data, start=1):
        worksheet.write(row, 0, record['week'])
        worksheet.write(row, 1, record['dispatched'], number_fmt)
        worksheet.write(row, 2, record['delivered'], number_fmt)
        worksheet.write(row, 3, record['pending'], number_fmt)

    # Add a line chart — XlsxWriter supports charts; openpyxl does not
    chart = workbook.add_chart({'type': 'line'})
    n = len(data)

    chart.add_series({
        'name': 'Dispatched',
        'categories': ['Logistics', 1, 0, n, 0],
        'values':     ['Logistics', 1, 1, n, 1],
        'line':       {'color': '#2980B9'},
    })
    chart.add_series({
        'name': 'Delivered',
        'categories': ['Logistics', 1, 0, n, 0],
        'values':     ['Logistics', 1, 2, n, 2],
        'line':       {'color': '#27AE60'},
    })

    chart.set_title({'name': 'Weekly Logistics Performance'})
    chart.set_x_axis({'name': 'Week'})
    chart.set_y_axis({'name': 'Units'})

    worksheet.insert_chart('F2', chart, {'x_scale': 2, 'y_scale': 1.5})
    workbook.close()
```

---

## 8. Expert

### Excel template filling with Apache POI

For complex reports with pre-designed formatting, formulas, and charts, filling a template is better than building the workbook from scratch:

```java
public byte[] fillAdherenceTemplate(List<PlantAdherence> data) throws IOException {
    // Load the template from classpath resources
    try (InputStream template = getClass().getResourceAsStream(
            "/templates/adherence-template.xlsx");
         XSSFWorkbook wb = new XSSFWorkbook(template)) {

        XSSFSheet dataSheet = wb.getSheet("Data");
        XSSFSheet summarySheet = wb.getSheet("Summary");

        // Find the named range where data should start
        Name dataRange = wb.getName("DATA_START");
        AreaReference areaRef = new AreaReference(dataRange.getRefersToFormula(),
            SpreadsheetVersion.EXCEL2007);
        int startRow = areaRef.getFirstCell().getRow();
        int startCol = areaRef.getFirstCell().getCol();

        // Write data starting at the named range
        for (int i = 0; i < data.size(); i++) {
            PlantAdherence pa = data.get(i);
            Row row = dataSheet.getRow(startRow + i);
            if (row == null) row = dataSheet.createRow(startRow + i);

            row.getCell(startCol, CREATE_NULL_AS_BLANK).setCellValue(pa.getPlantCode());
            row.getCell(startCol + 1, CREATE_NULL_AS_BLANK).setCellValue(pa.getTarget());
            row.getCell(startCol + 2, CREATE_NULL_AS_BLANK).setCellValue(pa.getActual());
            // The adherence % formula is already in the template — it recalculates
        }

        // Force formula recalculation on open
        wb.setForceFormulaRecalculation(true);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        wb.write(out);
        return out.toByteArray();
    }
}
```

### CSV streaming with OpenCSV for millions of rows

When the consumer only needs CSV (data analysts, ETL pipelines), avoid Excel overhead entirely:

```java
@GetMapping("/api/material-master/export/csv")
public void exportMaterialMasterCsv(HttpServletResponse response) throws IOException {
    response.setContentType("text/csv; charset=UTF-8");
    response.setHeader("Content-Disposition",
        "attachment; filename=\"material-master.csv\"");

    // BufferedWriter wraps the servlet output stream for efficiency
    try (BufferedWriter bw = new BufferedWriter(
            new OutputStreamWriter(response.getOutputStream(), StandardCharsets.UTF_8));
         CSVWriter csvWriter = new CSVWriter(bw)) {

        // Write header
        csvWriter.writeNext(new String[]{"Code", "Description", "UOM", "Plant", "Type"});

        // Stream from database in chunks of 1000 — never loads all rows into memory
        materialRepository.streamAll().forEach(m -> {
            csvWriter.writeNext(new String[]{
                m.getCode(),
                m.getDescription(),
                m.getUnitOfMeasure(),
                m.getPlantCode(),
                m.getMaterialType()
            });
        });
    }
}
```

### Papaparse web worker mode for large CSV uploads

```javascript
import Papa from 'papaparse';

function handleLargeCsvUpload(file, onComplete) {
  let rowCount = 0;
  const rows = [];

  Papa.parse(file, {
    // worker: true offloads parsing to a Web Worker — UI stays responsive
    // even for 500k row files
    worker: true,
    header: true,

    // step is called for each row as it is parsed (streaming, not all-at-once)
    step: (result) => {
      if (result.errors.length > 0) {
        console.warn('Parse error at row', rowCount, result.errors);
        return;
      }
      rows.push(result.data);
      rowCount++;

      // Optional progress callback every 1000 rows
      if (rowCount % 1000 === 0) {
        onProgress?.(rowCount);
      }
    },

    complete: () => {
      console.log(`Parsed ${rowCount} rows`);
      onComplete(rows);
    },

    error: (error) => {
      console.error('Fatal parse error:', error);
    },
  });
}
```

---

## 9. In the TML Codebase

### Apache POI — ep-production-broadcast

The weekly adherence report is generated as an Excel file and sent as an email attachment via Amazon SES. The report generation is triggered by a `@Scheduled` cron job every Monday morning. Cell styles for the adherence percentage column use conditional formatting: green fill when actual >= target, red fill when actual < target.

### Apache POI — ep-prolife-service

The production life report generates complex multi-sheet Excel files with data, summary, and chart sheets. Styles are created once in a `StyleFactory` class and reused across all rows. The workbook is built in a Spring `@Service` class and returned as a `byte[]` to the controller, which streams it to the client.

### OpenPyXL — sadhan-auto-rep-backend

The replenishment schedule export uses openpyxl. Plant-specific worksheets are added to a single workbook (one sheet per plant in the BU). The final file is uploaded to an S3 bucket, and a pre-signed URL is returned to the UI for the user to download.

### XlsxWriter — pv-sadhan-logistics

The logistics performance report uses XlsxWriter specifically because it needs charts. openpyxl can read chart data but cannot create new charts from scratch. XlsxWriter writes-only — you cannot read an existing file with it.

### SheetJS — React UIs

Material import flows in several portals use SheetJS to parse uploaded Excel files in the browser before submitting data to the backend API. This gives immediate feedback (row count, validation errors) without a server round-trip for the parse step.

### jsPDF — ep-prolife-service-ui

The shop-floor label printing feature generates a PDF of QR code labels. Each label is a fixed-size rectangle with a QR code image, material code, description, and plant code. jsPDF renders the QR code as a base64 data URL image inside an autoTable cell.

### ExcelJS — ep-eloto

The eloto service generates large Excel downloads (potentially 50k+ rows) using ExcelJS streaming writer. The Node.js service pipes the workbook stream directly to the HTTP response, keeping memory usage flat regardless of result set size.

---

## 10. Quick Reference

### Apache POI workbook creation template

```java
try (XSSFWorkbook wb = new XSSFWorkbook()) {
    XSSFSheet sheet = wb.createSheet("Sheet Name");
    CellStyle headerStyle = createHeaderStyle(wb); // create styles once

    // Header row
    Row header = sheet.createRow(0);
    String[] cols = {"Col A", "Col B", "Col C"};
    for (int i = 0; i < cols.length; i++) {
        Cell cell = header.createCell(i);
        cell.setCellValue(cols[i]);
        cell.setCellStyle(headerStyle);
    }

    // Data rows
    int rowNum = 1;
    for (MyEntity e : entities) {
        Row row = sheet.createRow(rowNum++);
        row.createCell(0).setCellValue(e.getFieldA());
        row.createCell(1).setCellValue(e.getFieldB());
    }

    // Auto-size after writing all data
    for (int i = 0; i < cols.length; i++) sheet.autoSizeColumn(i);

    wb.write(response.getOutputStream());
}
```

### openpyxl read/write patterns

```python
# Read existing file
from openpyxl import load_workbook
wb = load_workbook("input.xlsx")
ws = wb.active
for row in ws.iter_rows(min_row=2, values_only=True):
    code, qty = row[0], row[1]

# Write new file
from openpyxl import Workbook
wb = Workbook()
ws = wb.active
ws.append(["Header A", "Header B"])
ws.append(["value1", 42])
wb.save("output.xlsx")
```

### jspdf-autotable config options

| Option | Description |
|---|---|
| `startY` | Y position (mm from top) where table starts |
| `head` | Array of arrays — table header rows |
| `body` | Array of arrays — table data rows |
| `styles.fontSize` | Font size for all cells |
| `headStyles.fillColor` | Header background as `[r, g, b]` |
| `alternateRowStyles.fillColor` | Alternating row background |
| `columnStyles[n].halign` | Column alignment: `'left'`, `'center'`, `'right'` |
| `margin.left/right/top/bottom` | Page margins in mm |
| `theme` | `'striped'`, `'grid'`, `'plain'` |

### SXSSFWorkbook when-to-use guide

| Row count | API to use | Reason |
|---|---|---|
| < 10,000 | `XSSFWorkbook` | Simple, supports all features including read-back |
| 10,000 – 100,000 | `SXSSFWorkbook(1000)` | Streaming, keeps 1000 rows in memory |
| > 100,000 | `SXSSFWorkbook(500)` + DB streaming | Minimum memory window + cursor-based DB read |
| Any size, Node.js | `ExcelJS.stream.xlsx.WorkbookWriter` | Pipes to HTTP response without buffering |
