export type CommandGroupKey = 'Recent' | 'Navigation' | 'Actions' | 'Settings' | 'Help';

export type CommandItem = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  group: CommandGroupKey;
  keywords?: string[];
  action?: () => void | Promise<void>;
  children?: CommandItem[];
};

export type CommandPaletteProps = {
  commands: CommandItem[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  placeholder?: string;
  recentLimit?: number;
};

export type RecentCommand = {
  id: string;
  timestamp: number;
};

export type FuzzyMatch = {
  item: CommandItem;
  score: number;
  matches: number[];
};
