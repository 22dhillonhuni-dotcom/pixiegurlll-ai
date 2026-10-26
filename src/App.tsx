import { useEffect, useMemo, useRef, useState } from 'react';

type Role = 'user' | 'assistant';
type ThemeMode = 'dark' | 'light' | 'system';
type SignLanguage = 'ISL' | 'ASL';

type Message = {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
};

type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
};

type Settings = {
  theme: ThemeMode;
  accent: string;
  fontSize: number;
  reducedMotion: boolean;
  voiceEnabled: boolean;
  preferredSignLanguage: SignLanguage;
  preferredVoice: string;
  speechRate: number;
  aiModel: string;
};

const systemPrompt =
  'You are Pixiegurlll, a friendly, intelligent, patient, creative AI companion. Explain difficult things clearly, adapt to the user\'s level, help with writing and coding, and ask clarifying questions when necessary. Be supportive without being misleading. Never invent facts, sources, or completed actions.';

const defaultPrompts = [
  'Explain something difficult simply.',
  'Help me write something amazing.',
  'Help me with coding.',
  'Summarize a document.',
  'Brainstorm creative ideas.',
  'Try accessible communication mode.',
];

const STORAGE_KEYS = {
  conversations: 'pixiegurlll-conversations',
  settings: 'pixiegurlll-settings',
  auth: 'pixiegurlll-auth',
};

function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function createMessage(role: Role, content: string): Message {
  return {
    id: uid(role),
    role,
    content,
    timestamp: Date.now(),
  };
}

const defaultSettings: Settings = {
  theme: 'dark',
  accent: '#b794ff',
  fontSize: 16,
  reducedMotion: false,
  voiceEnabled: true,
  preferredSignLanguage: 'ISL',
  preferredVoice: 'default',
  speechRate: 1,
  aiModel: 'gpt-4o-mini',
};

const seedConversations: Conversation[] = [
  {
    id: 'welcome-conversation',
    title: 'Welcome to Pixiegurlll AI',
    updatedAt: Date.now(),
    messages: [
      createMessage(
        'assistant',
        "Heyyy, welcome to Pixiegurlll AI ✨\nYour ideas, questions, creativity, and conversations all belong here. What are we exploring today?",
      ),
    ],
  },
];

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function App() {
  const [settings, setSettings] = useState<Settings>(() => readStored(STORAGE_KEYS.settings, defaultSettings));
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    readStored(STORAGE_KEYS.conversations, seedConversations),
  );
  const [activeConversationId, setActiveConversationId] = useState<string>(() => {
    const saved = readStored<{ activeId?: string }>(STORAGE_KEYS.auth, { activeId: undefined });
    return saved.activeId || seedConversations[0].id;
  });
  const [query, setQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [showSignStudio, setShowSignStudio] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [guestMode, setGuestMode] = useState(true);
  const [fileStatus, setFileStatus] = useState<string | null>(null);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [lastSyncedConfig, setLastSyncedConfig] = useState<{ aiConfigured: boolean; model: string } | null>(null);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.conversations, JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
    document.documentElement.style.setProperty('--accent', settings.accent);
    document.documentElement.style.setProperty('--font-scale', `${settings.fontSize / 16}`);
    document.documentElement.dataset.theme = settings.theme === 'system' ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : settings.theme;
    document.documentElement.dataset.motion = settings.reducedMotion ? 'reduced' : 'normal';
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.auth,
      JSON.stringify({ activeId: activeConversationId, guestMode, authMode }),
    );
  }, [activeConversationId, guestMode, authMode]);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/config', { signal: controller.signal })
      .then((res) => res.json())
      .then((payload) => {
        setLastSyncedConfig({ aiConfigured: Boolean(payload.aiConfigured), model: payload.model || settings.aiModel });
      })
      .catch(() => {
        setLastSyncedConfig({ aiConfigured: false, model: settings.aiModel });
      });
    return () => controller.abort();
  }, [settings.aiModel]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: settings.reducedMotion ? 'auto' : 'smooth' });
  }, [conversations, activeConversationId, settings.reducedMotion]);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) || conversations[0],
    [activeConversationId, conversations],
  );

  const filteredConversations = useMemo(() => {
    if (!searchTerm.trim()) return conversations;
    return conversations.filter((conversation) =>
      conversation.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conversation.messages.some((message) => message.content.toLowerCase().includes(searchTerm.toLowerCase())),
    );
  }, [conversations, searchTerm]);

  const createNewConversation = () => {
    const next: Conversation = {
      id: uid('conversation'),
      title: 'New conversation',
      updatedAt: Date.now(),
      messages: [createMessage('assistant', "Heyyy, welcome to Pixiegurlll AI ✨\nYour ideas, questions, creativity, and conversations all belong here. What are we exploring today?")],
    };

    setConversations((current) => [next, ...current]);
    setActiveConversationId(next.id);
    setQuery('');
    setError(null);
  };

  const updateConversation = (conversationId: string, updater: (conversation: Conversation) => Conversation) => {
    setConversations((current) =>
      current.map((conversation) => (conversation.id === conversationId ? updater(conversation) : conversation)),
    );
  };

  const renameConversation = (conversationId: string) => {
    const target = conversations.find((c) => c.id === conversationId);
    if (!target) return;
    const title = window.prompt('Rename conversation', target.title);
    if (!title || !title.trim()) return;
    updateConversation(conversationId, (conversation) => ({
      ...conversation,
      title: title.trim(),
      updatedAt: Date.now(),
    }));
  };

  const deleteConversation = (conversationId: string) => {
    const shouldDelete = window.confirm('Delete this conversation? This cannot be undone.');
    if (!shouldDelete) return;
    const next = conversations.filter((conversation) => conversation.id !== conversationId);
    setConversations(next.length ? next : seedConversations);
    setActiveConversationId(next.length ? next[0].id : seedConversations[0].id);
  };

  const handleSend = async (draft: string) => {
    const content = draft.trim();
    if (!content || isGenerating) return;

    const userMessage = createMessage('user', content);
    const baseConversation = activeConversation || conversations[0];
    const messageHistory = [...baseConversation.messages, userMessage];

    setError(null);
    setIsGenerating(true);
    setQuery('');
    setVoiceTranscript('');

    updateConversation(baseConversation.id, (conversation) => ({
      ...conversation,
      title: conversation.messages.length === 0 ? 'New chat' : conversation.title,
      messages: messageHistory,
      updatedAt: Date.now(),
    }));

    const assistantPlaceholder: Message = { ...createMessage('assistant', ''), id: uid('assistant') };
    updateConversation(baseConversation.id, (conversation) => ({
      ...conversation,
      messages: [...messageHistory, assistantPlaceholder],
      updatedAt: Date.now(),
    }));

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messageHistory.map((message) => ({ role: message.role, content: message.content })),
          personality: systemPrompt,
          model: settings.aiModel,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'The AI service could not respond right now.');
      }

      const text = payload.message || 'No response received.';
      updateConversation(baseConversation.id, (conversation) => ({
        ...conversation,
        messages: [...messageHistory, createMessage('assistant', text)],
        updatedAt: Date.now(),
      }));
    } catch (issue) {
      const message = issue instanceof Error ? issue.message : 'Something went wrong while contacting the AI service.';
      setError(message);
      updateConversation(baseConversation.id, (conversation) => ({
        ...conversation,
        messages: [...messageHistory, createMessage('assistant', `AI unavailable: ${message}`)],
        updatedAt: Date.now(),
      }));
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePromptClick = (prompt: string) => {
    handleSend(prompt);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedExtensions = ['.txt', '.md', '.json', '.csv'];
    const fileExtension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
      setFileStatus('Unsupported file type. Please upload .txt, .md, .json, or .csv files.');
      event.target.value = '';
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setFileStatus('File too large. Max size is 2MB.');
      event.target.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    setUploadingDocument(true);
    setFileStatus('Uploading and validating document...');

    try {
      const response = await fetch('/api/analyze-document', {
        method: 'POST',
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || 'Document analysis failed.');
      }

      setFileStatus(`Document ready: ${payload.filename}. ${payload.summary}`);
      if (payload.content) {
        handleSend(`Summarize this document for me:\n\n${payload.content.slice(0, 1000)}`);
      }
    } catch (issue) {
      const message = issue instanceof Error ? issue.message : 'Unable to read the file.';
      setFileStatus(message);
    } finally {
      setUploadingDocument(false);
      event.target.value = '';
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Conversation sidebar">
        <div className="brand-block">
          <div className="brand-mark" aria-label="Pixiegurlll AI branding">P</div>
          <div>
            <p className="eyebrow">Companion</p>
            <h1>Pixiegurlll AI</h1>
          </div>
        </div>

        <button className="new-chat-button" onClick={createNewConversation}>
          + New chat
        </button>

        <label className="search-box" aria-label="Search conversations">
          <span>⌕</span>
          <input
            type="text"
            value={searchTerm}
            placeholder="Search chats"
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>

        <nav className="conversation-list" aria-label="Conversation history">
          {filteredConversations.map((conversation) => (
            <button
              key={conversation.id}
              className={`conversation-item ${conversation.id === activeConversationId ? 'active' : ''}`}
              onClick={() => setActiveConversationId(conversation.id)}
            >
              <div className="conversation-content">
                <strong>{conversation.title}</strong>
                <small>{conversation.messages.length} messages</small>
              </div>
              <div className="conversation-actions">
                <span onClick={(event) => { event.stopPropagation(); renameConversation(conversation.id); }}>✎</span>
                <span onClick={(event) => { event.stopPropagation(); deleteConversation(conversation.id); }}>🗑</span>
              </div>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="ghost-button" onClick={() => setShowSignStudio((state) => !state)}>SignAI Studio</button>
          <button className="ghost-button" onClick={() => setShowSettings(true)}>Settings</button>
          <button className="ghost-button" onClick={() => setShowAuth(true)}>Account</button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="top-bar">
          <div>
            <p className="eyebrow">AI assistant</p>
            <h2>{activeConversation?.title || 'Chat'}</h2>
          </div>

          <div className="top-bar-actions">
            <button className="icon-button" onClick={() => setShowSignStudio((state) => !state)} title="Open SignAI Studio">
              ✋
            </button>
            <button className="icon-button" onClick={() => setShowSettings(true)} title="Open settings">
              ⚙
            </button>
          </div>
        </header>

        {lastSyncedConfig && !lastSyncedConfig.aiConfigured ? (
          <div className="config-banner" role="alert">
            AI service is not configured. Add <code>OPENAI_API_KEY</code> in the backend environment to enable live responses.
          </div>
        ) : null}

        {error ? <div className="error-banner">{error}</div> : null}

        {showSignStudio ? (
          <section className="sign-panel" aria-label="SignAI Studio">
            <div className="studio-header">
              <div>
                <p className="eyebrow">Accessibility</p>
                <h3>SignAI Studio</h3>
              </div>
              <div className="language-pills">
                <button
                  className={settings.preferredSignLanguage === 'ISL' ? 'pill active' : 'pill'}
                  onClick={() => setSettings({ ...settings, preferredSignLanguage: 'ISL' })}
                >
                  ISL
                </button>
                <button
                  className={settings.preferredSignLanguage === 'ASL' ? 'pill active' : 'pill'}
                  onClick={() => setSettings({ ...settings, preferredSignLanguage: 'ASL' })}
                >
                  ASL
                </button>
              </div>
            </div>

            <div className="sign-grid">
              <CameraPreview />
              <SignRecognitionPanel />
            </div>

            <div className="sign-output-panel">
              <div>
                <p className="eyebrow">Output language</p>
                <strong>{settings.preferredSignLanguage}</strong>
              </div>
              <button className="primary-button" onClick={() => handleSend('Help me translate this sign interpretation into a clear response.')}>Ask Pixiegurlll</button>
            </div>
          </section>
        ) : null}

        {showSettings ? (
          <SettingsPanel settings={settings} onChange={setSettings} close={() => setShowSettings(false)} />
        ) : null}

        {showAuth ? (
          <AuthPanel
            mode={authMode}
            onModeChange={setAuthMode}
            guestMode={guestMode}
            onGuestModeChange={setGuestMode}
            close={() => setShowAuth(false)}
          />
        ) : null}

        <section className="chat-area">
          {activeConversation && activeConversation.messages.length === 0 ? (
            <div className="welcome-state">
              <div className="avatar-ring">
                <div className="avatar-core">P</div>
              </div>
              <h3>
                Heyyy, welcome to Pixiegurlll AI ✨
              </h3>
              <p>Your ideas, questions, creativity, and conversations all belong here. What are we exploring today?</p>
              <div className="prompt-grid">
                {defaultPrompts.map((prompt) => (
                  <button key={prompt} className="prompt-card" onClick={() => handlePromptClick(prompt)}>
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="message-list">
              {activeConversation?.messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}

              {isGenerating ? <div className="typing-indicator">Pixiegurlll is thinking...</div> : null}
              <div ref={chatEndRef} />
            </div>
          )}
        </section>

        <footer className="composer-panel">
          <div className="composer-toolbar">
            <label className="upload-label">
              <span>📎</span>
              <input type="file" accept=".txt,.md,.json,.csv" onChange={handleFileUpload} aria-label="Upload document" />
            </label>
            <button className="icon-button" onClick={() => setVoiceTranscript((value) => value || 'This is a demo transcript. Voice input will appear here when enabled.')}>🎙</button>
            <button className="icon-button" onClick={() => handleSend('Explain this concept simply and give an example.')}>✨</button>
          </div>

          {fileStatus ? <p className="file-status">{fileStatus}</p> : null}

          <div className="composer-row">
            <textarea
              ref={textareaRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Message Pixiegurlll..."
              rows={3}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSend(query);
                }
              }}
            />
            <button className="primary-button" onClick={() => handleSend(query)} disabled={!query.trim() || isGenerating}>
              {isGenerating ? 'Sending...' : 'Send'}
            </button>
          </div>

          {voiceTranscript ? (
            <div className="voice-preview">
              <strong>Voice transcript</strong>
              <p>{voiceTranscript}</p>
              <button className="secondary-button" onClick={() => handleSend(voiceTranscript)}>
                Send transcript
              </button>
            </div>
          ) : null}
        </footer>
      </main>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  return (
    <div className={`message-row ${message.role}`}>
      <div className="message-bubble">
        <div className="message-meta">
          <span>{message.role === 'user' ? 'You' : 'Pixiegurlll'}</span>
          <time>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
        </div>
        <div className="message-content">
          {message.content.split('\n').map((line, index) => (
            <p key={`${message.id}-${index}`}>{line || ' '}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

function CameraPreview() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraDenied, setCameraDenied] = useState(false);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraOn(true);
      setCameraDenied(false);
    } catch {
      setCameraDenied(true);
      setCameraOn(false);
    }
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOn(false);
  };

  return (
    <div className="camera-card">
      <div className="card-header">
        <h4>Camera preview</h4>
        <span className={cameraOn ? 'status online' : 'status offline'}>{cameraOn ? 'Live' : 'Off'}</span>
      </div>

      <div className="camera-frame">
        <video ref={videoRef} playsInline muted autoPlay />
        {!cameraOn ? <div className="camera-placeholder">Camera preview unavailable</div> : null}
      </div>

      {cameraDenied ? <p className="helper-text">Camera access was denied. Allow access in your browser settings to enable the preview.</p> : null}

      <div className="card-actions">
        <button className="primary-button" onClick={startCamera}>Start camera</button>
        <button className="secondary-button" onClick={stopCamera}>Stop camera</button>
      </div>

      <p className="helper-text">
        This demo is for camera permission handling and preview. No sign-language translation is claimed unless a trained model is configured.
      </p>
    </div>
  );
}

function SignRecognitionPanel() {
  return (
    <div className="camera-card">
      <div className="card-header">
        <h4>Interpretation</h4>
        <span className="status offline">Demo</span>
      </div>

      <div className="recognition-box">
        <p className="label">Detected text</p>
        <h5>"Hello, how can I help?"</h5>
        <div className="confidence-row">
          <span>Confidence</span>
          <strong>—</strong>
        </div>
      </div>

      <div className="card-actions">
        <button className="primary-button" onClick={() => {}}>Run recognition</button>
        <button className="secondary-button" onClick={() => {}}>Reset</button>
      </div>

      <p className="helper-text">
        No trained sign-language model is connected. This panel demonstrates the future integration workflow and clearly labels it as preview-only.
      </p>
    </div>
  );
}

function SettingsPanel({
  settings,
  onChange,
  close,
}: {
  settings: Settings;
  onChange: React.Dispatch<React.SetStateAction<Settings>>;
  close: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>Settings</h3>
          <button className="icon-button" onClick={close}>✕</button>
        </div>

        <div className="settings-grid">
          <div className="field-group">
            <label>Theme</label>
            <select
              value={settings.theme}
              onChange={(event) => onChange((current) => ({ ...current, theme: event.target.value as ThemeMode }))}
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </select>
          </div>

          <div className="field-group">
            <label>Accent color</label>
            <input
              type="color"
              value={settings.accent}
              onChange={(event) => onChange((current) => ({ ...current, accent: event.target.value }))}
            />
          </div>

          <div className="field-group">
            <label>Font size: {settings.fontSize}px</label>
            <input
              type="range"
              min={14}
              max={20}
              value={settings.fontSize}
              onChange={(event) => onChange((current) => ({ ...current, fontSize: Number(event.target.value) }))}
            />
          </div>

          <div className="field-group">
            <label>Preferred sign language</label>
            <select
              value={settings.preferredSignLanguage}
              onChange={(event) => onChange((current) => ({ ...current, preferredSignLanguage: event.target.value as SignLanguage }))}
            >
              <option value="ISL">Indian Sign Language</option>
              <option value="ASL">American Sign Language</option>
            </select>
          </div>

          <div className="field-group">
            <label>Voice enabled</label>
            <input
              type="checkbox"
              checked={settings.voiceEnabled}
              onChange={(event) => onChange((current) => ({ ...current, voiceEnabled: event.target.checked }))}
            />
          </div>

          <div className="field-group">
            <label>Reduced motion</label>
            <input
              type="checkbox"
              checked={settings.reducedMotion}
              onChange={(event) => onChange((current) => ({ ...current, reducedMotion: event.target.checked }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthPanel({
  mode,
  onModeChange,
  guestMode,
  onGuestModeChange,
  close,
}: {
  mode: 'signin' | 'signup';
  onModeChange: React.Dispatch<React.SetStateAction<'signin' | 'signup'>>;
  guestMode: boolean;
  onGuestModeChange: React.Dispatch<React.SetStateAction<boolean>>;
  close: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal-card auth-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>Account</h3>
          <button className="icon-button" onClick={close}>✕</button>
        </div>

        <div className="segmented-control">
          <button className={mode === 'signin' ? 'segment active' : 'segment'} onClick={() => onModeChange('signin')}>
            Sign in
          </button>
          <button className={mode === 'signup' ? 'segment active' : 'segment'} onClick={() => onModeChange('signup')}>
            Sign up
          </button>
        </div>

        <div className="field-group">
          <label>Email</label>
          <input type="email" placeholder="hello@pixiegurlll.ai" />
        </div>

        <div className="field-group">
          <label>Password</label>
          <input type="password" placeholder="••••••••" />
        </div>

        <div className="toggle-row">
          <label>Guest / demo mode</label>
          <input type="checkbox" checked={guestMode} onChange={(event) => onGuestModeChange(event.target.checked)} />
        </div>

        <button className="primary-button full-width">{mode === 'signin' ? 'Continue' : 'Create account'}</button>
        <button className="secondary-button full-width">Reset password</button>

        <p className="helper-text">
          Authentication is optional in this demo. When no backend is configured, the app remains usable in local-only guest mode without pretending that cloud-backed accounts are active.
        </p>
      </div>
    </div>
  );
}

export default App;
