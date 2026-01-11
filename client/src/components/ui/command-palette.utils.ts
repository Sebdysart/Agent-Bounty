import type { CommandItem, RecentCommand, FuzzyMatch } from './command-palette.types';

const RECENT_COMMANDS_KEY = 'command-palette-recent';

export function fuzzyMatch(query: string, target: string): { matched: boolean; score: number; matches: number[] } {
  if (!query) return { matched: true, score: 0, matches: [] };
  
  const lowerQuery = query.toLowerCase();
  const lowerTarget = target.toLowerCase();
  const matches: number[] = [];
  
  let queryIndex = 0;
  let score = 0;
  let consecutiveMatches = 0;
  
  for (let i = 0; i < lowerTarget.length && queryIndex < lowerQuery.length; i++) {
    if (lowerTarget[i] === lowerQuery[queryIndex]) {
      matches.push(i);
      queryIndex++;
      consecutiveMatches++;
      score += 1 + consecutiveMatches * 0.5;
    } else {
      consecutiveMatches = 0;
    }
  }
  
  const matched = queryIndex === lowerQuery.length;
  return { matched, score, matches };
}

export function searchCommands(commands: CommandItem[], query: string): FuzzyMatch[] {
  if (!query) return [];
  
  const results: FuzzyMatch[] = [];
  
  for (const cmd of commands) {
    const labelMatch = fuzzyMatch(query, cmd.label);
    const keywordMatches = (cmd.keywords || []).map(k => fuzzyMatch(query, k));
    const bestKeywordMatch = keywordMatches.reduce((best, curr) => 
      curr.score > best.score ? curr : best, 
      { matched: false, score: 0, matches: [] }
    );
    
    if (labelMatch.matched) {
      results.push({
        item: cmd,
        score: labelMatch.score * 2,
        matches: labelMatch.matches,
      });
    } else if (bestKeywordMatch.matched) {
      results.push({
        item: cmd,
        score: bestKeywordMatch.score,
        matches: [],
      });
    }
  }
  
  return results.sort((a, b) => b.score - a.score);
}

export function highlightMatches(text: string, matches: number[]): { type: 'highlight'; text: string; matches: number[] } {
  return { type: 'highlight', text, matches };
}

export function getRecentCommands(limit: number): string[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(RECENT_COMMANDS_KEY);
    if (!stored) return [];
    
    const recents: RecentCommand[] = JSON.parse(stored);
    return recents
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
      .map(r => r.id);
  } catch {
    return [];
  }
}

export function addRecentCommand(commandId: string, limit: number): void {
  if (typeof window === 'undefined') return;
  
  try {
    const stored = localStorage.getItem(RECENT_COMMANDS_KEY);
    let recents: RecentCommand[] = stored ? JSON.parse(stored) : [];
    
    recents = recents.filter(r => r.id !== commandId);
    recents.push({ id: commandId, timestamp: Date.now() });
    recents = recents.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
    
    localStorage.setItem(RECENT_COMMANDS_KEY, JSON.stringify(recents));
  } catch {
    // Silent fail
  }
}

export function flattenCommands(commands: CommandItem[]): CommandItem[] {
  const result: CommandItem[] = [];
  
  for (const cmd of commands) {
    result.push(cmd);
    if (cmd.children) {
      result.push(...flattenCommands(cmd.children));
    }
  }
  
  return result;
}
