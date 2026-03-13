import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';

export async function POST(request: NextRequest) {
  try {
    const { files } = await request.json();
    
    // files = [{ id: 'sig1', name: 'assinatura.png', type: 'image/png' }, ...]
    if (!files || !Array.isArray(files)) {
      return NextResponse.json({ error: 'Nenhum arquivo especificado' }, { status: 400 });
    }

    const storage = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }
    });

    const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
    if (!bucketName) throw new Error('Bucket não configurado');
    const bucket = storage.bucket(bucketName);

    const urls: Record<string, { signedUrl: string, publicUrl: string }> = {};

    for (const file of files) {
      // Cria um nome único para não sobrescrever arquivos
      const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const gcsFileName = `inspecoes/${Date.now()}_${safeName}`;
      const bucketFile = bucket.file(gcsFileName);

      // Gera a URL de Upload válida por 15 minutos
      const [signedUrl] = await bucketFile.getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000,
        contentType: file.type,
      });

      urls[file.id] = {
        signedUrl,
        publicUrl: `https://storage.googleapis.com/${bucketName}/${gcsFileName}`
      };
    }

    return NextResponse.json({ urls });

  } catch (error) {
    console.error('Erro ao gerar Signed URLs:', error);
    return NextResponse.json({ error: 'Falha ao gerar URLs de upload' }, { status: 500 });
  }
}
