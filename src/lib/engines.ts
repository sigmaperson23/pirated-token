export interface Engine {
  id: string;
  name: string;
  command: string;
  resume?: string;
  install: string;
}

/** Coding tools Switchyard can start. Install commands are typed into a pane and wait for you to press Enter. */
export const ENGINES: Engine[] = [
  { id: 'claude', name: 'Claude Code', command: 'claude', resume: 'claude --continue', install: 'irm https://claude.ai/install.ps1 | iex' },
  { id: 'codex', name: 'Codex', command: 'codex', resume: 'codex resume --last', install: 'npm install -g @openai/codex' },
  { id: 'opencode', name: 'OpenCode', command: 'opencode', resume: 'opencode --continue', install: 'npm install -g opencode-ai' },
  { id: 'grok', name: 'Grok', command: 'grok', install: 'irm https://x.ai/cli/install.ps1 | iex' },
  { id: 'gemini', name: 'Gemini CLI', command: 'gemini', install: 'npm install -g @google/gemini-cli' },
  { id: 'copilot', name: 'Copilot CLI', command: 'copilot', install: 'npm install -g @github/copilot' },
  { id: 'cursor', name: 'Cursor CLI', command: 'cursor-agent', install: "irm 'https://cursor.com/install?win32=true' | iex" },
  { id: 'aider', name: 'Aider', command: 'aider', install: 'irm https://aider.chat/install.ps1 | iex' },
  { id: 'kimi', name: 'Kimi Code', command: 'kimi', install: 'irm https://code.kimi.com/kimi-code/install.ps1 | iex' },
  { id: 'droid', name: 'Droid', command: 'droid', install: 'irm https://app.factory.ai/cli/windows | iex' },
  { id: 'amp', name: 'Amp', command: 'amp', install: 'irm https://ampcode.com/install.ps1 | iex' },
];

export const engineById = (id?: string) => ENGINES.find((e) => e.id === id);
