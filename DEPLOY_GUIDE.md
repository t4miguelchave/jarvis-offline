# 🚀 Guia Completo — Jarvis Android App

## Passo 1 — Instalar dependências do backend

```bash
cd /Users/miguelmac/Documents/Jarvis-offline
pip install fastapi uvicorn groq python-dotenv pillow python-multipart opencv-python-headless numpy
```

## Passo 2 — Testar o backend localmente

```bash
cd /Users/miguelmac/Documents/Jarvis-offline
uvicorn api.main:app --reload --port 8000
```

Abre o browser em: **http://localhost:8000/health**  
Deves ver: `{"status":"online","jarvis":"ready"}`

---

## Passo 3 — Deploy no Railway (grátis, 5 min)

1. Vai a **https://github.com** e cria um repositório chamado `jarvis-offline`
2. Faz push do código:
```bash
cd /Users/miguelmac/Documents/Jarvis-offline
git init
git add .
git commit -m "Jarvis API + Ionic App"
git remote add origin https://github.com/SEU_USERNAME/jarvis-offline.git
git push -u origin main
```

3. Vai a **https://railway.app** → Login com GitHub → **New Project** → **Deploy from GitHub repo** → seleciona `jarvis-offline`

4. No Railway, vai a **Variables** e adiciona:
   - `GROQ_API_KEY` = a tua chave da Groq

5. O Railway gera automaticamente uma URL tipo:  
   `https://jarvis-offline-production-xxxx.up.railway.app`

---

## Passo 4 — Atualizar a URL na app Ionic

Abre o ficheiro:
```
jarvis-app/src/app/services/jarvis.service.ts
```

Muda a linha:
```typescript
private baseUrl = 'https://YOUR-RAILWAY-URL.railway.app';
```
Para:
```typescript
private baseUrl = 'https://jarvis-offline-production-xxxx.up.railway.app';
```

*(Ou podes deixar assim e mudar nas Configurações dentro da app)*

---

## Passo 5 — Build da app Ionic

```bash
cd /Users/miguelmac/Documents/Jarvis-offline/jarvis-app
npm run build
npx cap sync android
```

---

## Passo 6 — Abrir no Android Studio e gerar APK

```bash
npx cap open android
```

No Android Studio:
1. Aguarda sincronização (pode demorar 2-3 min)
2. **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
3. O APK fica em: `jarvis-app/android/app/build/outputs/apk/debug/app-debug.apk`

---

## Passo 7 — Instalar no Android

**Opção A — USB:**
```bash
adb install jarvis-app/android/app/build/outputs/apk/debug/app-debug.apk
```

**Opção B — Manual:**
1. Copia o `.apk` para o telemóvel (WhatsApp, Drive, cabo USB)
2. No Android: Definições → Segurança → Ativar "Fontes desconhecidas"
3. Abre o ficheiro `.apk` e instala

---

## ✅ Funcionalidades da app

| Funcionalidade | Como usar |
|---|---|
| Chat de texto | Escreve na caixa e prime enviar |
| Calcular calorias de foto | Botão 📷 → tira foto ou galeria |
| Analisar vídeo | Botão 📷 → escolher vídeo |
| Limpar conversa | Ícone 🗑️ no topo |
| Mudar URL do backend | Ícone ⚙️ no topo |

---

## ⚠️ Se tiveres problemas

**Backend não responde:**
- Verifica se o Railway fez deploy com sucesso
- Verifica a `GROQ_API_KEY` nas variáveis do Railway

**App não compila:**
```bash
cd jarvis-app
npm install
npm run build
```

**Android Studio não abre:**
- Instala o Android Studio: https://developer.android.com/studio
