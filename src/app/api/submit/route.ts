import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { Storage } from '@google-cloud/storage';

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
  id: string;
  item: number;
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

      // AQUI ESTÁ A CORREÇÃO:
      // Removemos a opção `public: true`. O arquivo herdará as permissões
      // do bucket. Se o bucket for público, o arquivo será público.
      await file.save(buffer, {
          metadata: {
              contentType: mimeType,
              cacheControl: 'public, max-age=31536000',
          },
          // A linha `public: true` foi removida.
      });

      console.log(`✅ Arquivo ${fileName} enviado com sucesso`);

      // A URL pública padrão. Funciona se o bucket estiver configurado para acesso público.
      const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
      console.log(`🎉 Upload concluído: ${fileName} -> ${publicUrl}`);
      
      return { url: publicUrl, success: true };

  } catch (error) {
      // Tratamento de erro aprimorado para extrair a mensagem corretamente
      let errorMessage = 'Erro desconhecido durante o upload.';
      if (error instanceof Error) {
          errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
          // Tenta extrair a mensagem de objetos de erro complexos da API do Google
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
    // Extrair apenas os dados da imagem (remover o prefixo data:image/png;base64,)
    const imageData = base64Data.substring(base64Data.indexOf(',') + 1);
    const buffer = Buffer.from(imageData, 'base64');

    // Se a imagem é muito pequena, provavelmente está em branco
    if (buffer.length < 500) {
      return true;
    }

    // Converter para string e procurar por padrões que indicam imagem em branco
    const bufferString = buffer.toString('hex');

    // Uma imagem PNG em branco tem padrões específicos
    // Verificar se contém apenas pixels brancos (ffffff) ou transparentes
    const whitePixelPattern = /ffffff/g;
    const whitePixelMatches = bufferString.match(whitePixelPattern);
    const totalLength = bufferString.length;

    // Se mais de 95% da string contém padrões de pixels brancos, consideramos em branco
    const whiteRatio = whitePixelMatches ? (whitePixelMatches.length * 6) / totalLength : 0;

    console.log(`🔍 Análise da assinatura:`, {
      bufferSize: buffer.length,
      whiteRatio: whiteRatio.toFixed(3),
      isBlank: whiteRatio > 0.95 || buffer.length < 1000
    });

    return whiteRatio > 0.95 || buffer.length < 1000;

  } catch (error) {
    console.error('Erro ao analisar assinatura:', error);
    // Em caso de erro, consideramos que não está em branco
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

    // Mapear os itens e fazer upload das evidências com tratamento de erros
    console.log(`📷 Processando ${inspectionItems.length} itens de inspeção...`);


    // Determinar o texto para as assinaturas
    let signatureLink1 = 'Não assinado';
    let signatureLink2 = 'Não assinado';
    
    const rowsToAppend = await Promise.all(
      inspectionItems.map(async (item, index) => {
        console.log(`📸 Processando item ${index + 1}:`, {
          hasPhoto: !!item.foto,
          photoType: typeof item.foto
        });

        let photoResult: UploadResult = { url: '', success: true, error: 'Nenhuma foto fornecida' };

        if (item.foto && item.foto !== 'Nenhuma') {
          photoResult = await uploadImageToCloudStorage(item.foto, `evidencias/Evidencia_${inspectionId}_Item_${index + 1}.png`);
        }

        console.log(`📸 Resultado do upload da evidência ${index + 1}:`, {
          success: photoResult.success,
          url: photoResult.url || 'Vazio',
          error: photoResult.error || 'N/A'
        });

        // Determinar o texto para a coluna de evidência
        let evidenceText = 'Nenhuma';
        if (item.foto && item.foto !== 'Nenhuma') {
          if (photoResult.success && photoResult.url) {
            evidenceText = `=HYPERLINK("${photoResult.url}"; "Ver Evidência")`;
          } else {
            evidenceText = `❌ Falha no upload: ${photoResult.error || 'Erro desconhecido'}`;
          }
        }

        if (!signature1IsBlank) {
          if (signature1Result.success && signature1Result.url) {
            signatureLink1 = `=HYPERLINK("${signature1Result.url}"; "Ver Assinatura")`;
          } else {
            signatureLink1 = `❌ Falha no upload: ${signature1Result.error || 'Erro desconhecido'}`;
          }
        }
        if (!signature2IsBlank) {
          if (signature2Result.success && signature2Result.url) {
            signatureLink2 = `=HYPERLINK("${signature2Result.url}"; "Ver Assinatura")`;
          } else {
            signatureLink2 = `❌ Falha no upload: ${signature2Result.error || 'Erro desconhecido'}`;
          }
        }
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
          item.fato || '',
          item.recomendacoes || '',
          item.prazo || '',
          item.responsavel || '',
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
        headerData.unidade || '', headerData.local || '', participantNames, participantFunctions,
        'N/A', 'Nenhum item de inspeção foi adicionado.', '', '', '', '', 'Nenhuma',
        conclusionData.conclusaoGeral || '',
        signatureLink1 ? `=HYPERLINK("${signatureLink1}", "Ver Assinatura")` : (signatures.responsavelInspecao ? 'Assinado Digitalmente' : ''),
        signatureLink2 ? `=HYPERLINK("${signatureLink2}", "Ver Assinatura")` : (signatures.responsavelUnidade ? 'Assinado Digitalmente' : ''),
      ]);
    }

    console.log("📝 Dados formatados para planilha:", rowsToAppend.length, "linhas");

    console.log("📤 Enviando para Google Sheets...");
    const appendResponse = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Mapa de Controle!A:U',
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
