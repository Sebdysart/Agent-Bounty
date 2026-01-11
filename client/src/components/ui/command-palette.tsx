import * as React from 'react';
import { Command } from 'cmdk';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, AlertCircle } from 'lucide-react';
import type { CommandPaletteProps, CommandItem, CommandGroupKey } from './command-palette.types';
import {
  searchCommands,
  getRecentCommands,
  addRecentCommand,
  flattenCommands,
} from './command-palette.utils';

export { type CommandPaletteProps, type CommandItem, type CommandGroupKey } from './command-palette.types';

type ExecutionState = {
  commandId: string | null;
  status: 'idle' | 'loading' | 'error';
};

const groupOrder: CommandGroupKey[] = ['Recent', 'Navigation', 'Actions', 'Settings', 'Help'];

function renderHighlightedText(text: string, matches: number[]): React.ReactNode {
  if (matches.length === 0) {
    return <span className="text-foreground">{text}</span>;
  }
  
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  
  for (const matchIndex of matches) {
    if (matchIndex > lastIndex) {
      parts.push(
        <span key={`text-${lastIndex}`} className="text-muted-foreground">
          {text.slice(lastIndex, matchIndex)}
        </span>
      );
    }
    parts.push(
      <span key={`match-${matchIndex}`} className="text-foreground font-semibold bg-violet-500/20">
        {text[matchIndex]}
      </span>
    );
    lastIndex = matchIndex + 1;
  }
  
  if (lastIndex < text.length) {
    parts.push(
      <span key={`text-${lastIndex}`} className="text-muted-foreground">
        {text.slice(lastIndex)}
      </span>
    );
  }
  
  return <>{parts}</>;
}

export function CommandPalette({
  commands,
  isOpen,
  onOpenChange,
  placeholder = 'Type a command or search...',
  recentLimit = 5,
}: CommandPaletteProps) {
  const [query, setQuery] = React.useState('');
  const [breadcrumb, setBreadcrumb] = React.useState<string[]>(['Commands']);
  const [currentCommands, setCurrentCommands] = React.useState<CommandItem[]>(commands);
  const [executionState, setExecutionState] = React.useState<ExecutionState>({ commandId: null, status: 'idle' });
  const [recentIds, setRecentIds] = React.useState<string[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      setRecentIds(getRecentCommands(recentLimit));
      document.body.style.overflow = 'hidden';
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      document.body.style.overflow = '';
      setQuery('');
      setBreadcrumb(['Commands']);
      setCurrentCommands(commands);
      setExecutionState({ commandId: null, status: 'idle' });
    }
  }, [isOpen, commands, recentLimit]);

  const allCommands = React.useMemo(() => flattenCommands(commands), [commands]);
  
  const recentCommands = React.useMemo(() => {
    return recentIds.map(id => allCommands.find(cmd => cmd.id === id)).filter(Boolean) as CommandItem[];
  }, [recentIds, allCommands]);

  const filteredCommands = React.useMemo(() => {
    if (!query) return currentCommands;
    
    const matches = searchCommands(currentCommands, query);
    return matches.map(m => ({ ...m.item, _matches: m.matches }));
  }, [query, currentCommands]);

  const groupedCommands = React.useMemo(() => {
    const groups = new Map<CommandGroupKey | 'Recent', CommandItem[]>();
    
    if (!query && recentCommands.length > 0 && breadcrumb.length === 1) {
      groups.set('Recent', recentCommands);
    }
    
    for (const cmd of filteredCommands) {
      const group = cmd.group;
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(cmd);
    }
    
    const sortedGroups: Array<[CommandGroupKey | 'Recent', CommandItem[]]> = [];
    for (const key of groupOrder) {
      if (groups.has(key)) {
        sortedGroups.push([key, groups.get(key)!]);
      }
    }
    
    return sortedGroups;
  }, [filteredCommands, recentCommands, query, breadcrumb]);

  const handleSelect = async (item: CommandItem) => {
    if (executionState.status === 'loading') return;
    
    if (item.children && item.children.length > 0) {
      setBreadcrumb([...breadcrumb, item.label]);
      setCurrentCommands(item.children);
      setQuery('');
      return;
    }
    
    if (item.action) {
      setExecutionState({ commandId: item.id, status: 'loading' });
      
      try {
        await item.action();
        setExecutionState({ commandId: null, status: 'idle' });
        addRecentCommand(item.id, recentLimit);
        setRecentIds(getRecentCommands(recentLimit));
        onOpenChange(false);
      } catch (error) {
        setExecutionState({ commandId: item.id, status: 'error' });
        setTimeout(() => {
          setExecutionState({ commandId: null, status: 'idle' });
        }, 2000);
      }
    }
  };

  const handleBack = () => {
    if (breadcrumb.length > 1) {
      const newBreadcrumb = breadcrumb.slice(0, -1);
      setBreadcrumb(newBreadcrumb);
      
      if (newBreadcrumb.length === 1) {
        setCurrentCommands(commands);
      } else {
        let cmds = commands;
        for (let i = 1; i < newBreadcrumb.length; i++) {
          const label = newBreadcrumb[i];
          const parent = cmds.find(c => c.label === label);
          if (parent?.children) cmds = parent.children;
        }
        setCurrentCommands(cmds);
      }
      setQuery('');
    } else {
      onOpenChange(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleBack();
    }
  };

  if (!isOpen) return null;

  const hasResults = groupedCommands.length > 0;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[9999] flex items-start justify-center pt-[20vh]"
        onClick={() => onOpenChange(false)}
        data-testid="command-palette-overlay"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-xl"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-xl mx-4"
        >
          <div className="p-[2px] bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 rounded-xl shadow-2xl shadow-violet-500/20">
            <div className="bg-background/95 backdrop-blur-md rounded-xl overflow-hidden">
              {breadcrumb.length > 1 && (
                <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border/50 flex items-center gap-1">
                  {breadcrumb.map((crumb, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && <span className="text-violet-500">/</span>}
                      <span className={i === breadcrumb.length - 1 ? 'text-foreground' : ''}>{crumb}</span>
                    </React.Fragment>
                  ))}
                </div>
              )}
              
              <Command
                onKeyDown={handleKeyDown}
                className="bg-transparent"
                shouldFilter={false}
              >
                <div className="flex items-center border-b border-border/50 px-4">
                  <Search className="mr-3 h-4 w-4 shrink-0 text-violet-400" />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={placeholder}
                    className="flex h-12 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    data-testid="command-palette-input"
                  />
                  <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-border/50 bg-muted/50 px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                    ESC
                  </kbd>
                </div>
                
                <div className="max-h-[60vh] overflow-y-auto p-2">
                  {!hasResults && query && (
                    <div className="py-12 text-center">
                      <p className="text-sm text-muted-foreground mb-4">No results found</p>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>Try searching for:</p>
                        <div className="flex gap-2 justify-center flex-wrap">
                          {['theme', 'bounty', 'agent', 'dashboard'].map(suggestion => (
                            <button
                              key={suggestion}
                              onClick={() => setQuery(suggestion)}
                              className="px-2 py-1 bg-muted hover:bg-muted/80 rounded text-xs transition-colors"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => setQuery('')}
                        className="mt-4 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                      >
                        View all commands
                      </button>
                    </div>
                  )}
                  
                  {hasResults && (
                    <Command.List>
                      {groupedCommands.map(([group, items], groupIndex) => (
                        <Command.Group
                          key={group}
                          heading={group}
                          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
                        >
                          {items.map((item, itemIndex) => {
                            const isExecuting = executionState.commandId === item.id;
                            const isLoading = isExecuting && executionState.status === 'loading';
                            const isError = isExecuting && executionState.status === 'error';
                            const matches = (item as any)._matches || [];
                            
                            return (
                              <motion.div
                                key={item.id}
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: groupIndex * 0.03 + itemIndex * 0.015 }}
                              >
                                <Command.Item
                                  onSelect={() => handleSelect(item)}
                                  disabled={isLoading}
                                  className="relative flex cursor-pointer select-none items-center gap-3 rounded-lg px-3 py-2.5 text-sm outline-none transition-all hover:bg-accent/50 data-[selected=true]:bg-accent/80 aria-disabled:pointer-events-none aria-disabled:opacity-50 group"
                                  data-testid={`command-item-${item.id}`}
                                >
                                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-0 bg-gradient-to-b from-violet-500 via-fuchsia-500 to-cyan-500 rounded-r group-data-[selected=true]:h-6 transition-all duration-200" />
                                  
                                  {item.icon && (
                                    <div className="shrink-0 flex items-center justify-center w-5 h-5 text-muted-foreground group-data-[selected=true]:text-violet-400 transition-colors">
                                      {item.icon}
                                    </div>
                                  )}
                                  
                                  <div className="flex-1 min-w-0">
                                    {query && matches.length > 0 ? (
                                      renderHighlightedText(item.label, matches)
                                    ) : (
                                      <span className="text-foreground">{item.label}</span>
                                    )}
                                  </div>
                                  
                                  {isLoading && (
                                    <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
                                  )}
                                  
                                  {isError && (
                                    <AlertCircle className="h-4 w-4 text-destructive" />
                                  )}
                                  
                                  {!isLoading && !isError && item.shortcut && (
                                    <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border/50 bg-muted/50 px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                                      {item.shortcut}
                                    </kbd>
                                  )}
                                  
                                  {!isLoading && !isError && item.children && (
                                    <span className="text-violet-400 text-xs">→</span>
                                  )}
                                </Command.Item>
                              </motion.div>
                            );
                          })}
                        </Command.Group>
                      ))}
                    </Command.List>
                  )}
                </div>
              </Command>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
