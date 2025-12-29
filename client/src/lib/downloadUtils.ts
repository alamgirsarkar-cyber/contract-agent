import { Document, Packer, Paragraph, TextRun } from "docx";

export async function downloadAsDocx(content: string, fileName: string): Promise<void> {
  try {
    console.log('Starting DOCX download for:', fileName);
    console.log('Content length:', content.length);

    if (!content || content.trim().length === 0) {
      throw new Error('Cannot download empty content');
    }

    // Split content into paragraphs (by double newlines or single newlines)
    const lines = content.split('\n');
    console.log('Number of lines:', lines.length);

    const paragraphs = lines.map(line =>
      new Paragraph({
        children: [
          new TextRun({
            text: line || ' ', // Empty line for spacing
            size: 24, // 12pt font (size is in half-points)
          }),
        ],
        spacing: {
          after: 120, // spacing after paragraph
        },
      })
    );

    const doc = new Document({
      sections: [{
        properties: {},
        children: paragraphs,
      }],
    });

    console.log('Document created, generating blob...');
    const blob = await Packer.toBlob(doc);
    console.log('Blob generated, size:', blob.size, 'bytes');

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.docx`;
    document.body.appendChild(a);
    
    console.log('Triggering download...');
    a.click();
    
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log('Download completed successfully');
  } catch (error) {
    console.error('DOCX download failed:', error);
    console.log('Falling back to TXT download...');
    
    // Fallback to text download if DOCX fails
    try {
      downloadAsTxt(content, fileName);
      console.log('TXT fallback download successful');
    } catch (txtError) {
      console.error('TXT fallback also failed:', txtError);
      throw new Error(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export function downloadAsTxt(content: string, fileName: string): void {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
