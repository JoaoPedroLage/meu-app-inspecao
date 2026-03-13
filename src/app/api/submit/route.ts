import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { Storage } from '@google-cloud/storage';
import nodemailer from 'nodemailer';
import { jsPDF } from 'jspdf';

// --- Interfaces para os dados do formulário ---
interface HeaderData {
  departamento: string;
  encarregado: string;
  responsavelQSMS: string;
  gerenteContrato: string;
  unidade: string;
  data: string;
  hora: string;
  local: string;
  emailCompanhia: string;
}

interface Participant {
  nome: string;
  funcao: string;
}

interface InspectionItem {
  id: string;
  item: number;
  fato: string;
  recomendacoes: string;
  prazo: string;
  responsavel: string;
  status: string; // <-- NOVO CAMPO
  conclusao: string;
  fotos?: string[]; // <-- ALTERADO: Esperado como array de base64 data URLs
}

interface ConclusionData {
  conclusaoGeral: string;
}

interface Signatures {
  responsavelInspecao: string; // Esperado como base64 data URL
  responsavelUnidade: string; // Esperado como base64 data URL
}

interface RequestBody {
  headerData: HeaderData;
  participants: Participant[];
  inspectionItems: InspectionItem[];
  conclusionData: ConclusionData;
  signatures: Signatures;
}

interface UploadResult {
  url: string;
  success: boolean;
  error?: string;
}

/**
 * Faz o upload de uma imagem para Google Cloud Storage com tratamento robusto de erros
 */
async function uploadImageToCloudStorage(base64Data: string, fileName: string): Promise<UploadResult> {
  console.log(`🚀🚀🚀 ENTRANDO na uploadImageToCloudStorage para: ${fileName}`);
  
  // Verificações iniciais
  if (!base64Data || !base64Data.startsWith('data:image')) {
      console.log(`❌ SAINDO CEDO de uploadImageToCloudStorage para ${fileName}: dados inválidos`);
      return { url: '', success: false, error: 'Dados de imagem inválidos ou ausentes' };
  }

  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;

  if (!projectId || !bucketName) {
      const error = 'Configurações do Google Cloud Storage não encontradas nas variáveis de ambiente';
      console.error(`⚠️ ${error}`);
      return { url: '', success: false, error };
  }

  console.log(`✅ PRÉ-REQUISITOS OK para ${fileName}. Iniciando upload...`);

  try {
      const storage = new Storage({
          projectId,
          credentials: {
              client_email: process.env.GOOGLE_CLIENT_EMAIL,
              private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          }
      });

      const bucket = storage.bucket(bucketName);

      // Processar a imagem base64
      const mimeType = base64Data.substring(base64Data.indexOf(':') + 1, base64Data.indexOf(';'));
      const imageData = base64Data.substring(base64Data.indexOf(',') + 1);
      const buffer = Buffer.from(imageData, 'base64');

      console.log(`📊 Dados da imagem:`, { mimeType, bufferSize: buffer.length, fileName });

      // Upload do arquivo
      const file = bucket.file(fileName);

      console.log(`📤 Fazendo upload para Cloud Storage: gs://${bucketName}/${fileName}`);

      await file.save(buffer, {
          metadata: {
              contentType: mimeType,
              cacheControl: 'public, max-age=31536000',
          },
      });

      console.log(`✅ Arquivo ${fileName} enviado com sucesso`);

      const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
      console.log(`🎉 Upload concluído: ${fileName} -> ${publicUrl}`);
      
      return { url: publicUrl, success: true };

  } catch (error) {
      let errorMessage = 'Erro desconhecido durante o upload.';
      if (error instanceof Error) {
          errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
          const gcpError = error as { errors?: { message?: string }[]; message?: string };
          errorMessage = gcpError.errors?.[0]?.message || gcpError.message || JSON.stringify(error);
      }

      console.error(`💥 ERRO DETALHADO no upload de ${fileName}:`, errorMessage);
      console.error(`Erro na íntegra: `, error);

      return { url: '', success: false, error: errorMessage };
  }
}

/**
 * Verifica se a assinatura está em branco analisando os pixels da imagem
 */
function isSignatureBlank(base64Data: string): boolean {
  if (!base64Data || !base64Data.startsWith('data:image')) {
    return true;
  }

  try {
    const imageData = base64Data.substring(base64Data.indexOf(',') + 1);
    const buffer = Buffer.from(imageData, 'base64');

    if (buffer.length < 500) {
      return true;
    }

    const bufferString = buffer.toString('hex');
    const whitePixelPattern = /ffffff/g;
    const whitePixelMatches = bufferString.match(whitePixelPattern);
    const totalLength = bufferString.length;
    const whiteRatio = whitePixelMatches ? (whitePixelMatches.length * 6) / totalLength : 0;

    console.log(`🔍 Análise da assinatura:`, {
      bufferSize: buffer.length,
      whiteRatio: whiteRatio.toFixed(3),
      isBlank: whiteRatio > 0.95 || buffer.length < 1000
    });

    return whiteRatio > 0.95 || buffer.length < 1000;

  } catch (error) {
    console.error('Erro ao analisar assinatura:', error);
    return false;
  }
}

/**
 * Gera PDF do relatório de inspeção
 */
function generateInspectionPDF(
  data: RequestBody, 
  inspectionId: string, 
  signatureUrls: { signature1: string; signature2: string },
  evidenceUrls: { [key: number]: string[] } // <-- ALTERADO: Agora recebe array de URLs
): Buffer {
  const doc = new jsPDF();
  
  // Configurações do PDF
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPosition = 20;
  
  // Função para adicionar texto com quebra de linha
  const addText = (text: string, fontSize: number = 12, isBold: boolean = false) => {
    doc.setFontSize(fontSize);
    if (isBold) {
      doc.setFont('helvetica', 'bold');
    } else {
      doc.setFont('helvetica', 'normal');
    }
    
    const lines = doc.splitTextToSize(text, pageWidth - 2 * margin);
    lines.forEach((line: string) => {
      if (yPosition > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text(line, margin, yPosition);
      yPosition += fontSize * 0.4;
    });
    yPosition += 5;
  };

  // Função para adicionar link clicável
  const addLink = (text: string, url: string, fontSize: number = 10) => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 255); // Cor azul para links
    
    const lines = doc.splitTextToSize(text, pageWidth - 2 * margin);
    const startY = yPosition;
    
    lines.forEach((line: string) => {
      if (yPosition > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text(line, margin, yPosition);
      yPosition += fontSize * 0.4;
    });
    
    // Adicionar anotação de link usando coordenadas corretas
    const textHeight = fontSize * 0.4;
    const linkHeight = lines.length * textHeight;
    doc.link(margin, startY - textHeight, pageWidth - 2 * margin, linkHeight, { url: url });
    
    yPosition += 5;
    
    // Resetar cor para texto normal
    doc.setTextColor(0, 0, 0);
  };

  // Cabecalho
  addText('RELATORIO DE INSPECAO', 16, true);
  addText(`ID: ${inspectionId}`, 12, true);
  addText(`Data: ${data.headerData.data} | Hora: ${data.headerData.hora}`, 10);
  yPosition += 10;

  // Dados do cabecalho
  addText('DADOS DA INSPECAO', 14, true);
  addText(`Departamento: ${data.headerData.departamento}`, 10);
  addText(`Encarregado: ${data.headerData.encarregado}`, 10);
  addText(`Responsavel QSMS: ${data.headerData.responsavelQSMS}`, 10);
  addText(`Gerente de Contrato: ${data.headerData.gerenteContrato}`, 10);
  addText(`Unidade: ${data.headerData.unidade}`, 10);
  addText(`Local: ${data.headerData.local}`, 10);
  addText(`E-mail: ${data.headerData.emailCompanhia}`, 10);
  yPosition += 10;

  // Participantes
  addText('PARTICIPANTES', 14, true);
  data.participants.forEach((participant, index) => {
    addText(`${index + 1}. ${participant.nome} - ${participant.funcao}`, 10);
  });
  yPosition += 10;

  // Itens de inspecao
  if (data.inspectionItems.length > 0) {
    addText('ITENS DE INSPECAO', 14, true);
    data.inspectionItems.forEach((item, index) => {
      addText(`Item ${item.item}:`, 12, true);
      addText(`Fato Observado: ${item.fato}`, 10);
      
      // Evidência fotográfica com hyperlink (ALTERADO PARA MÚLTIPLAS)
      addText('Evidências Fotográficas:', 10);
      const itemEvidences = evidenceUrls[index] || [];
      
      if (itemEvidences.length === 0 || (itemEvidences.length === 1 && itemEvidences[0] === 'Nenhuma')) {
        addText('Nenhuma', 10);
      } else {
        itemEvidences.forEach((evidenceUrl, pIndex) => {
          if (!evidenceUrl.includes('❌')) {
            addLink(`Ver Evidência ${pIndex + 1}`, evidenceUrl, 10);
          } else {
            addText(evidenceUrl, 10);
          }
        });
      }
      
      addText(`Recomendações: ${item.recomendacoes}`, 10);
      addText(`Prazo: ${item.prazo}`, 10);
      addText(`Responsável: ${item.responsavel}`, 10);
      addText(`Status: ${item.status}`, 10); // <-- NOVO CAMPO
      addText(`Conclusão: ${item.conclusao}`, 10);
      yPosition += 5;
    });
  }

  // Conclusao geral
  addText('CONCLUSAO GERAL', 14, true);
  addText(data.conclusionData.conclusaoGeral, 10);
  yPosition += 10;

  // Assinaturas
  addText('ASSINATURAS', 14, true);
  
  // Assinatura 1
  addText('Responsavel pela Inspecao:', 10, true);
  if (signatureUrls.signature1 && signatureUrls.signature1 !== 'Não assinado' && !signatureUrls.signature1.includes('❌')) {
    addLink('Ver Assinatura', signatureUrls.signature1, 10);
  } else {
    addText(signatureUrls.signature1.includes('❌') ? signatureUrls.signature1 : 'Não assinado', 10);
  }
  
  // Assinatura 2
  addText('Responsavel da Unidade:', 10, true);
  if (signatureUrls.signature2 && signatureUrls.signature2 !== 'Não assinado' && !signatureUrls.signature2.includes('❌')) {
    addLink('Ver Assinatura', signatureUrls.signature2, 10);
  } else {
    addText(signatureUrls.signature2.includes('❌') ? signatureUrls.signature2 : 'Não assinado', 10);
  }

  return Buffer.from(doc.output('arraybuffer'));
}

/**
 * Envia e-mail com PDF anexado
 */
async function sendEmailWithPDF(email: string, pdfBuffer: Buffer, inspectionId: string): Promise<boolean> {
  try {
    // Configuração do transporter (usando Gmail como exemplo)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: `Relatório de Inspeção - ${inspectionId}`,
      text: `Segue em anexo o relatório de inspeção ${inspectionId}.`,
      attachments: [
        {
          filename: `relatorio_inspecao_${inspectionId}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ E-mail enviado com sucesso para: ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Erro ao enviar e-mail:', error);
    return false;
  }
}

/**
 * Função para testar conectividade com Google Cloud Storage
 */
async function testCloudStorageConnection(): Promise<boolean> {
  console.log("🔧 TESTE DE CONECTIVIDADE - Iniciando teste do Google Cloud Storage...");

  try {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;

    if (!projectId || !bucketName) {
      console.log("❌ Configurações do Google Cloud Storage não encontradas");
      return false;
    }

    const storage = new Storage({
      projectId,
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }
    });

    console.log("📋 Teste 1: Verificando acesso ao projeto...");
    const [buckets] = await storage.getBuckets();
    console.log("✅ Teste 1 PASSOU:", {
      projeto: projectId,
      bucketsEncontrados: buckets.length,
      primeirosBuckets: buckets.slice(0, 3).map((bucket) => bucket.name)
    });

    console.log("📋 Teste 2: Verificando bucket específico...");
    const bucket = storage.bucket(bucketName);
    const [exists] = await bucket.exists();

    if (!exists) {
      console.log(`⚠️ Bucket ${bucketName} não existe, mas pode ser criado automaticamente`);
    } else {
      console.log("✅ Teste 2 PASSOU:", {
        bucketName,
        exists: true
      });
    }

    console.log("🎉 TODOS OS TESTES DE CLOUD STORAGE PASSARAM!");
    return true;

  } catch (error) {
    console.error("💥 FALHA NO TESTE DE CLOUD STORAGE:");
    console.error("Tipo:", typeof error);
    console.error("Mensagem:", error instanceof Error ? error.message : String(error));

    return false;
  }
}

// --- Handler principal da API (usando App Router) ---
export async function POST(request: NextRequest) {
  console.log("🔥 API ROUTE: Recebendo requisição POST");

  try {
    console.log("📥 Tentando fazer parse do JSON...");
    const body: RequestBody = await request.json();
    console.log("✅ JSON parseado com sucesso");

    const { headerData, participants, inspectionItems, conclusionData, signatures } = body;

    console.log("📊 Dados recebidos:", {
      headerData: !!headerData,
      participantsCount: participants?.length || 0,
      itemsCount: inspectionItems?.length || 0,
      hasConclusion: !!conclusionData?.conclusaoGeral,
      hasSignatures: !!(signatures?.responsavelInspecao && signatures?.responsavelUnidade)
    });

    // Configuração das variáveis de ambiente com validação
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;
    if (!privateKey) {
      console.log("❌ GOOGLE_PRIVATE_KEY não encontrada");
      throw new Error('GOOGLE_PRIVATE_KEY não encontrada');
    }

    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    if (!clientEmail) {
      console.log("❌ GOOGLE_CLIENT_EMAIL não encontrada");
      throw new Error('GOOGLE_CLIENT_EMAIL não encontrada');
    }

    // Autenticação para Google Sheets
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    console.log(`🔐 Autenticação configurada com: ${clientEmail}`);

    // *** TESTE DE CONECTIVIDADE com Cloud Storage ***
    console.log("🚀 Executando teste de conectividade com Google Cloud Storage...");
    const storageConnected = await testCloudStorageConnection();

    if (!storageConnected) {
      console.log("❌ Conexão com Google Cloud Storage falhou, mas continuando...");
    }

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    console.log("📊 GOOGLE_SHEET_ID:", spreadsheetId);
    if (!spreadsheetId) {
      console.log("❌ GOOGLE_SHEET_ID não encontrada");
      throw new Error('GOOGLE_SHEET_ID não encontrada');
    }

    // Preparação dos dados para a planilha
    const inspectionId = `INSPEC-${Date.now()}`;
    const participantNames = participants.map(p => p.nome).join(', ');
    const participantFunctions = participants.map(p => p.funcao).join(', ');

    // Preparar URLs para o PDF (serão preenchidas após o upload das imagens)
    const signatureUrls = { signature1: 'Não assinado', signature2: 'Não assinado' };
    const evidenceUrls: { [key: number]: string[] } = {}; // <-- ALTERADO: ARRAY DE URLS

    // Verificar se as assinaturas estão em branco
    const signature1IsBlank = signatures.responsavelInspecao === 'Não assinado' || isSignatureBlank(signatures.responsavelInspecao);
    const signature2IsBlank = signatures.responsavelUnidade === 'Não assinado' || isSignatureBlank(signatures.responsavelUnidade);

    console.log("✍️ Status das assinaturas:", {
      signature1IsBlank,
      signature2IsBlank,
      signature1Type: typeof signatures.responsavelInspecao,
      signature2Type: typeof signatures.responsavelUnidade,
      signature1Preview: signatures.responsavelInspecao.substring(0, 50) + '...'
    });

    // Upload das assinaturas para Cloud Storage com tratamento de erros
    console.log(`🧪 Testando upload das assinaturas...`);

    const signature1Result: UploadResult = signature1IsBlank ?
      { url: '', success: true, error: 'Assinatura não fornecida' } :
      await uploadImageToCloudStorage(signatures.responsavelInspecao, `assinaturas/Assinatura_Inspecao_${inspectionId}.png`);

    const signature2Result: UploadResult = signature2IsBlank ?
      { url: '', success: true, error: 'Assinatura não fornecida' } :
      await uploadImageToCloudStorage(signatures.responsavelUnidade, `assinaturas/Assinatura_Unidade_${inspectionId}.png`);

    console.log(`📋 Resultados dos uploads de assinatura:`, {
      signature1: {
        success: signature1Result.success,
        url: signature1Result.url || 'Vazio',
        error: signature1Result.error || 'N/A'
      },
      signature2: {
        success: signature2Result.success,
        url: signature2Result.url || 'Vazio',
        error: signature2Result.error || 'N/A'
      }
    });
    
    // Lógica para determinar o texto/link das assinaturas
    let signatureLink1 = 'Não assinado';
    if (!signature1IsBlank) {
      if (signature1Result.success && signature1Result.url) {
        signatureLink1 = `=HYPERLINK("${signature1Result.url}"; "Ver Assinatura")`;
        signatureUrls.signature1 = signature1Result.url; // URL para o PDF
      } else {
        signatureLink1 = `❌ Falha no upload: ${signature1Result.error || 'Erro desconhecido'}`;
        signatureUrls.signature1 = `❌ Falha no upload: ${signature1Result.error || 'Erro desconhecido'}`;
      }
    }

    let signatureLink2 = 'Não assinado';
    if (!signature2IsBlank) {
      if (signature2Result.success && signature2Result.url) {
        signatureLink2 = `=HYPERLINK("${signature2Result.url}"; "Ver Assinatura")`;
        signatureUrls.signature2 = signature2Result.url; // URL para o PDF
      } else {
        signatureLink2 = `❌ Falha no upload: ${signature2Result.error || 'Erro desconhecido'}`;
        signatureUrls.signature2 = `❌ Falha no upload: ${signature2Result.error || 'Erro desconhecido'}`;
      }
    }

    // Mapear os itens e fazer upload das evidências com tratamento de erros
    console.log(`📷 Processando ${inspectionItems.length} itens de inspeção...`);

    const rowsToAppend = await Promise.all(
      inspectionItems.map(async (item, index) => {
        console.log(`📸 Processando item ${index + 1}:`, {
          hasPhotos: !!item.fotos && item.fotos.length > 0
        });

        let uploadedUrls: string[] = [];
        let evidenceText = 'Nenhuma';

        // Lógica para MÚLTIPLAS FOTOS
        if (item.fotos && item.fotos.length > 0 && item.fotos[0] !== 'Nenhuma') {
          // Promise.all para subir todas as fotos do item simultaneamente
          const uploadPromises = item.fotos.map((base64Foto, pIndex) => 
            uploadImageToCloudStorage(base64Foto, `evidencias/Evidencia_${inspectionId}_Item_${index + 1}_Foto_${pIndex + 1}.png`)
          );
          
          const photoResults = await Promise.all(uploadPromises);
          
          uploadedUrls = photoResults.map((res, i) => {
            console.log(`📸 Resultado do upload da evidência ${index + 1} (Foto ${i + 1}):`, {
              success: res.success,
              url: res.url || 'Vazio',
              error: res.error || 'N/A'
            });
            return res.success && res.url ? res.url : `❌ Erro Foto ${i + 1}: ${res.error}`;
          });
          
          // Formatação para o Google Sheets
          if (uploadedUrls.length === 1 && photoResults[0].success) {
            evidenceText = `=HYPERLINK("${uploadedUrls[0]}"; "Ver Evidência")`;
          } else {
            // Sheets quebra com múltiplos HYPERLINKS. Injetamos as URLs cruas separadas por quebra de linha.
            evidenceText = uploadedUrls.join('\n');
          }
        }

        evidenceUrls[index] = uploadedUrls.length > 0 ? uploadedUrls : ['Nenhuma'];

        return [
          inspectionId,
          headerData.data || '',
          headerData.hora || '',
          headerData.departamento || '',
          headerData.encarregado || '',
          headerData.responsavelQSMS || '',
          headerData.gerenteContrato || '',
          headerData.unidade || '',
          headerData.local || '',
          headerData.emailCompanhia || '',
          participantNames,
          participantFunctions,
          item.fato || '',
          item.recomendacoes || '',
          item.prazo || '',
          item.responsavel || '',
          item.status || '',
          item.conclusao || '',
          evidenceText,
          conclusionData.conclusaoGeral || '',
          signatureLink1,
          signatureLink2,
        ];
      })
    );

    // Tratamento para formulários sem itens de inspeção
    if (rowsToAppend.length === 0) {
      rowsToAppend.push([
        inspectionId, headerData.data || '', headerData.hora || '', headerData.departamento || '',
        headerData.encarregado || '', headerData.responsavelQSMS || '', headerData.gerenteContrato || '',
        headerData.unidade || '', headerData.local || '', headerData.emailCompanhia || '', participantNames, participantFunctions,
        'N/A', 'Nenhum item de inspeção foi adicionado.', '', '', 'N/A', '', 'Nenhuma', // Status preenchido com N/A
        conclusionData.conclusaoGeral || '',
        signatureLink1,
        signatureLink2,
      ]);
    }

    console.log("📝 Dados formatados para planilha:", rowsToAppend.length, "linhas");

    // Gerar PDF do relatório com URLs das assinaturas e evidências
    console.log("📄 Gerando PDF do relatório...");
    const pdfBuffer = generateInspectionPDF(body, inspectionId, signatureUrls, evidenceUrls);
    console.log("✅ PDF gerado com sucesso");

    // Enviar e-mail com PDF se o e-mail foi fornecido
    if (headerData.emailCompanhia && headerData.emailCompanhia.trim() !== '') {
      console.log(`📧 Enviando e-mail para: ${headerData.emailCompanhia}`);
      const emailSent = await sendEmailWithPDF(headerData.emailCompanhia, pdfBuffer, inspectionId);
      if (emailSent) {
        console.log("✅ E-mail enviado com sucesso");
      } else {
        console.log("⚠️ Falha no envio do e-mail, mas continuando com o processo");
      }
    } else {
      console.log("⚠️ E-mail da companhia não fornecido, pulando envio de e-mail");
    }

    console.log("📤 Enviando para Google Sheets...");
    const appendResponse = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Mapa de Controle!A:W', // <-- RANGE ATUALIZADO PARA INCLUIR STATUS
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: rowsToAppend,
      },
    });

    console.log("✅ Dados inseridos com sucesso:", {
      updates: appendResponse.data.updates
    });

    return NextResponse.json({ message: 'Dados inseridos com sucesso', inspectionId }, { status: 200 });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error("💥 ERRO na API ROUTE:");
    console.error("Tipo:", typeof error);
    console.error("Mensagem:", errorMessage);
    console.error("Stack:", error instanceof Error ? error.stack : 'N/A');

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
