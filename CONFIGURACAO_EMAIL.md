# Configuração de E-mail para Envio de PDF

Para que o sistema envie automaticamente o PDF do relatório por e-mail, você precisa configurar as seguintes variáveis de ambiente:

## Variáveis de Ambiente Necessárias

Adicione as seguintes variáveis ao seu arquivo `.env.local`:

```env
# Configuração de E-mail (para envio de PDF)
EMAIL_USER=seu-email@gmail.com
EMAIL_PASS=sua-senha-de-app
```

## Como Configurar o Gmail

1. **Ative a verificação em duas etapas** na sua conta do Gmail
2. **Gere uma senha de app**:
   - Vá para: Configurações da Conta Google > Segurança
   - Em "Como fazer login no Google", clique em "Senhas de app"
   - Selecione "E-mail" e "Outro (nome personalizado)"
   - Digite "App Inspeção" como nome
   - Copie a senha gerada (16 caracteres)
3. **Use a senha de app** como valor para `EMAIL_PASS`

## Outros Provedores de E-mail

Se preferir usar outro provedor, modifique a configuração em `src/app/api/submit/route.ts` na função `sendEmailWithPDF`:

```typescript
const transporter = nodemailer.createTransporter({
  service: 'outlook', // ou 'yahoo', 'hotmail', etc.
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});
```

## Teste

Após configurar as variáveis de ambiente:
1. Reinicie o servidor de desenvolvimento
2. Preencha o formulário com um e-mail válido
3. Envie o formulário
4. Verifique se o e-mail com PDF foi recebido

## Solução de Problemas

- **Erro de autenticação**: Verifique se a senha de app está correta
- **E-mail não enviado**: Verifique os logs do console para mensagens de erro
- **PDF não anexado**: Verifique se as dependências `jspdf` e `nodemailer` estão instaladas
