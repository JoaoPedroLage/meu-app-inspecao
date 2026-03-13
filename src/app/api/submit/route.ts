import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import nodemailer from 'nodemailer';
import { jsPDF } from 'jspdf';

// Interfaces simplificadas (Base64 foi removido)
interface HeaderData { departamento: string; encarregado: string; responsavelQSMS: string; gerenteContrato: string; unidade: string; data: string; hora: string; local: string; emailCompanhia: string; }
interface Participant { nome: string; funcao: string; }
// INTERFACE ATUALIZADA: conclusao removida
interface InspectionItem { item: number; fato: string; recomendacoes: string; prazo: string; responsavel: string; status: string; fotos: string[]; }
interface ConclusionData { conclusaoGeral: string; }
interface Signatures { responsavelInspecao: string; responsavelUnidade: string; }

interface RequestBody {
  headerData: HeaderData;
  participants: Participant[];
  inspectionItems: InspectionItem[];
  conclusionData: ConclusionData;
  signatures: Signatures;
  inspectionId: string;
}

// A função de PDF não mudou, pois ela já usava as URLs para criar links (HYPERLINKS)
function generateInspectionPDF(data: RequestBody, inspectionId: string): Buffer {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPosition = 20;

  const addText = (text: string, fontSize: number = 12, isBold: boolean = false) => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    const lines = doc.splitTextToSize(text, pageWidth - 2 * margin);
    lines.forEach((line: string) => {
      if (yPosition > doc.internal.pageSize.getHeight() - 20) { doc.addPage(); yPosition = 20; }
      doc.text(line, margin, yPosition);
      yPosition += fontSize * 0.4;
    });
    yPosition += 5;
  };

  const addLink = (text: string, url: string, fontSize: number = 10) => {
    doc.setFontSize(fontSize); doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 255);
    const lines = doc.splitTextToSize(text, pageWidth - 2 * margin);
    const startY = yPosition;
    lines.forEach((line: string) => {
      if (yPosition > doc.internal.pageSize.getHeight() - 20) { doc.addPage(); yPosition = 20; }
      doc.text(line, margin, yPosition);
      yPosition += fontSize * 0.4;
    });
    const linkHeight = lines.length * (fontSize * 0.4);
    doc.link(margin, startY - (fontSize * 0.4), pageWidth - 2 * margin, linkHeight, { url: url });
    yPosition += 5; doc.setTextColor(0, 0, 0);
  };

  addText('RELATÓRIO DE INSPEÇÃO', 16, true);
  addText(`ID: ${inspectionId}`, 12, true);
  addText(`Data: ${data.headerData.data} | Hora: ${data.headerData.hora}`, 10);
  yPosition += 10;

  addText('DADOS DA INSPEÇÃO', 14, true);
  addText(`Departamento: ${data.headerData.departamento}\nEncarregado: ${data.headerData.encarregado}\nResponsável QSMS: ${data.headerData.responsavelQSMS}\nUnidade: ${data.headerData.unidade}\nLocal: ${data.headerData.local}`, 10);
  yPosition += 10;

  if (data.inspectionItems.length > 0) {
    addText('ITENS DE INSPEÇÃO', 14, true);
    data.inspectionItems.forEach((item) => {
      addText(`Item ${item.item}:`, 12, true);
      addText(`Fato Observado: ${item.fato}`, 10);

      addText('Evidências Fotográficas:', 10);
      if (item.fotos.length === 0 || item.fotos[0] === 'Nenhuma') {
        addText('Nenhuma', 10);
      } else {
        item.fotos.forEach((fotoUrl, pIndex) => addLink(`Ver Evidência ${pIndex + 1}`, fotoUrl, 10));
      }

      // ATUALIZADO NO PDF: Conclusão removida
      addText(`Recomendações: ${item.recomendacoes}\nPrazo: ${item.prazo}\nResponsável: ${item.responsavel}\nStatus: ${item.status}`, 10);
      yPosition += 5;
    });
  }
  
  addText('ASSINATURAS', 14, true);

  addText('Responsável pela Inspeção:', 10, true);
  if (data.signatures.responsavelInspecao !== 'Não assinado') {
    addLink('Ver Assinatura', data.signatures.responsavelInspecao, 10);
  } else {
    addText('Não assinado', 10);
  }

  addText('Responsável da Unidade:', 10, true);
  if (data.signatures.responsavelUnidade !== 'Não assinado') {
    addLink('Ver Assinatura', data.signatures.responsavelUnidade, 10);
  } else {
    addText('Não assinado', 10);
  }

  return Buffer.from(doc.output('arraybuffer'));
}

async function sendEmailWithPDF(email: string, pdfBuffer: Buffer, inspectionId: string) {
  try {
    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });
    await transporter.sendMail({
      from: process.env.EMAIL_USER, to: email, subject: `Relatório de Inspeção - ${inspectionId}`,
      text: `Segue em anexo o relatório.`, attachments: [{ filename: `${inspectionId}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
    });
  } catch (error) { console.error('Erro e-mail:', error); }
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { headerData, participants, inspectionItems, conclusionData, signatures, inspectionId } = body;

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const participantNames = participants.map(p => p.nome).join(', ');
    const participantFunctions = participants.map(p => p.funcao).join(', ');

    const sigLink1 = signatures.responsavelInspecao !== 'Não assinado' ? `=HYPERLINK("${signatures.responsavelInspecao}"; "Ver Assinatura")` : 'Não assinado';
    const sigLink2 = signatures.responsavelUnidade !== 'Não assinado' ? `=HYPERLINK("${signatures.responsavelUnidade}"; "Ver Assinatura")` : 'Não assinado';

    // ATUALIZADO: Array de colunas reconstruído sem o 'item.conclusao'
    const rowsToAppend = inspectionItems.map((item) => {
      let evidenceText = 'Nenhuma';
      if (item.fotos.length > 0 && item.fotos[0] !== 'Nenhuma') {
        evidenceText = item.fotos.length === 1 ? `=HYPERLINK("${item.fotos[0]}"; "Ver Evidência")` : item.fotos.join('\n');
      }

      return [
        inspectionId, headerData.data, headerData.hora, headerData.departamento, headerData.encarregado,
        headerData.responsavelQSMS, headerData.gerenteContrato, headerData.unidade, headerData.local, headerData.emailCompanhia,
        participantNames, participantFunctions, item.fato, item.recomendacoes, item.prazo, item.responsavel,
        item.status, evidenceText, conclusionData.conclusaoGeral, sigLink1, sigLink2,
      ];
    });

    if (rowsToAppend.length === 0) {
      // Falha segura ajustada
      rowsToAppend.push([inspectionId, headerData.data, headerData.hora, headerData.departamento, headerData.encarregado, headerData.responsavelQSMS, headerData.gerenteContrato, headerData.unidade, headerData.local, headerData.emailCompanhia, participantNames, participantFunctions, 'N/A', 'Nenhum item', '', '', 'N/A', 'Nenhuma', conclusionData.conclusaoGeral, sigLink1, sigLink2]);
    }

    const pdfBuffer = generateInspectionPDF(body, inspectionId);
    if (headerData.emailCompanhia) await sendEmailWithPDF(headerData.emailCompanhia, pdfBuffer, inspectionId);

    // ATUALIZADO: Range reduzido para refletir a coluna a menos. 
    // Certifique-se de excluir a coluna "Conclusão" na sua planilha real.
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Mapa de Controle!A:U',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rowsToAppend },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Falha interna' }, { status: 500 });
  }
}
