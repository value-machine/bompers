import { useState, type DragEvent } from "react";

export interface FileDropTarget {
  /** True while files are dragged over the target (show a drop hint). */
  isDragging: boolean;
  /** Spread onto the drop target element. */
  dropHandlers: {
    onDragOver: (event: DragEvent) => void;
    onDragLeave: (event: DragEvent) => void;
    onDrop: (event: DragEvent) => void;
  };
}

const carriesFiles = (event: DragEvent): boolean =>
  Array.from(event.dataTransfer.types).includes("Files");

/** Makes an element accept dropped files; `onFile` gets the first dropped file. */
export function useFileDrop(onFile: (file: File) => void): FileDropTarget {
  const [isDragging, setIsDragging] = useState(false);
  return {
    isDragging,
    dropHandlers: {
      onDragOver: (event) => {
        if (!carriesFiles(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setIsDragging(true);
      },
      onDragLeave: (event) => {
        // Moving onto a child fires dragleave on the parent; only leaving the target counts.
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setIsDragging(false);
      },
      onDrop: (event) => {
        if (!carriesFiles(event)) return;
        event.preventDefault();
        setIsDragging(false);
        const file = event.dataTransfer.files[0];
        if (file) onFile(file);
      },
    },
  };
}
