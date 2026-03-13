"use client";

import { useState, useRef, ChangeEvent, FormEvent, useEffect, useCallback } from 'react';
import { FileUp, PlusCircle, Trash2, ChevronLeft, ChevronRight, CheckCircle, XCircle } from 'lucide-react';

// TypeScript interfaces
interface InputFieldProps {
  label: string;
  type?: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  name: string;
  required?: boolean;
}

interface TextareaFieldProps {
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  name: string;
  required?: boolean;
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  name: string;
  options: { label: string; value: string }[];
  required?: boolean;
}

interface SignaturePadProps {
  title: string;
  signatureRef?: React.RefObject<HTMLDivElement | null>;
  onClear: () => void;
}

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
  item: number;
  fato: string;
  recomendacoes: string;
  prazo: string;
  responsavel: string;
  status: string; // Novo campo
  conclusao: string;
  fotos: File[]; // Alterado de File | null para array de arquivos
}

interface ConclusionData {
  conclusaoGeral: string;
}

type SubmissionStatus = 'success' | 'error' | null;

// Componente para um campo de formulário padrão
const InputField = ({ label, type = 'text', value, onChange, placeholder, name, required = true }: InputFieldProps) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
    <input
      type={type}
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-shadow duration-300"
    />
  </div>
);

// Componente para área de texto
const TextareaField = ({ label, value, onChange, placeholder, name, required = true }: TextareaFieldProps) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
    <textarea
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      rows={4}
      className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-shadow duration-300"
    />
  </div>
);

// Componente para campo de seleção (Dropdown)
const SelectField = ({ label, value, onChange, name, options, required = true }: SelectFieldProps) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
    <select
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      required={required}
      className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-shadow duration-300 appearance-none"
    >
      <option value="" disabled>Selecione uma opção</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </div>
);

// Componente para a assinatura digital
const SignaturePad = ({ title, onClear }: SignaturePadProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const getEventPos = useCallback((e: MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e && e.touches[0]) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }

    if ('clientX' in e) {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    }

    return { x: 0, y: 0 };
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const pos = getEventPos(e.nativeEvent);

    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }, [getEventPos]);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pos = getEventPos(e.nativeEvent);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }, [isDrawing, getEventPos]);

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    onClear();
  }, [onClear]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = 400;
    canvas.height = 150;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-300 mb-2">{title}</label>
      <div className="bg-white border border-gray-400 rounded-lg p-2">
        <canvas
          ref={canvasRef}
          className="w-full h-32 border rounded cursor-crosshair touch-none"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          style={{ touchAction: 'none' }}
        />
      </div>
      <button
        type="button"
        onClick={clearCanvas}
        className="text-sm text-amber-500 hover:text-amber-400 mt-2 bg-gray-700 px-3 py-1 rounded"
      >
        Limpar Assinatura
      </button>
    </div>
  );
};

export default function InspectionForm() {
  const [step, setStep] = useState(1);
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [headerData, setHeaderData] = useState<HeaderData>({
    departamento: '',
    encarregado: '',
    responsavelQSMS: '',
    gerenteContrato: '',
    unidade: '',
    data: '',
    hora: '',
    local: '',
    emailCompanhia: '',
  });

  const [participants, setParticipants] = useState<Participant[]>([{ nome: '', funcao: '' }]);

  // Atualizado para inicializar status vazio e fotos como array
  const [inspectionItems, setInspectionItems] = useState<InspectionItem[]>([
    { item: 1, fato: '', recomendacoes: '', prazo: '', responsavel: '', status: '', conclusao: '', fotos: [] }
  ]);

  const [conclusionData, setConclusionData] = useState<ConclusionData>({
    conclusaoGeral: '',
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleHeaderChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setHeaderData(prev => ({ ...prev, [name]: value }));
  };

  const handleParticipantChange = (index: number, e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const newParticipants = [...participants];
    newParticipants[index] = { ...newParticipants[index], [name]: value };
    setParticipants(newParticipants);
  };

  const addParticipant = () => {
    setParticipants([...participants, { nome: '', funcao: '' }]);
  };

  const removeParticipant = (index: number) => {
    const newParticipants = participants.filter((_, i) => i !== index);
    setParticipants(newParticipants);
  };

  const handleItemChange = (index: number, e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const newItems = [...inspectionItems];

    if (name === 'fotos') {
      const input = e.target as HTMLInputElement;
      if (input.files) {
        const newFiles = Array.from(input.files);
        // Adiciona as novas fotos ao array existente
        newItems[index] = {
          ...newItems[index],
          fotos: [...newItems[index].fotos, ...newFiles]
        };
        console.log(`📷 Adicionadas ${newFiles.length} fotos para item ${index + 1}. Total: ${newItems[index].fotos.length}`);
      }
    } else {
      newItems[index] = { ...newItems[index], [name]: value };
    }
    setInspectionItems(newItems);
  };

  const removePhoto = (itemIndex: number, photoIndex: number) => {
    const newItems = [...inspectionItems];
    newItems[itemIndex].fotos = newItems[itemIndex].fotos.filter((_, i) => i !== photoIndex);
    setInspectionItems(newItems);
  };

  const addItem = () => {
    setInspectionItems([
      ...inspectionItems,
      { item: inspectionItems.length + 1, fato: '', recomendacoes: '', prazo: '', responsavel: '', status: '', conclusao: '', fotos: [] }
    ]);
  };

  const removeItem = (index: number) => {
    const newItems = inspectionItems.filter((_, i) => i !== index).map((item, idx) => ({ ...item, item: idx + 1 }));
    setInspectionItems(newItems);
  };

  const handleConclusionChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setConclusionData({ ...conclusionData, [e.target.name]: e.target.value });
  };

  const clearSignature = () => { };

  const isCanvasBlank = (canvas: HTMLCanvasElement): boolean => {
    if (!canvas) return true;
    const ctx = canvas.getContext('2d');
    if (!ctx) return true;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] !== 255 || pixels[i + 1] !== 255 || pixels[i + 2] !== 255 || pixels[i + 3] !== 255) {
        return false;
      }
    }
    return true;
  };

  const nextStep = () => setStep(s => Math.min(s + 1, 3));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  // Função utilitária para transformar Base64 do Canvas em File binário
  const dataURLtoFile = (dataurl: string, filename: string) => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) { u8arr[n] = bstr.charCodeAt(n); }
    return new File([u8arr], filename, { type: mime });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setSubmissionStatus(null);
    const inspectionId = `INSPEC-${Date.now()}`;

    try {
      // 1. Coleta e Preparação de TODOS os arquivos para Upload
      const filesToUpload: { id: string, file: File, name: string, type: string }[] = [];

      // Coletar Assinaturas
      const canvases = document.querySelectorAll('canvas');
      const sig1Canvas = canvases[0] as HTMLCanvasElement;
      const sig2Canvas = canvases[1] as HTMLCanvasElement;

      const sig1Blank = sig1Canvas ? isCanvasBlank(sig1Canvas) : true;
      const sig2Blank = sig2Canvas ? isCanvasBlank(sig2Canvas) : true;

      if (!sig1Blank) {
        filesToUpload.push({ id: 'sig1', file: dataURLtoFile(sig1Canvas.toDataURL(), 'assinatura1.png'), name: 'assinatura_inspecao.png', type: 'image/png' });
      }
      if (!sig2Blank) {
        filesToUpload.push({ id: 'sig2', file: dataURLtoFile(sig2Canvas.toDataURL(), 'assinatura2.png'), name: 'assinatura_unidade.png', type: 'image/png' });
      }

      // Coletar Fotos
      inspectionItems.forEach((item, itemIndex) => {
        if (item.fotos && item.fotos.length > 0) {
          item.fotos.forEach((foto, fotoIndex) => {
            filesToUpload.push({ id: `item_${itemIndex}_foto_${fotoIndex}`, file: foto, name: foto.name, type: foto.type });
          });
        }
      });

      // 2. Pedir URLs Pré-Assinadas (Presigned URLs) para o Backend
      let presignedUrls: Record<string, { signedUrl: string, publicUrl: string }> = {};

      if (filesToUpload.length > 0) {
        console.log(`Buscando permissão de upload para ${filesToUpload.length} arquivos...`);
        const presignedRes = await fetch('/api/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files: filesToUpload.map(f => ({ id: f.id, name: f.name, type: f.type })) })
        });

        if (!presignedRes.ok) throw new Error("Falha ao autorizar uploads com o Google Cloud.");
        const data = await presignedRes.json();
        presignedUrls = data.urls;

        // 3. Fazer Upload Direto pro Google Cloud Storage (Ignorando a Vercel)
        console.log("Iniciando upload direto para o Google Cloud...");
        await Promise.all(filesToUpload.map(async (f) => {
          const uploadRes = await fetch(presignedUrls[f.id].signedUrl, {
            method: 'PUT',
            headers: { 'Content-Type': f.type },
            body: f.file // Arquivo binário cru, muito mais rápido que base64
          });
          if (!uploadRes.ok) throw new Error(`Falha no upload da imagem: ${f.name}`);
        }));
      }

      // 4. Montar o JSON Final (Leve) com as URLs Públicas para salvar na Planilha
      const processedItems = inspectionItems.map((item, itemIndex) => {
        const fotosFinais: string[] = [];
        if (item.fotos && item.fotos.length > 0) {
          item.fotos.forEach((_, fotoIndex) => {
            const fileId = `item_${itemIndex}_foto_${fotoIndex}`;
            if (presignedUrls[fileId]) fotosFinais.push(presignedUrls[fileId].publicUrl);
          });
        }
        return { ...item, fotos: fotosFinais.length > 0 ? fotosFinais : ['Nenhuma'] };
      });

      const finalPayload = {
        inspectionId,
        headerData,
        participants,
        inspectionItems: processedItems,
        conclusionData,
        signatures: {
          responsavelInspecao: !sig1Blank ? presignedUrls['sig1'].publicUrl : 'Não assinado',
          responsavelUnidade: !sig2Blank ? presignedUrls['sig2'].publicUrl : 'Não assinado',
        }
      };

      // 5. Enviar Dados de Texto pro Backend (Planilha + PDF + E-mail)
      console.log("Submetendo dados textuais...");
      const submitRes = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalPayload),
      });

      if (!submitRes.ok) throw new Error("Erro ao salvar os dados na planilha.");

      setSubmissionStatus('success');
    } catch (error) {
      console.error('Erro na submissão completa:', error);
      setSubmissionStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  if (!mounted) return null;

  if (submissionStatus) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4 text-white">
        {submissionStatus === 'success' ? (
          <>
            <CheckCircle className="text-green-500 w-24 h-24 mb-4" />
            <h2 className="text-3xl font-bold mb-2">Enviado com Sucesso!</h2>
            <p className="text-gray-400">Seu relatório de inspeção foi registrado.</p>
          </>
        ) : (
          <>
            <XCircle className="text-red-500 w-24 h-24 mb-4" />
            <h2 className="text-3xl font-bold mb-2">Ocorreu um Erro</h2>
            <p className="text-gray-400">Não foi possível enviar seu relatório. Tente novamente mais tarde.</p>
          </>
        )}
        <button onClick={() => setSubmissionStatus(null)} className="mt-8 bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-6 rounded-lg transition-transform transform hover:scale-105">
          Preencher Novo Formulário
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      <header className="bg-gray-800 p-3 md:p-4 shadow-lg">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <h1 className="text-sm md:text-xl font-bold text-amber-500 text-center flex-1 ml-3 md:ml-0">
            Relatório de Inspeção
          </h1>
        </div>
      </header>

      <main className="p-4 md:p-8 max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-center">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-300 ${step >= s ? 'bg-amber-500 text-white' : 'bg-gray-700 text-gray-400'}`}>
                  {s}
                </div>
                {s < 3 && <div className={`h-1 w-16 transition-all duration-300 ${step > s ? 'bg-amber-500' : 'bg-gray-700'}`}></div>}
              </div>
            ))}
          </div>
          <div className="text-center mt-2 text-gray-400 font-semibold">
            {step === 1 && "1. Cabeçalho da Inspeção"}
            {step === 2 && "2. Detalhes da Inspeção"}
            {step === 3 && "3. Conclusão e Assinaturas"}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {step === 1 && (
            <section className="space-y-6 animate-fade-in">
              <h2 className="text-2xl font-semibold text-amber-400 border-l-4 border-amber-400 pl-4">Cabeçalho da Inspeção</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputField label="E-mail da Companhia (Profissional)" name="emailCompanhia" type="email" value={headerData.emailCompanhia} onChange={handleHeaderChange} placeholder="exemplo@empresa.com" />
                <br />
                <InputField label="Departamento" name="departamento" value={headerData.departamento} onChange={handleHeaderChange} placeholder="Ex: Manutenção de Frota" />
                <InputField label="Encarregado" name="encarregado" value={headerData.encarregado} onChange={handleHeaderChange} placeholder="Nome do encarregado" />
                <InputField label="Responsável QSMS" name="responsavelQSMS" value={headerData.responsavelQSMS} onChange={handleHeaderChange} placeholder="Nome do responsável" />
                <InputField label="Gerente de Contrato" name="gerenteContrato" value={headerData.gerenteContrato} onChange={handleHeaderChange} placeholder="Nome do gerente" />
                <InputField label="Unidade" name="unidade" value={headerData.unidade} onChange={handleHeaderChange} placeholder="Ex: Mina do Sossego" />
                <InputField label="Data" name="data" type="date" value={headerData.data} onChange={handleHeaderChange} placeholder="" />
                <InputField label="Hora" name="hora" type="time" value={headerData.hora} onChange={handleHeaderChange} placeholder="" />
                <InputField label="Local da Inspeção" name="local" value={headerData.local} onChange={handleHeaderChange} placeholder="Ex: Frente de lavra 3" />
              </div>

              <div className="pt-4">
                <h3 className="text-xl font-semibold text-amber-400 border-l-4 border-amber-400 pl-4 mb-4">Participantes</h3>
                {participants.map((p, index) => (
                  <div key={index} className="flex items-center gap-4 mb-4 p-4 bg-gray-800 rounded-lg">
                    <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4">
                      <InputField label="Nome do Participante" name="nome" value={p.nome} onChange={(e) => handleParticipantChange(index, e)} placeholder="Nome completo" />
                      <InputField label="Função" name="funcao" value={p.funcao} onChange={(e) => handleParticipantChange(index, e)} placeholder="Ex: Mecânico" />
                    </div>
                    <button type="button" onClick={() => removeParticipant(index)} className="p-2 text-red-500 hover:text-red-400">
                      <Trash2 size={20} />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addParticipant} className="flex items-center gap-2 text-amber-500 hover:text-amber-400 font-semibold py-2 px-4 rounded-lg border-2 border-dashed border-gray-600 hover:border-amber-500 transition">
                  <PlusCircle size={20} /> Adicionar Participante
                </button>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="space-y-6 animate-fade-in">
              <h2 className="text-2xl font-semibold text-amber-400 border-l-4 border-amber-400 pl-4">Detalhes da Inspeção</h2>
              {inspectionItems.map((item, index) => (
                <div key={index} className="bg-gray-800 p-4 rounded-lg space-y-4 relative">
                  <span className="absolute top-4 right-4 bg-amber-500 text-white text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center">{item.item}</span>
                  <TextareaField label="Fato Observado" name="fato" value={item.fato} onChange={(e) => handleItemChange(index, e)} placeholder="Descrever irregularidade ou regularidade..." />

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Evidências Fotográficas</label>
                    <label htmlFor={`fotos-${index}`} className="w-full flex items-center justify-center gap-2 bg-gray-700 border-2 border-dashed border-gray-600 text-gray-400 rounded-lg p-3 cursor-pointer hover:bg-gray-600 hover:border-amber-500 hover:text-white transition">
                      <FileUp size={20} />
                      <span>{item.fotos.length > 0 ? `Adicionar mais fotos (${item.fotos.length} anexadas)` : "Anexar fotos"}</span>
                    </label>
                    {/* Campo de arquivo agora suporta "multiple" */}
                    <input id={`fotos-${index}`} name="fotos" type="file" accept="image/*" multiple onChange={(e) => handleItemChange(index, e)} className="hidden" />

                    {/* Exibe a lista de fotos adicionadas com opção de remover */}
                    {item.fotos.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {item.fotos.map((foto, fIndex) => (
                          <div key={fIndex} className="flex justify-between items-center bg-gray-600 px-3 py-2 rounded-lg text-sm">
                            <span className="truncate max-w-[85%]">{foto.name}</span>
                            <button type="button" onClick={() => removePhoto(index, fIndex)} className="text-red-400 hover:text-red-300 transition">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <TextareaField label="Recomendações para Correção" name="recomendacoes" value={item.recomendacoes} onChange={(e) => handleItemChange(index, e)} placeholder="Descrever sugestões de correção..." />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputField label="Prazo de Execução" name="prazo" type="date" value={item.prazo} onChange={(e) => handleItemChange(index, e)} placeholder="" />
                    <InputField label="Responsável" name="responsavel" value={item.responsavel} onChange={(e) => handleItemChange(index, e)} placeholder="Nome do responsável pela correção" />
                  </div>

                  {/* Novo Dropdown de Status */}
                  <SelectField
                    label="Status da Ação"
                    name="status"
                    value={item.status}
                    onChange={(e) => handleItemChange(index, e)}
                    options={[
                      { label: 'Em Andamento', value: 'Em Andamento' },
                      { label: 'Concluída', value: 'Concluída' },
                      { label: 'Atrasada', value: 'Atrasada' },
                    ]}
                  />

                  {/* <TextareaField label="Conclusão da Ação" name="conclusao" value={item.conclusao} onChange={(e) => handleItemChange(index, e)} placeholder="Descrever a conclusão após a correção." /> */}

                  {inspectionItems.length > 1 && (
                    <button type="button" onClick={() => removeItem(index)} className="w-full mt-2 flex items-center justify-center gap-2 text-red-500 hover:text-red-400 font-semibold py-2 rounded-lg border-2 border-dashed border-red-800 hover:border-red-500 transition">
                      <Trash2 size={18} /> Remover Item
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addItem} className="w-full flex items-center justify-center gap-2 text-amber-500 hover:text-amber-400 font-semibold py-3 px-4 rounded-lg border-2 border-dashed border-gray-600 hover:border-amber-500 transition">
                <PlusCircle size={20} /> Adicionar Novo Item
              </button>
            </section>
          )}

          {step === 3 && (
            <section className="space-y-8 animate-fade-in">
              <h2 className="text-2xl font-semibold text-amber-400 border-l-4 border-amber-400 pl-4">Conclusão Geral</h2>
              <TextareaField label="Parecer Técnico da Inspeção" name="conclusaoGeral" value={conclusionData.conclusaoGeral} onChange={handleConclusionChange} placeholder="Descreva as condições ambientais, de trabalho, e se o local/equipamento está apto." />

              <div className="space-y-8 md:space-y-0 md:flex md:gap-8">
                <SignaturePad title="Assinatura do Responsável pela Inspeção" onClear={() => clearSignature()} />
                <SignaturePad title="Assinatura do Responsável da Unidade" onClear={() => clearSignature()} />
              </div>
            </section>
          )}

          <div className="mt-10 pt-6 border-t border-gray-700 flex justify-between items-center">
            <button
              type="button"
              onClick={prevStep}
              disabled={step === 1}
              className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-transform transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              <ChevronLeft size={20} />
              Anterior
            </button>

            {step < 3 ? (
              <button
                type="button"
                onClick={nextStep}
                className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-6 rounded-lg transition-transform transform hover:scale-105"
              >
                Próximo
                <ChevronRight size={20} />
              </button>
            ) : (
              <button
                type="submit"
                disabled={isLoading}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-transform transform hover:scale-105 flex items-center justify-center disabled:opacity-60 disabled:transform-none"
              >
                {isLoading ? (
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  "Enviar Relatório"
                )}
              </button>
            )}
          </div>
        </form>
      </main>
    </div>
  );
}
