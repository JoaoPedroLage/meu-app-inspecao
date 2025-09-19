import SignatureCanvas from 'react-signature-canvas';

type SignaturePadProps = {
  title: string;
  signatureRef: React.RefObject<SignatureCanvas>;
  onClear: () => void;
};

const SignaturePad = ({ title, signatureRef, onClear }: SignaturePadProps) => (
  <div className="w-full">
    <label className="block text-sm font-medium text-gray-300 mb-2">{title}</label>
    <div className="bg-white border border-gray-400 rounded-lg">
      <SignatureCanvas 
        ref={signatureRef}
        canvasProps={{
          className: "h-32 w-full cursor-crosshair",
          style: { width: '100%', height: '100%' }
        }}
        backgroundColor="white"
      />
    </div>
    <button 
      type="button" 
      onClick={onClear} 
      className="text-sm text-amber-500 hover:text-amber-400 mt-2"
    >
      Limpar
    </button>
  </div>
);

export default SignaturePad;