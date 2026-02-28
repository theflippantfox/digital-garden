import type { Accent } from '$lib/types';

function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return Math.abs(hash);
}

const ACCENTS: Accent[] = [
  'violet', 'coral', 'cyan', 'lime',
  'amber', 'rose', 'sky', 'emerald', 'indigo', 'orange'
];

const KNOWN_ACCENTS: Record<string, Accent> = {
  engineering: 'violet', code: 'violet', dev: 'violet', tech: 'indigo',
  systems: 'indigo', backend: 'sky', frontend: 'sky', data: 'cyan',
  philosophy: 'coral', reflection: 'coral', essay: 'rose', ideas: 'rose',
  design: 'cyan', ux: 'sky', art: 'orange', visual: 'orange', typography: 'amber',
  life: 'emerald', health: 'emerald', productivity: 'lime', habits: 'lime',
  writing: 'amber', reading: 'amber', books: 'amber', learning: 'lime',
  science: 'cyan', math: 'indigo', research: 'indigo', tools: 'violet',
  aesthetics: 'rose', creativity: 'orange', nature: 'emerald',
};

export function tagToAccent(tag: string): Accent {
  const key = tag.toLowerCase().trim();
  return KNOWN_ACCENTS[key] ?? ACCENTS[djb2(key) % ACCENTS.length];
}

const EMOJI_POOL = ['💡','🔧','🎨','📐','🧪','🌊','🔬','📡','⚡','🎯','🧩','🌀'];

const KNOWN_EMOJIS: Record<string, string> = {
  engineering: '⚙️', code: '💻', dev: '💻', tech: '🖥️', systems: '🧩',
  philosophy: '🔮', reflection: '🪞', essay: '📝', ideas: '💡',
  design: '✦', ux: '🖌️', art: '🎨', visual: '👁️', typography: '🔤',
  writing: '✍️', reading: '📖', books: '📚', learning: '🧠',
  science: '🔬', math: '∑', research: '🔭', data: '📊',
  life: '🌸', health: '🫀', productivity: '⚡', habits: '🔄',
  backend: '🗄️', frontend: '🖼️', tools: '🔧',
  aesthetics: '✨', creativity: '🌈', nature: '🌿',
};

export function tagToEmoji(tag: string): string {
  const key = tag.toLowerCase().trim();
  return KNOWN_EMOJIS[key] ?? EMOJI_POOL[djb2(key) % EMOJI_POOL.length];
}

export const ACCENT_STYLES: Record<Accent, {
  hex: string; text: string; border: string; bg: string; hoverBorder: string;
}> = {
  violet:  { hex: '#b44dff', text: 'text-[#b44dff]', border: 'border-[rgba(180,77,255,0.3)]',  bg: 'bg-[rgba(180,77,255,0.1)]',  hoverBorder: 'hover:border-[rgba(180,77,255,0.5)]' },
  coral:   { hex: '#ff5c3a', text: 'text-[#ff5c3a]', border: 'border-[rgba(255,92,58,0.3)]',   bg: 'bg-[rgba(255,92,58,0.1)]',   hoverBorder: 'hover:border-[rgba(255,92,58,0.5)]'  },
  cyan:    { hex: '#00f0ff', text: 'text-[#00f0ff]', border: 'border-[rgba(0,240,255,0.3)]',   bg: 'bg-[rgba(0,240,255,0.08)]',  hoverBorder: 'hover:border-[rgba(0,240,255,0.5)]'  },
  lime:    { hex: '#b8ff3a', text: 'text-[#b8ff3a]', border: 'border-[rgba(184,255,58,0.3)]',  bg: 'bg-[rgba(184,255,58,0.08)]', hoverBorder: 'hover:border-[rgba(184,255,58,0.5)]' },
  amber:   { hex: '#ffb84d', text: 'text-[#ffb84d]', border: 'border-[rgba(255,184,77,0.3)]',  bg: 'bg-[rgba(255,184,77,0.1)]',  hoverBorder: 'hover:border-[rgba(255,184,77,0.5)]' },
  rose:    { hex: '#ff4d8b', text: 'text-[#ff4d8b]', border: 'border-[rgba(255,77,139,0.3)]',  bg: 'bg-[rgba(255,77,139,0.1)]',  hoverBorder: 'hover:border-[rgba(255,77,139,0.5)]' },
  sky:     { hex: '#4d9fff', text: 'text-[#4d9fff]', border: 'border-[rgba(77,159,255,0.3)]',  bg: 'bg-[rgba(77,159,255,0.1)]',  hoverBorder: 'hover:border-[rgba(77,159,255,0.5)]' },
  emerald: { hex: '#4dffb8', text: 'text-[#4dffb8]', border: 'border-[rgba(77,255,184,0.3)]',  bg: 'bg-[rgba(77,255,184,0.08)]', hoverBorder: 'hover:border-[rgba(77,255,184,0.5)]' },
  indigo:  { hex: '#6b4dff', text: 'text-[#6b4dff]', border: 'border-[rgba(107,77,255,0.3)]',  bg: 'bg-[rgba(107,77,255,0.1)]',  hoverBorder: 'hover:border-[rgba(107,77,255,0.5)]' },
  orange:  { hex: '#ff7a4d', text: 'text-[#ff7a4d]', border: 'border-[rgba(255,122,77,0.3)]',  bg: 'bg-[rgba(255,122,77,0.1)]',  hoverBorder: 'hover:border-[rgba(255,122,77,0.5)]' },
};
