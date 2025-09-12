import { ActionType } from '../types';

export interface PluginState {
  // Navigation state
  lastContextNote: string | null;
  lastContext: string | null;
  
  // UI state
  currentModalType: 'context-browser' | 'note-viewer' | null;
  isProcessingNote: boolean;
  
  // Session state
  sessionStartTime: number;
  notesProcessedThisSession: number;
  
  // Action type tracking
  actionTypeUsage: Record<ActionType, number>;
  
  // Cache state
  cachedContexts: string[] | null;
  contextsCacheTimestamp: number | null;
}

type StateListener<T = any> = (newValue: T, oldValue: T) => void;

export class StateManager {
  private state: PluginState;
  private listeners: Map<keyof PluginState | 'any', Set<StateListener>> = new Map();
  
  constructor(initialState?: Partial<PluginState>) {
    this.state = {
      lastContextNote: null,
      lastContext: null,
      currentModalType: null,
      isProcessingNote: false,
      sessionStartTime: Date.now(),
      notesProcessedThisSession: 0,
      actionTypeUsage: {
        'look-at': 0,
        'do': 0,
        'iterate': 0,
        'schedule': 0,
        'improve': 0,
        'evaluate': 0,
        'memorize': 0,
      },
      cachedContexts: null,
      contextsCacheTimestamp: null,
      ...initialState
    };
  }
  
  // Get state
  get<K extends keyof PluginState>(key: K): PluginState[K] {
    return this.state[key];
  }
  
  getAll(): Readonly<PluginState> {
    return { ...this.state };
  }
  
  // Set state with change notification
  set<K extends keyof PluginState>(key: K, value: PluginState[K]): void {
    const oldValue = this.state[key];
    if (oldValue !== value) {
      this.state[key] = value;
      this.notifyListeners(key, value, oldValue);
      this.notifyListeners('any', value, oldValue);
    }
  }
  
  // Batch updates
  update(updates: Partial<PluginState>): void {
    const changes: Array<{key: keyof PluginState, newValue: any, oldValue: any}> = [];
    
    for (const [key, value] of Object.entries(updates)) {
      const typedKey = key as keyof PluginState;
      const oldValue = this.state[typedKey];
      if (oldValue !== value) {
        (this.state as any)[typedKey] = value;
        changes.push({ key: typedKey, newValue: value, oldValue });
      }
    }
    
    // Notify all changes
    changes.forEach(({ key, newValue, oldValue }) => {
      this.notifyListeners(key, newValue, oldValue);
    });
    
    if (changes.length > 0) {
      this.notifyListeners('any', this.state, null);
    }
  }
  
  // Subscribe to changes
  subscribe<K extends keyof PluginState>(
    key: K | 'any', 
    listener: StateListener<PluginState[K]>
  ): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(listener);
    
    return () => this.unsubscribe(key, listener);
  }
  
  private unsubscribe<K extends keyof PluginState>(
    key: K | 'any', 
    listener: StateListener
  ): void {
    this.listeners.get(key)?.delete(listener);
  }
  
  private notifyListeners<K extends keyof PluginState>(
    key: K | 'any', 
    newValue: any, 
    oldValue: any
  ): void {
    this.listeners.get(key)?.forEach(listener => {
      try {
        listener(newValue, oldValue);
      } catch (error) {
        console.error(`State listener error for ${key}:`, error);
      }
    });
  }
  
  // Utility methods
  clearNavigationState(): void {
    this.update({
      lastContextNote: null,
      lastContext: null,
      currentModalType: null
    });
  }
  
  invalidateCache(): void {
    this.update({
      cachedContexts: null,
      contextsCacheTimestamp: null
    });
  }
  
  incrementNotesProcessed(): void {
    this.set('notesProcessedThisSession', this.state.notesProcessedThisSession + 1);
  }
  
  // Action type tracking methods
  incrementActionTypeUsage(actionType: ActionType): void {
    const currentUsage = { ...this.state.actionTypeUsage };
    currentUsage[actionType] = (currentUsage[actionType] || 0) + 1;
    this.set('actionTypeUsage', currentUsage);
  }
  
  getActionTypeUsage(): Record<ActionType, number> {
    return { ...this.state.actionTypeUsage };
  }
  
  resetActionTypeUsage(): void {
    const resetUsage: Record<ActionType, number> = {
      'look-at': 0,
      'do': 0,
      'iterate': 0,
      'schedule': 0,
      'improve': 0,
      'evaluate': 0,
      'memorize': 0,
    };
    this.set('actionTypeUsage', resetUsage);
  }
}