import { create } from "zustand";

type WordEditState = {
  editingId: number | null;
  openEditor: (wordId: number) => void;
  closeEditor: () => void;
};

export const useWordEditStore = create<WordEditState>((set) => ({
  editingId: null,
  openEditor: (wordId) => set({ editingId: wordId }),
  closeEditor: () => set({ editingId: null }),
}));
