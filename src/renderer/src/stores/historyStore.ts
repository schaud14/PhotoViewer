import { create } from 'zustand'

export type ActionType = 'DELETE' | 'MOVE_ALBUM' | 'TAG' | 'FAVORITE' | 'EDIT'

export interface HistoryAction {
  id: string
  type: ActionType
  description: string
  undo: () => Promise<void>
  redo?: () => Promise<void> // Optional: full redo support if needed
}

interface HistoryState {
  past: HistoryAction[]
  push: (action: HistoryAction) => void
  undo: () => Promise<void>
  clear: () => void
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  push: (action) => {
    set((state) => ({
      // Keep last 50 actions
      past: [...state.past, action].slice(-50)
    }))
  },
  undo: async () => {
    const state = get()
    if (state.past.length === 0) return

    const action = state.past[state.past.length - 1]
    
    try {
      console.log(`[History] Undoing action: ${action.description}`)
      await action.undo()
      
      // Remove from past stack on success
      set((s) => ({
        past: s.past.slice(0, -1)
      }))
    } catch (err) {
      console.error(`[History] Failed to undo action ${action.description}:`, err)
    }
  },
  clear: () => set({ past: [] })
}))
