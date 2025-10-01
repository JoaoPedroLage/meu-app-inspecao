import { jsPDF } from 'jspdf';

function testPDFLinks() {
  const doc = new jsPDF();
  // Configurações
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPosition = 20;
  
  // Função para adicionar texto
  const addText = (text, fontSize = 12, isBold = false) => {
    doc.setFontSize(fontSize);
    if (isBold) {
      doc.setFont('helvetica', 'bold');
    } else {
      doc.setFont('helvetica', 'normal');
    }
    
    const lines = doc.splitTextToSize(text, pageWidth - 2 * margin);
    lines.forEach((line) => {
      doc.text(line, margin, yPosition);
      yPosition += fontSize * 0.4;
    });
    yPosition += 5;
  };

  // Função para adicionar link
  const addLink = (text, url, fontSize = 10) => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 255); // Cor azul para links
    
    const lines = doc.splitTextToSize(text, pageWidth - 2 * margin);
    const startY = yPosition;
    
    lines.forEach((line) => {
      doc.text(line, margin, yPosition);
      yPosition += fontSize * 0.4;
    });
    
    // Adicionar anotação de link
    const textHeight = fontSize * 0.4;
    const linkHeight = lines.length * textHeight;
    doc.link(margin, startY - textHeight, pageWidth - 2 * margin, linkHeight, { url: url });
    
    yPosition += 5;
    
    // Resetar cor
    doc.setTextColor(0, 0, 0);
  };

  // Teste
  addText('TESTE DE LINKS NO PDF', 16, true);
  yPosition += 10;
  
  addText('Assinaturas:', 12, true);
  addLink('🔗 Ver Assinatura', 'https://storage.googleapis.com/test/assinatura.png');
  
  addText('Evidências:', 12, true);
  addLink('🔗 Ver Evidência', 'https://storage.googleapis.com/test/evidencia.png');
  
  // Salvar
  doc.save('teste-links-formatado.pdf');
  console.log('PDF de teste com links formatados criado!');
}

testPDFLinks();
