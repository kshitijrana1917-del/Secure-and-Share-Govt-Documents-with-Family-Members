const { PDFDocument, rgb, degrees, StandardFonts } = require('pdf-lib');
const fs = require('fs');

async function test() {
    try {
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        
        page.drawText('GovSecure Vault\nDownloaded by: test@example.com\nDate: 2026-04-30', {
            x: 50,
            y: 400,
            size: 24,
            font: font,
            color: rgb(0.9, 0.2, 0.2),
            rotate: degrees(-45),
            opacity: 0.3,
        });
        
        const pdfBytes = await pdfDoc.save();
        fs.writeFileSync('test-watermark.pdf', pdfBytes);
        console.log("PDF generated successfully.");
    } catch (e) {
        console.error(e);
    }
}
test();
