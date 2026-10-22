import { useEffect, useRef, useState } from "react";
import type { PreviewResult, TemplateList } from "../../types";
import { errorMessage, fetchPreviewData } from "./preview";

interface RenderState {
  id: string;
  value: PreviewResult | null;
  loading: boolean;
  error: string | null;
  version: number;
}

export function usePreviewData(templateId: string | undefined) {
  const [list, setList] = useState<TemplateList | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [retry, setRetry] = useState(0);
  const [connection, setConnection] = useState<"connecting" | "live" | "reconnecting">(
    "connecting",
  );
  const [render, setRender] = useState<RenderState | null>(null);
  const renderVersion = useRef(0);
  const selected = list?.templates.find((template) => template.id === templateId);

  useEffect(() => {
    const events = new EventSource("/api/events");
    function update(event: MessageEvent<string>) {
      try {
        const data: unknown = JSON.parse(event.data);
        if (
          typeof data === "object" &&
          data !== null &&
          "revision" in data &&
          typeof data.revision === "number" &&
          Number.isFinite(data.revision)
        ) {
          setRevision(data.revision);
        }
      } catch {
        // A later valid event still updates the preview without losing the connection.
      }
    }
    events.addEventListener("ready", update);
    events.addEventListener("change", update);
    events.onopen = () => {
      setConnection("live");
      // Reconcile files even if a restarted server uses the same revision.
      setRetry((value) => value + 1);
    };
    events.onerror = () => setConnection("reconnecting");
    return () => events.close();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setListError(null);
    void fetchPreviewData<TemplateList>("/api/templates", controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setList(value);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setListError(errorMessage(error));
      });
    return () => controller.abort();
  }, [revision, retry]);

  const selectedId = selected?.id;
  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    setRender((previous) => ({
      id: selectedId,
      value: previous?.id === selectedId ? previous.value : null,
      loading: true,
      error: null,
      version: previous?.version ?? 0,
    }));
    void fetchPreviewData<PreviewResult>(
      `/api/preview?template=${encodeURIComponent(selectedId)}`,
      controller.signal,
    )
      .then((value) => {
        if (!controller.signal.aborted) {
          setRender({
            id: selectedId,
            value,
            loading: false,
            error: null,
            version: ++renderVersion.current,
          });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setRender({
            id: selectedId,
            value: null,
            loading: false,
            error: errorMessage(error),
            version: renderVersion.current,
          });
        }
      });
    return () => controller.abort();
  }, [selectedId, revision, retry]);

  const current = render?.id === selectedId ? render : null;
  return {
    list,
    listError,
    selected,
    connection,
    preview: current?.value ?? null,
    renderVersion: current?.version ?? 0,
    previewError: current?.error ?? null,
    loading: Boolean(selectedId) && (current?.loading ?? true),
    retry: () => setRetry((value) => value + 1),
  };
}
