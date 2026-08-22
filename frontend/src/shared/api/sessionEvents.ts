export type UnauthorizedListener = () => void;

const unauthorizedListeners = new Set<UnauthorizedListener>();

export const subscribeToUnauthorized = (
  listener: UnauthorizedListener,
): (() => void) => {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
};

export const publishUnauthorized = (): void => {
  unauthorizedListeners.forEach(listener => listener());
};
