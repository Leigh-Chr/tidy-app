/**
 * Script to generate PDF test fixtures for pdf.test.ts
 *
 * Run with: npx tsx scripts/generate-pdf-fixtures.ts
 */
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, '../src/extractors/__fixtures__');

async function generatePdfWithMetadata(): Promise<void> {
  const pdfDoc = await PDFDocument.create();

  // Set document metadata
  pdfDoc.setTitle('Test Document Title');
  pdfDoc.setAuthor('John Doe');
  pdfDoc.setSubject('Test Subject');
  pdfDoc.setKeywords(['test', 'pdf', 'metadata']);
  pdfDoc.setCreator('Test Creator App');
  pdfDoc.setProducer('pdf-lib');
  pdfDoc.setCreationDate(new Date('2024-01-15T10:30:00Z'));
  pdfDoc.setModificationDate(new Date('2024-06-20T14:45:00Z'));

  // Add a page with content
  const page = pdfDoc.addPage([612, 792]); // Letter size
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  page.drawText('This is a test PDF with metadata.', {
    x: 50,
    y: 700,
    size: 12,
    font,
  });

  const pdfBytes = await pdfDoc.save();
  await writeFile(join(FIXTURES_DIR, 'with-metadata.pdf'), pdfBytes);
  console.log('✓ Created with-metadata.pdf');
}

async function generatePdfWithoutMetadata(): Promise<void> {
  const pdfDoc = await PDFDocument.create();

  // Add a page without setting any metadata
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  page.drawText('This is a test PDF without metadata.', {
    x: 50,
    y: 700,
    size: 12,
    font,
  });

  const pdfBytes = await pdfDoc.save();
  await writeFile(join(FIXTURES_DIR, 'no-metadata.pdf'), pdfBytes);
  console.log('✓ Created no-metadata.pdf');
}

async function generateMultiPagePdf(): Promise<void> {
  const pdfDoc = await PDFDocument.create();

  pdfDoc.setTitle('Multi-Page Document');
  pdfDoc.setAuthor('Test Author');

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Add 5 pages
  for (let i = 1; i <= 5; i++) {
    const page = pdfDoc.addPage([612, 792]);
    page.drawText(`Page ${i} of 5`, {
      x: 250,
      y: 400,
      size: 24,
      font,
    });
  }

  const pdfBytes = await pdfDoc.save();
  await writeFile(join(FIXTURES_DIR, 'multi-page.pdf'), pdfBytes);
  console.log('✓ Created multi-page.pdf');
}

async function generateCorruptedPdf(): Promise<void> {
  // Create a file that looks like a PDF but is corrupted
  const corrupted = Buffer.from('%PDF-1.4\nThis is not a valid PDF content\n%%EOF');
  await writeFile(join(FIXTURES_DIR, 'corrupted.pdf'), corrupted);
  console.log('✓ Created corrupted.pdf');
}

async function main(): Promise<void> {
  console.log('Generating PDF test fixtures...\n');

  await mkdir(FIXTURES_DIR, { recursive: true });

  await generatePdfWithMetadata();
  await generatePdfWithoutMetadata();
  await generateMultiPagePdf();
  await generateCorruptedPdf();

  console.log('\n✅ All fixtures generated successfully!');
  console.log(`📁 Location: ${FIXTURES_DIR}`);
}

main().catch(console.error);
