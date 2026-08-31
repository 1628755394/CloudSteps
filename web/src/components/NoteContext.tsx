import { createContext, useContext, useState, type ReactNode } from "react";
import { useSplitScreenNote } from "../hooks/useSplitScreenNote";

type NoteSide = "left" | "right";

type NoteContextValue = ReturnType<typeof useSplitScreenNote> & {
  storageKey: string;
  setStorageKey: (key: string) => void;
  openNote: (key: string) => void;
  defaultTitle: string;
  setDefaultTitle: (title: string) => void;
};

const NoteContext = createContext<NoteContextValue | null>(null);

export function NoteProvider({ children }: { children: ReactNode }) {
  const note = useSplitScreenNote("lb_global_note_width");
  const [storageKey, setStorageKey] = useState("");
  const [defaultTitle, setDefaultTitle] = useState("随心记");

  const openNote = (key: string) => {
    setStorageKey(key);
    note.setOpen(true);
  };

  return (
    <NoteContext.Provider
      value={{
        ...note,
        storageKey,
        setStorageKey,
        openNote,
        defaultTitle,
        setDefaultTitle,
      }}
    >
      {children}
    </NoteContext.Provider>
  );
}

export function useNote() {
  const ctx = useContext(NoteContext);
  if (!ctx) throw new Error("useNote must be used within NoteProvider");
  return ctx;
}
