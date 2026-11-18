/**
 * A region of grid blocks as few rectangles: one slab per run of touching blocks on a row. Drawn
 * with a little overlap between rows, a whole region (a fire's body, a frozen patch) costs a
 * slab per row run instead of a shape per block.
 */
export interface GridBlock {
  /** Block column and row. */
  bx: number;
  by: number;
}

/** A slab in world units: top-left corner, width, height. */
export interface BlockSlab {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One slab per row run of `blocks` (each `size` wide and high), grown by `grow` all round. */
export function rowRunSlabs(
  blocks: Iterable<GridBlock>,
  look: { size: number; grow: number }
): BlockSlab[] {
  const { size, grow } = look;
  const rows = new Map<number, number[]>();
  for (const block of blocks) {
    const row = rows.get(block.by);
    if (row) row.push(block.bx);
    else rows.set(block.by, [block.bx]);
  }
  const slabs: BlockSlab[] = [];
  for (const [by, columns] of rows) {
    columns.sort((a, b) => a - b);
    let start = 0;
    columns.forEach((bx, i) => {
      if (columns[i + 1] === bx + 1) return;
      const from = columns[start]!;
      slabs.push({
        x: from * size - grow,
        y: by * size - grow,
        w: (bx - from + 1) * size + 2 * grow,
        h: size + 2 * grow,
      });
      start = i + 1;
    });
  }
  return slabs;
}
