import { Document, Packer, Paragraph, TextRun } from "docx";

export async function downloadAsDocx(content: string, fileName: string): Promise<void> {
  // Split content into paragraphs (by double newlines or single newlines)
  const lines = content.split('\n');

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

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
