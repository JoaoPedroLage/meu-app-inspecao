import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { Readable } from 'stream';

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
}

interface Participant {
  nome: string;
  funcao: string;
}

interface InspectionItem {
  id: number;
  fato: string;
  recomendacoes: string;
  prazo: string;
  responsavel: string;
  conclusao: string;
  foto?: string; // Esperado como base64 data URL
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

/**
 * Faz o upload de uma imagem em formato base64. Retorna o link ou uma string vazia em caso de falha.
 * Esta função agora é mais resiliente a erros de conexão com o Drive.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function uploadImageToDrive(auth: any, base64Data: string, fileName: string): Promise<string> { 
  // Se não houver imagem, retorna vazio sem tentar o upload.
  if (!base64Data || !base64Data.startsWith('data:image')) {
    return '';
  }

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) {
    console.log('⚠️ GOOGLE_DRIVE_FOLDER_ID não definido. O upload para o Drive será ignorado.');
    return '';
  }

  try {
    console.log(`📤 Iniciando upload para o Drive: ${fileName}`);
    const drive = google.drive({ version: 'v3', auth });

    const mimeType = base64Data.substring(base64Data.indexOf(':') + 1, base64Data.indexOf(';'));
    const imageData = base64Data.substring(base64Data.indexOf(',') + 1);
    const buffer = Buffer.from(imageData, 'base64');
    const stream = Readable.from(buffer);

    const file = await drive.files.create({
      requestBody: { name: fileName, parents: [folderId] },
      media: { mimeType: mimeType, body: stream },
      fields: 'webViewLink',
    });

    console.log(`✅ Upload concluído: ${fileName}`);
    return file.data.webViewLink || '';
  } catch (error) {
    console.error(`❌ Erro no upload de ${fileName}. O formulário continuará sem o link da imagem. Erro:`, error);
    // Retorna uma string vazia em caso de erro para que a lógica principal continue.
    return '';
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

    // Autenticação simplificada e mais adequada para contas pessoais
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey.replace(/\\n/g, '\n'),
      },
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file'
      ],
    });
    console.log(`🔐 Autenticação configurada com: ${clientEmail}`);

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

    // Tenta fazer o upload das assinaturas
    const signatureLink1 = await uploadImageToDrive(auth, signatures.responsavelInspecao, `Assinatura_Inspecao_${inspectionId}.png`);
    const signatureLink2 = await uploadImageToDrive(auth, signatures.responsavelUnidade, `Assinatura_Unidade_${inspectionId}.png`);

    // Mapeia os itens, tentando fazer o upload da foto de cada um
    const rowsToAppend = await Promise.all(
      inspectionItems.map(async (item, index) => {
        const photoLink = await uploadImageToDrive(auth, item.foto || '', `Evidencia_${inspectionId}_Item_${index + 1}.png`);
          
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
          participantNames, 
          participantFunctions,
          item.id || '', 
          item.fato || '', 
          item.recomendacoes || '', 
          item.prazo || '', 
          item.responsavel || '', 
          item.conclusao || '',
          
          // LÓGICA DE FALLBACK PARA IMAGEM
          photoLink ? `=HYPERLINK("${photoLink}", "Ver Evidência")` : (item.foto ? 'Falha no upload' : 'Nenhuma'),
          
          conclusionData.conclusaoGeral || '',
          
          // LÓGICA DE FALLBACK PARA ASSINATURAS
          signatureLink1 ? `=HYPERLINK("${signatureLink1}", "Ver Assinatura")` : (signatures.responsavelInspecao ? 'Assinado Digitalmente' : ''),
          signatureLink2 ? `=HYPERLINK("${signatureLink2}", "Ver Assinatura")` : (signatures.responsavelUnidade ? 'Assinado Digitalmente' : ''),
        ];
      })
    );
    
    // Tratamento para formulários sem itens de inspeção
    if (rowsToAppend.length === 0) {
      rowsToAppend.push([
        inspectionId, headerData.data || '', headerData.hora || '', headerData.departamento || '',
        headerData.encarregado || '', headerData.responsavelQSMS || '', headerData.gerenteContrato || '',
        headerData.unidade || '', headerData.local || '', participantNames, participantFunctions,
        'N/A', 'Nenhum item de inspeção foi adicionado.', '', '', '', '', 'Nenhuma',
        conclusionData.conclusaoGeral || '',
        signatureLink1 ? `=HYPERLINK("${signatureLink1}", "Ver Assinatura")` : (signatures.responsavelInspecao ? 'Assinado Digitalmente' : ''),
        signatureLink2 ? `=HYPERLINK("${signatureLink2}", "Ver Assinatura")` : (signatures.responsavelUnidade ? 'Assinado Digitalmente' : ''),
      ]);
    }

    console.log("📝 Dados formatados para planilha:", rowsToAppend.length, "linhas");

    console.log("📤 Enviando para Google Sheets...");
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Mapa de Controle!A:U',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rowsToAppend },
    });

    console.log("✅ Google Sheets response received:", response.status);

    return NextResponse.json(
      { 
        success: true, 
        message: 'Relatório salvo com sucesso!',
        sheetsResponse: response.data
      }, 
      { status: 200 }
    );

  } catch (error) {
    console.error('💥 ERRO na API Route:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.log("❌ Error message:", errorMessage);

    return NextResponse.json(
      { 
        success: false, 
        message: 'Erro ao salvar no Google Sheets',
        error: errorMessage 
      }, 
      { status: 500 }
    );
  }
}

