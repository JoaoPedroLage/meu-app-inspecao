"use client";

import { useState, useRef, ChangeEvent, FormEvent, useEffect, useCallback } from 'react';
import { FileUp, PlusCircle, Trash2, ChevronLeft, ChevronRight, CheckCircle, XCircle } from 'lucide-react';
// import Image from 'next/image';

// Mock de imagem do logo - substitua pela URL do seu logo
// const LOGO_URL = '/logo.png';

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

interface SignaturePadProps {
  title: string;
  signatureRef?: React.RefObject<HTMLDivElement | null>; // Make optional since we're not using it
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
  conclusao: string;
  foto: File | null;
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
    
    // Set canvas size
    canvas.width = 400;
    canvas.height = 150;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set up drawing context
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
  });

  const [participants, setParticipants] = useState<Participant[]>([{ nome: '', funcao: '' }]);
  const [inspectionItems, setInspectionItems] = useState<InspectionItem[]>([
    { item: 1, fato: '', recomendacoes: '', prazo: '', responsavel: '', conclusao: '', foto: null }
  ]);

  const [conclusionData, setConclusionData] = useState<ConclusionData>({
    conclusaoGeral: '',
  });

  const signature1Ref = useRef<HTMLDivElement | null>(null);
  const signature2Ref = useRef<HTMLDivElement | null>(null);

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

  const handleItemChange = (index: number, e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const files = (e.target as HTMLInputElement).files;
    const newItems = [...inspectionItems];
    if (name === 'foto') {
      newItems[index] = { ...newItems[index], [name]: files?.[0] || null };
    } else {
      newItems[index] = { ...newItems[index], [name]: value };
    }
    setInspectionItems(newItems);
  };

  const addItem = () => {
    setInspectionItems([...inspectionItems, { item: inspectionItems.length + 1, fato: '', recomendacoes: '', prazo: '', responsavel: '', conclusao: '', foto: null }]);
  };

  const removeItem = (index: number) => {
    const newItems = inspectionItems.filter((_, i) => i !== index).map((item, idx) => ({ ...item, item: idx + 1 }));
    setInspectionItems(newItems);
  };

  const handleConclusionChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setConclusionData({ ...conclusionData, [e.target.name]: e.target.value });
  };

  const clearSignature = (ref: React.RefObject<HTMLDivElement | null>) => {
    // Esta função agora é gerenciada pelo componente SignaturePad
    console.log("Assinatura limpa para:", ref);
  };

  const nextStep = () => setStep(s => Math.min(s + 1, 3));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setSubmissionStatus(null);

    // Capturar dados das assinaturas dos canvas
    const signature1Canvas = document.querySelector('canvas') as HTMLCanvasElement;
    const signature2Canvas = document.querySelectorAll('canvas')[1] as HTMLCanvasElement;
    
    const signature1 = signature1Canvas ? signature1Canvas.toDataURL() : '';
    const signature2 = signature2Canvas ? signature2Canvas.toDataURL() : '';

    const formData = {
      headerData,
      participants,
      inspectionItems: inspectionItems.map(item => ({
        ...item,
        foto: item.foto ? item.foto.name : 'Nenhuma'
      })),
      conclusionData,
      signatures: {
        responsavelInspecao: signature1,
        responsavelUnidade: signature2
      }
    };

    console.log("Dados a serem enviados:", formData);

    try {
      // Simular delay de envio
      await new Promise(resolve => setTimeout(resolve, 2000));
      setSubmissionStatus('success');
    } catch (error) {
      console.error('Erro ao enviar formulário:', error);
      setSubmissionStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  if (!mounted) {
    return null; // Prevent hydration mismatch
  }

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
          {/* <div className="bg-white p-1.5 md:p-2 rounded flex-shrink-0">
            <Image
              src={LOGO_URL}
              alt="Logo da Empresa"
              width={32}
              height={32}
              className="h-8 w-8 md:h-10 md:w-10"
            />
          </div> */}
          <h1 className="text-sm md:text-xl font-bold text-amber-500 text-center flex-1 ml-3 md:ml-0">
            Relatório de Inspeção
          </h1>
        </div>
      </header>

      <main className="p-4 md:p-8 max-w-4xl mx-auto">
        {/* Stepper */}
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
                    <label className="block text-sm font-medium text-gray-300 mb-1">Evidência Fotográfica</label>
                    <label htmlFor={`foto-${index}`} className="w-full flex items-center justify-center gap-2 bg-gray-700 border-2 border-dashed border-gray-600 text-gray-400 rounded-lg p-3 cursor-pointer hover:bg-gray-600 hover:border-amber-500 hover:text-white transition">
                      <FileUp size={20} />
                      <span>{item.foto ? item.foto.name : "Anexar foto"}</span>
                    </label>
                    <input id={`foto-${index}`} name="foto" type="file" accept="image/*" onChange={(e) => handleItemChange(index, e)} className="hidden" />
                  </div>

                  <TextareaField label="Recomendações para Correção" name="recomendacoes" value={item.recomendacoes} onChange={(e) => handleItemChange(index, e)} placeholder="Descrever sugestões de correção..." />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputField label="Prazo de Execução" name="prazo" type="date" value={item.prazo} onChange={(e) => handleItemChange(index, e)} placeholder="" />
                    <InputField label="Responsável" name="responsavel" value={item.responsavel} onChange={(e) => handleItemChange(index, e)} placeholder="Nome do responsável pela correção" />
                  </div>
                  <TextareaField label="Conclusão da Ação" name="conclusao" value={item.conclusao} onChange={(e) => handleItemChange(index, e)} placeholder="Descrever a conclusão após a correção." />

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
                <SignaturePad title="Assinatura do Responsável pela Inspeção" onClear={() => clearSignature(signature1Ref)} />
                <SignaturePad title="Assinatura do Responsável da Unidade" onClear={() => clearSignature(signature2Ref)} />
              </div>
            </section>
          )}
        </form>

        {/* Navigation */}
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
      </main>
    </div>
  );
}
