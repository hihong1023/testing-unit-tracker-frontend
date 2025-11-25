import React, { createContext, useCallback, useContext, useState } from "react";

type PromptKind = "alert" | "confirm";

type PromptState = {
  open: boolean;
  kind: PromptKind;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  resolve?: (value: boolean) => void;
};

const PromptContext = createContext<{
  alert: (message: string, title?: string) => Promise<void>;
  confirm: (
    message: string,
    title?: string,
    opts?: { confirmText?: string; cancelText?: string }
  ) => Promise<boolean>;
} | null>(null);

export function PromptProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PromptState>({
    open: false,
    kind: "alert",
    title: "Notice",
    message: "",
  });

  const close = useCallback((value: boolean) => {
    setState((prev) => {
      prev.resolve?.(value);
      return { ...prev, open: false, resolve: undefined };
    });
  }, []);

  const alert = useCallback((message: string, title = "Notice") => {
    return new Promise<void>((resolve) => {
      setState({
        open: true,
        kind: "alert",
        title,
        message,
        confirmText: "OK",
        resolve: () => resolve(),
      });
    });
  }, []);

  const confirm = useCallback(
    (
      message: string,
      title = "Confirm",
      opts?: { confirmText?: string; cancelText?: string }
    ) => {
      return new Promise<boolean>((resolve) => {
        setState({
          open: true,
          kind: "confirm",
          title,
          message,
          confirmText: opts?.confirmText ?? "Confirm",
          cancelText: opts?.cancelText ?? "Cancel",
          resolve,
        });
      });
    },
    []
  );

  return (
    <PromptContext.Provider value={{ alert, confirm }}>
      {children}

      {state.open && (
        <div className="prompt-backdrop" onClick={() => close(false)}>
          <div
            className="prompt-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="prompt-title">{state.title}</div>
            <div className="prompt-message">{state.message}</div>

            <div className="prompt-actions">
              {state.kind === "confirm" && (
                <button
                  className="btn btn-secondary"
                  onClick={() => close(false)}
                >
                  {state.cancelText}
                </button>
              )}

              <button
                className="btn btn-primary"
                onClick={() => close(true)}
              >
                {state.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </PromptContext.Provider>
  );
}

export function usePrompt() {
  const ctx = useContext(PromptContext);
  if (!ctx) throw new Error("usePrompt must be used inside PromptProvider");
  return ctx;
}
