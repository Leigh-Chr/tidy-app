/**
 * Script to generate Office document test fixtures.
 *
 * Creates minimal OOXML documents (docx, xlsx, pptx) for testing.
 * OOXML files are ZIP archives with specific XML structure.
 *
 * Run with: npx tsx scripts/generate-office-fixtures.ts
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, '../src/extractors/__fixtures__');

// Dublin Core namespace prefixes
const CORE_XML_HEADER = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:dcterms="http://purl.org/dc/terms/"
  xmlns:dcmitype="http://purl.org/dc/dcmitype/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">`;

const CORE_XML_FOOTER = `</cp:coreProperties>`;

async function createDocx(
  filename: string,
  metadata: { title?: string; creator?: string; subject?: string; keywords?: string; created?: string; modified?: string }
): Promise<void> {
  const zip = new JSZip();

  // [Content_Types].xml - required for OOXML
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`);

  // _rels/.rels - package relationships
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);

  // word/document.xml - minimal document content
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Test document content.</w:t></w:r></w:p>
  </w:body>
</w:document>`);

  // docProps/core.xml - Dublin Core metadata
  const coreContent = [CORE_XML_HEADER];
  if (metadata.title) coreContent.push(`  <dc:title>${metadata.title}</dc:title>`);
  if (metadata.creator) coreContent.push(`  <dc:creator>${metadata.creator}</dc:creator>`);
  if (metadata.subject) coreContent.push(`  <dc:subject>${metadata.subject}</dc:subject>`);
  if (metadata.keywords) coreContent.push(`  <cp:keywords>${metadata.keywords}</cp:keywords>`);
  if (metadata.created) coreContent.push(`  <dcterms:created xsi:type="dcterms:W3CDTF">${metadata.created}</dcterms:created>`);
  if (metadata.modified) coreContent.push(`  <dcterms:modified xsi:type="dcterms:W3CDTF">${metadata.modified}</dcterms:modified>`);
  coreContent.push(CORE_XML_FOOTER);
  zip.file('docProps/core.xml', coreContent.join('\n'));

  // docProps/app.xml - application properties
  zip.file('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>Microsoft Office Word</Application>
  <AppVersion>16.0</AppVersion>
  <Pages>3</Pages>
  <Words>250</Words>
</Properties>`);

  const content = await zip.generateAsync({ type: 'nodebuffer' });
  await writeFile(join(FIXTURES_DIR, filename), content);
  console.log(`✓ Created ${filename}`);
}

async function createXlsx(
  filename: string,
  metadata: { title?: string; creator?: string }
): Promise<void> {
  const zip = new JSZip();

  // [Content_Types].xml
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`);

  // _rels/.rels
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);

  // xl/workbook.xml
  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheets><sheet name="Sheet1" sheetId="1" r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></sheets>
</workbook>`);

  // xl/worksheets/sheet1.xml
  zip.file('xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData><row r="1"><c r="A1" t="s"><v>Test</v></c></row></sheetData>
</worksheet>`);

  // xl/_rels/workbook.xml.rels
  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`);

  // docProps/core.xml
  const coreContent = [CORE_XML_HEADER];
  if (metadata.title) coreContent.push(`  <dc:title>${metadata.title}</dc:title>`);
  if (metadata.creator) coreContent.push(`  <dc:creator>${metadata.creator}</dc:creator>`);
  coreContent.push(CORE_XML_FOOTER);
  zip.file('docProps/core.xml', coreContent.join('\n'));

  // docProps/app.xml
  zip.file('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>Microsoft Excel</Application>
  <AppVersion>16.0</AppVersion>
</Properties>`);

  const content = await zip.generateAsync({ type: 'nodebuffer' });
  await writeFile(join(FIXTURES_DIR, filename), content);
  console.log(`✓ Created ${filename}`);
}

async function createPptx(
  filename: string,
  metadata: { title?: string; creator?: string }
): Promise<void> {
  const zip = new JSZip();

  // [Content_Types].xml
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`);

  // _rels/.rels
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);

  // ppt/presentation.xml
  zip.file('ppt/presentation.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst>
</p:presentation>`);

  // ppt/_rels/presentation.xml.rels
  zip.file('ppt/_rels/presentation.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
</Relationships>`);

  // ppt/slides/slide1.xml
  zip.file('ppt/slides/slide1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:nvGrpSpPr/><p:grpSpPr/></p:spTree></p:cSld>
</p:sld>`);

  // docProps/core.xml
  const coreContent = [CORE_XML_HEADER];
  if (metadata.title) coreContent.push(`  <dc:title>${metadata.title}</dc:title>`);
  if (metadata.creator) coreContent.push(`  <dc:creator>${metadata.creator}</dc:creator>`);
  coreContent.push(CORE_XML_FOOTER);
  zip.file('docProps/core.xml', coreContent.join('\n'));

  // docProps/app.xml
  zip.file('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>Microsoft Office PowerPoint</Application>
  <AppVersion>16.0</AppVersion>
</Properties>`);

  const content = await zip.generateAsync({ type: 'nodebuffer' });
  await writeFile(join(FIXTURES_DIR, filename), content);
  console.log(`✓ Created ${filename}`);
}

async function createCorruptedDocx(): Promise<void> {
  // Create a file that looks like a docx but has invalid structure
  const corrupted = Buffer.from('PK\x03\x04This is not a valid OOXML file');
  await writeFile(join(FIXTURES_DIR, 'corrupted.docx'), corrupted);
  console.log('✓ Created corrupted.docx');
}

async function createNoMetadataDocx(): Promise<void> {
  const zip = new JSZip();

  // Minimal docx without docProps
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:p><w:r><w:t>No metadata.</w:t></w:r></w:p></w:body>
</w:document>`);

  const content = await zip.generateAsync({ type: 'nodebuffer' });
  await writeFile(join(FIXTURES_DIR, 'no-metadata.docx'), content);
  console.log('✓ Created no-metadata.docx');
}

async function main(): Promise<void> {
  console.log('Generating Office document test fixtures...\n');

  await mkdir(FIXTURES_DIR, { recursive: true });

  // Word document with full metadata
  await createDocx('with-metadata.docx', {
    title: 'Test Word Document',
    creator: 'John Doe',
    subject: 'Test Subject',
    keywords: 'test, word, document',
    created: '2024-01-15T10:30:00Z',
    modified: '2024-06-20T14:45:00Z',
  });

  // Word document without metadata
  await createNoMetadataDocx();

  // Excel spreadsheet
  await createXlsx('spreadsheet.xlsx', {
    title: 'Test Spreadsheet',
    creator: 'Jane Smith',
  });

  // PowerPoint presentation
  await createPptx('presentation.pptx', {
    title: 'Test Presentation',
    creator: 'Bob Wilson',
  });

  // Corrupted document
  await createCorruptedDocx();

  console.log('\n✅ All fixtures generated successfully!');
  console.log(`📁 Location: ${FIXTURES_DIR}`);
}

main().catch(console.error);
