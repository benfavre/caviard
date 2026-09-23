export const emptyHistory = { marks: {}, undo: {}, redo: {} };

// Each document owns its history, including removals and clearing all regions.
export function redactionHistory(state, action) {
  const { id, type } = action;
  const current = state.marks[id] || [];
  const past = state.undo[id] || [];
  const future = state.redo[id] || [];
  if (type === "close") {
    return Object.fromEntries(
      Object.entries(state).map(([key, values]) => {
        const next = { ...values };
        delete next[id];
        return [key, next];
      }),
    );
  }
  if (type === "undo" || type === "redo") {
    const source = type === "undo" ? past : future;
    if (!source.length) return state;
    return {
      marks: { ...state.marks, [id]: source.at(-1) },
      undo: {
        ...state.undo,
        [id]: type === "undo" ? past.slice(0, -1) : [...past, current],
      },
      redo: {
        ...state.redo,
        [id]: type === "redo" ? future.slice(0, -1) : [...future, current],
      },
    };
  }
  const next =
    type === "batch"
      ? [...current, ...action.marks]
      : type === "add"
        ? [...current, action.mark]
        : type === "remove"
          ? current.filter((mark) => mark.id !== action.markId)
          : type === "clear"
            ? []
            : current;
  if (
    next === current ||
    (next.length === current.length && type !== "add" && type !== "batch")
  )
    return state;
  return {
    marks: { ...state.marks, [id]: next },
    undo: { ...state.undo, [id]: [...past, current] },
    redo: { ...state.redo, [id]: [] },
  };
}
