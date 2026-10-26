# Pixiegurlll AI

Pixiegurlll AI is a premium AI companion web app with a responsive chat interface, accessible voice controls, sign-language demo features, and a clean local-settings architecture.

## Tech stack

- React + TypeScript + Vite
- Express backend for secure AI integration and document validation
- LocalStorage for guest/demo persistence and preferences
- Optional OpenAI API integration via backend environment variables

## Features included

- Multi-conversation chat interface with rename/delete/search
- Welcome screen and suggested prompts
- AI chat API integration secured on the backend with clear configuration errors
- Document upload validation for `.txt`, `.md`, `.json`, `.csv`
- Theme, accent, font-size, voice, and sign-language settings
- Camera preview and sign-language studio with demo/preview messaging
- Responsive glassmorphism UI with accessible controls and reduced-motion support

## Requirements

- Node.js 18+
- npm

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment file:

   ```bash
   cp .env.example .env
   ```

3. Add your AI credentials if you want live chat responses:

   ```bash
   OPENAI_API_KEY=your_key_here
   OPENAI_MODEL=gpt-4o-mini
   ```

4. Start the app in development mode:

   ```bash
   npm run dev
   ```

5. Open the browser at http://localhost:5173

## AI configuration notes

- If `OPENAI_API_KEY` is not set, the chat UI will still load but will show a clear configuration warning instead of pretending the AI is connected.
- The backend is where API keys should live, and not in browser code.
- Sign-language interpretation is intentionally demo-only unless a trained recognition model and backend pipeline are connected.

## Production build

```bash
npm run build
npm start
```

## Important: what works without credentials

- Layout, responsive UI, chat interface, settings persistence, conversation management, document validation, and demo sign-language studio all work locally.
- Real model responses require `OPENAI_API_KEY`.
- Full sign-language translation requires a trained model and a dedicated backend service.

## Privacy and accessibility notes

- Camera and microphone access are not activated without explicit user action.
- Uploaded files are validated and limited to small developer-safe text formats.
- The sign-language studio explicitly avoids claiming translation accuracy when no trained model is connected.
