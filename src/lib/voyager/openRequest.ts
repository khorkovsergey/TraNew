type Listener = () => void;

const listeners = new Set<Listener>();

/**
 * Lets anything on the page ask Voyager to open.
 *
 * The widget lives at layout level and owns its own state, so a call like this is
 * the alternative to lifting that state into a context every page would re-render
 * against. It carries no arguments on purpose: the caller asks for the assistant,
 * it does not get to say which tier, which sources or which question — all of that
 * stays where it is decided, on the server.
 */
export function openVoyager() {
  listeners.forEach((listener) => listener());
}

export function onVoyagerOpenRequest(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
