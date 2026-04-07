"use client";

import { useState, useEffect } from "react";
import useSWR, { mutate } from "swr";
import { useAppStore } from "../../store/app.store";
import {
  Settings,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Zap,
  AlertCircle,
} from "lucide-react";
import { clsx } from "clsx";
import { api } from "../../lib/api";
import type { LlmConfigPublic } from "../../lib/api";
import { AppShell } from "../../components/layout/AppShell";

const PROVIDERS = [
  { id: "openai", label: "OpenAI", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"] },
  {
    id: "anthropic",
    label: "Anthropic",
    models: ["claude-opus-4-5", "claude-sonnet-4-5", "claude-3-5-haiku-20241022"],
  },
  { id: "openrouter", label: "OpenRouter", models: ["openai/gpt-4o", "anthropic/claude-3.5-sonnet"] },
  { id: "ollama", label: "Ollama (local)", models: ["llama3", "mistral", "phi3"] },
] as const;

function ProviderCard({ config }: { config: LlmConfigPublic }) {
  const [activating, setActivating] = useState(false);

  async function handleActivate() {
    setActivating(true);
    try {
      await api.llmConfig.activate(config.id);
      mutate("/llm-config");
    } finally {
      setActivating(false);
    }
  }

  // Test the active provider with a minimal call
  const [testResult, setTestResult] = useState<"ok" | "error" | "credits" | "key" | null>(null);
  const [testing, setTesting] = useState(false);

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      await api.chat.send({
        mode: "archivista",
        messages: [{ role: "user", content: "ping" }],
      });
      setTestResult("ok");
    } catch (err: any) {
      const code = err.code ?? "";
      if (code === "INSUFFICIENT_CREDITS") setTestResult("credits");
      else if (code === "INVALID_API_KEY") setTestResult("key");
      else setTestResult("error");
    } finally {
      setTesting(false);
      setTimeout(() => setTestResult(null), 5000);
    }
  }

  return (
    <div
      className={clsx(
        "border rounded-lg p-4 flex items-center justify-between",
        config.isActive
          ? "border-amber-600 bg-amber-950/20"
          : "border-stone-800 bg-stone-900"
      )}
    >
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-stone-200 text-sm">{config.provider}</span>
          <span className="text-stone-600 text-xs">·</span>
          <span className="text-stone-400 text-xs">{config.model}</span>
          {config.isActive && (
            <span className="text-xs bg-amber-900 text-amber-300 border border-amber-700 px-1.5 py-0.5 rounded">
              Active
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs">
          {config.hasApiKey ? (
            <><CheckCircle size={11} className="text-emerald-400" /><span className="text-stone-500">Key saved</span></>
          ) : (
            <><XCircle size={11} className="text-stone-600" /><span className="text-stone-600">No key</span></>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        {config.isActive && config.hasApiKey && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleTest}
              disabled={testing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 border border-stone-700 disabled:opacity-50 rounded-lg text-xs text-stone-400 transition-colors"
            >
              {testing ? "Probando..." : "Probar"}
            </button>
            {testResult === "ok" && <span className="text-xs text-emerald-400">✓ OK</span>}
            {testResult === "credits" && <span className="text-xs text-amber-400">⚠ Sin crédito</span>}
            {testResult === "key" && <span className="text-xs text-red-400">✗ Key inválida</span>}
            {testResult === "error" && <span className="text-xs text-red-400">✗ Error</span>}
          </div>
        )}
        {!config.isActive && config.hasApiKey && (
          <button
            onClick={handleActivate}
            disabled={activating}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 border border-stone-700 rounded-lg text-xs text-stone-300 transition-colors"
          >
            <Zap size={12} />
            {activating ? "Activating..." : "Set Active"}
          </button>
        )}
      </div>
    </div>
  );
}

function AddProviderForm({ onSaved }: { onSaved: () => void }) {
  const [provider, setProvider] = useState<string>("openai");
  const [model, setModel] = useState("gpt-4o-mini");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedProvider = PROVIDERS.find((p) => p.id === provider);

  async function handleValidate() {
    if (!apiKey.trim()) return;
    setValidating(true);
    setValidated(null);
    try {
      const { valid } = await api.llmConfig.validate({ provider, apiKey: apiKey.trim() });
      setValidated(valid);
      if (!valid) setError("Key validation failed — check the key and try again");
      else setError("");
    } catch (e: any) {
      setValidated(false);
      setError(e.message ?? "Validation failed");
    } finally {
      setValidating(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.llmConfig.save({
        provider,
        model,
        apiKey: apiKey.trim() || undefined,
      });
      setApiKey("");
      setValidated(null);
      onSaved();
    } catch (e: any) {
      setError(e.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="border border-stone-800 bg-stone-900 rounded-xl p-6 space-y-4">
      <h3 className="font-semibold text-stone-200">Configure Provider</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-stone-400 mb-1">Provider</label>
          <select
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value);
              setValidated(null);
              const p = PROVIDERS.find((p) => p.id === e.target.value);
              if (p) setModel(p.models[0]);
            }}
            className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-stone-400 mb-1">Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
          >
            {selectedProvider?.models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm text-stone-400 mb-1">API Key</label>
        <div className="flex gap-2">
          <div className="flex-1 flex bg-stone-800 border border-stone-700 rounded-lg overflow-hidden focus-within:border-amber-500 transition-colors">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setValidated(null); }}
              placeholder={provider === "ollama" ? "Not required for local Ollama" : "sk-..."}
              className="flex-1 bg-transparent px-3 py-2 text-stone-100 text-sm focus:outline-none font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey((s) => !s)}
              className="px-3 text-stone-500 hover:text-stone-300 transition-colors"
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          <button
            type="button"
            onClick={handleValidate}
            disabled={validating || !apiKey.trim()}
            className="px-4 py-2 bg-stone-800 border border-stone-700 hover:border-stone-500 disabled:opacity-50 text-stone-300 rounded-lg text-sm transition-colors whitespace-nowrap"
          >
            {validating ? "Checking..." : "Validate"}
          </button>
        </div>

        {validated !== null && (
          <div className={clsx("flex items-center gap-1.5 text-sm mt-2", validated ? "text-emerald-400" : "text-red-400")}>
            {validated ? <CheckCircle size={14} /> : <XCircle size={14} />}
            {validated ? "Key is valid" : "Key validation failed"}
          </div>
        )}

        <p className="text-xs text-stone-600 mt-1.5 flex items-center gap-1">
          <AlertCircle size={11} />
          The key is encrypted before storage and never returned to this interface
        </p>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-stone-950 font-semibold rounded-lg transition-colors text-sm"
      >
        {saving ? "Saving..." : "Save Configuration"}
      </button>
    </form>
  );
}

function FileBrowser({ onSelect }: { onSelect: (path: string) => void }) {
  const [browse, setBrowse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function navigate(path?: string) {
    setLoading(true);
    setError(null);
    try {
      const result = await api.obsidian.browse(path);
      setBrowse(result);
    } catch (e: any) {
      setError("No se puede conectar con el backend. Verifica que está corriendo.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { navigate(); }, []);

  if (error) return (
    <div className="bg-red-950/30 border border-red-800 rounded-lg p-4 text-xs text-red-400">
      {error}
      <button onClick={() => navigate()} className="ml-2 underline hover:text-red-300">Reintentar</button>
    </div>
  );

  if (!browse && loading) return (
    <div className="bg-stone-950 border border-stone-700 rounded-lg p-4 text-xs text-stone-600 text-center">
      Cargando sistema de archivos...
    </div>
  );

  if (!browse) return null;

  return (
    <div className="bg-stone-950 border border-stone-700 rounded-lg overflow-hidden">
      {/* Quick access */}
      {browse.quickAccess?.length > 0 && (
        <div className="flex gap-1 px-3 py-2 border-b border-stone-800 overflow-x-auto">
          {browse.quickAccess.map((qa: any) => (
            <button
              key={qa.path}
              onClick={() => navigate(qa.path)}
              className="shrink-0 px-2 py-1 bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 rounded text-xs transition-colors"
            >
              {qa.name}
            </button>
          ))}
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-stone-800 overflow-x-auto">
        {browse.breadcrumb?.map((crumb: any, i: number) => (
          <span key={crumb.path + i} className="flex items-center gap-1 shrink-0">
            {i > 0 && <span className="text-stone-700">/</span>}
            <button
              onClick={() => navigate(crumb.path)}
              className="text-xs text-stone-400 hover:text-amber-400 transition-colors max-w-[120px] truncate"
            >
              {crumb.name}
            </button>
          </span>
        ))}
        {loading && <span className="text-xs text-stone-600 ml-2">...</span>}
      </div>

      {/* Current path + vault select */}
      <div className="px-3 py-2 border-b border-stone-800 flex items-center justify-between gap-2">
        <span className="text-xs text-stone-600 font-mono truncate flex-1">{browse.current}</span>
        {browse.isVault && (
          <button
            onClick={() => onSelect(browse.current)}
            className="shrink-0 px-3 py-1 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs rounded-lg transition-colors"
          >
            ✓ Seleccionar vault
          </button>
        )}
      </div>

      {/* Directory list */}
      <div className="max-h-56 overflow-y-auto">
        {browse.parent !== browse.current && (
          <button
            onClick={() => navigate(browse.parent)}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-stone-800 transition-colors text-left border-b border-stone-900"
          >
            <span className="text-stone-500">↑</span>
            <span className="text-xs text-stone-500">Carpeta anterior</span>
          </button>
        )}

        {browse.dirs?.length === 0 && (
          <p className="text-xs text-stone-600 px-3 py-4 text-center">Sin subcarpetas</p>
        )}

        {browse.dirs?.map((dir: any) => (
          <button
            key={dir.path}
            onClick={() => navigate(dir.path)}
            className={clsx(
              "w-full flex items-center gap-2 px-3 py-2 hover:bg-stone-800 transition-colors text-left",
              dir.isVault && "bg-amber-950/20 border-l-2 border-amber-700",
              dir.hidden && "opacity-60"
            )}
          >
            <span className="text-sm shrink-0">{dir.isVault ? "🗂" : "📁"}</span>
            <span className={clsx(
              "text-xs flex-1 truncate",
              dir.isVault ? "text-amber-400 font-semibold" : "text-stone-300"
            )}>
              {dir.name}
            </span>
            {dir.isVault && (
              <span className="text-xs text-amber-600 shrink-0 font-medium">vault</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function ObsidianSync() {
  const { activeCampaign } = useAppStore();
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [showBrowser, setShowBrowser] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [mapping, setMapping] = useState<Record<string, boolean>>({
    npc: true, session: true, faction: true, location: true, quest: true,
  });
  const [opResult, setOpResult] = useState<any>(null);

  useEffect(() => {
    api.obsidian.getConfig().then(({ vaultPath }) => {
      if (vaultPath) setSavedPath(vaultPath);
    }).catch(() => {});
  }, []);

  async function handleSelect(path: string) {
    setShowBrowser(false);
    setSaving(true);
    try {
      const result = await api.obsidian.verify(path);
      setVerifyResult(result);
      if (result.valid) {
        await api.obsidian.saveConfig(path);
        setSavedPath(path);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleScan() {
    setScanning(true);
    setScanResult(null);
    try {
      const result = await api.obsidian.scan();
      setScanResult(result);
      // Pre-check mapping based on detected groups
      const newMapping: Record<string, boolean> = {};
      result.groups.forEach((g: any) => { newMapping[g.type] = g.confidence !== "low"; });
      setMapping(prev => ({ ...prev, ...newMapping }));
    } catch (e: any) {
      setOpResult({ type: "error", message: e.message });
    } finally {
      setScanning(false);
    }
  }

  async function handleImport() {
    if (!activeCampaign) return;
    setImporting(true);
    setOpResult(null);
    try {
      const result = await api.obsidian.import(activeCampaign.id, mapping);
      setOpResult({ type: "import", data: result });
      setScanResult(null);
    } catch (e: any) {
      setOpResult({ type: "error", message: e.message });
    } finally {
      setImporting(false);
    }
  }

  async function handleExport() {
    if (!activeCampaign) return;
    setExporting(true);
    setOpResult(null);
    try {
      const result = await api.obsidian.export(activeCampaign.id);
      setOpResult({ type: "export", data: result });
    } catch (e: any) {
      setOpResult({ type: "error", message: e.message });
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold text-stone-400 uppercase tracking-wider mb-4">
        Obsidian Vault
      </h2>
      <div className="border border-stone-800 bg-stone-900 rounded-xl p-5 space-y-4">

        {/* Current vault */}
        {savedPath ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-stone-500 mb-0.5">Vault configurado</p>
              <p className="text-sm text-amber-400 font-mono">{savedPath}</p>
              {verifyResult && (
                <div className="flex gap-3 mt-1 text-xs text-stone-600">
                  <span>{verifyResult.hasPeople ? "✓" : "✗"} People</span>
                  <span>{verifyResult.hasJournals ? "✓" : "✗"} Journals</span>
                  <span>{verifyResult.hasTemplates ? "✓" : "✗"} Templates</span>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowBrowser(!showBrowser)}
              className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-400 rounded-lg text-xs transition-colors"
            >
              Cambiar
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-stone-400 mb-3">
              Selecciona tu vault de Obsidian para sincronizar campañas, NPCs y sesiones.
            </p>
            <button
              onClick={() => setShowBrowser(!showBrowser)}
              className="w-full px-4 py-3 bg-stone-800 hover:bg-stone-700 border border-dashed border-stone-600 text-stone-400 rounded-lg text-sm transition-colors"
            >
              📁 Explorar y seleccionar vault...
            </button>
          </div>
        )}

        {/* File browser */}
        {showBrowser && <FileBrowser onSelect={handleSelect} />}
        {saving && <p className="text-xs text-amber-500">Verificando y guardando...</p>}

        {/* Sync actions */}
        {savedPath && activeCampaign && !showBrowser && (
          <div className="border-t border-stone-800 pt-4 space-y-3">
            <p className="text-xs text-stone-500">
              Campaña: <span className="text-amber-400">{activeCampaign.title}</span>
            </p>

            {/* Scan step */}
            {!scanResult && !opResult && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleScan}
                  disabled={scanning || exporting}
                  className="px-4 py-3 bg-stone-800 hover:bg-stone-700 border border-stone-700 disabled:opacity-50 text-stone-300 rounded-lg text-sm transition-colors"
                >
                  {scanning ? "Analizando..." : "⬇ Analizar vault"}
                </button>
                <button
                  onClick={handleExport}
                  disabled={scanning || exporting}
                  className="px-4 py-3 bg-stone-800 hover:bg-stone-700 border border-stone-700 disabled:opacity-50 text-stone-300 rounded-lg text-sm transition-colors"
                >
                  {exporting ? "Exportando..." : "⬆ Asistente → Vault"}
                </button>
              </div>
            )}

            {/* Scan result + mapping */}
            {scanResult && !opResult && (
              <div className="space-y-3">
                <div className="bg-stone-800 border border-stone-700 rounded-lg p-3">
                  <p className="text-xs text-stone-400 font-medium mb-2">
                    {scanResult.totalNotes} notas encontradas — selecciona qué importar:
                  </p>
                  <div className="space-y-2">
                    {scanResult.groups.map((g: any) => (
                      g.type !== "unknown" && (
                        <label key={g.type} className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={mapping[g.type] ?? true}
                            onChange={(e) => setMapping(m => ({ ...m, [g.type]: e.target.checked }))}
                            className="mt-0.5 accent-amber-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-stone-300 capitalize">{g.type}s</span>
                              <span className="text-xs text-stone-600">({g.count} notas)</span>
                              <span className={clsx("text-xs px-1.5 py-0.5 rounded",
                                g.confidence === "high" ? "bg-emerald-900 text-emerald-400" :
                                g.confidence === "medium" ? "bg-amber-900 text-amber-400" :
                                "bg-stone-700 text-stone-400"
                              )}>{g.confidence}</span>
                            </div>
                            <p className="text-xs text-stone-600 truncate">
                              {g.sampleNames.join(", ")}
                            </p>
                          </div>
                        </label>
                      )
                    ))}
                    {scanResult.groups.filter((g: any) => g.type === "unknown").map((g: any) => (
                      <p key="unknown" className="text-xs text-stone-600">
                        {g.count} notas sin clasificar (no se importarán)
                      </p>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setScanResult(null)}
                    className="px-3 py-2 border border-stone-700 text-stone-500 rounded-lg text-xs hover:border-stone-500 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-stone-950 font-semibold rounded-lg text-sm transition-colors"
                  >
                    {importing ? "Importando..." : "Importar seleccionados"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {!activeCampaign && savedPath && (
          <p className="text-xs text-amber-600">Selecciona una campaña para sincronizar.</p>
        )}

        {opResult && opResult.type !== "error" && (
          <div className="bg-stone-800 border border-stone-700 rounded-lg p-3 text-xs space-y-1">
            <p className="text-stone-300 font-medium">
              {opResult.type === "import" ? "✓ Importación completada" : "✓ Exportación completada"}
            </p>
            {Object.entries(opResult.data).map(([entity, res]: [string, any]) => (
              <p key={entity} className="text-stone-500">
                {entity}: {(res as any).imported ?? (res as any).exported ?? 0} procesados
                {(res as any).skipped ? `, ${(res as any).skipped} omitidos` : ""}
                {(res as any).errors?.length ? `, ${(res as any).errors.length} errores` : ""}
              </p>
            ))}
            <button onClick={() => { setOpResult(null); setScanResult(null); }}
              className="text-stone-600 hover:text-stone-400 text-xs underline mt-1">
              Nueva sincronización
            </button>
          </div>
        )}

        {opResult?.type === "error" && (
          <p className="text-red-400 text-xs">{opResult.message}</p>
        )}
      </div>
    </section>
  );
}

function SrdStatus() {
  const [importing, setImporting] = useState(false);
  const { data, mutate: refetch } = useSWR("/srd-status", () => api.srd.status());

  async function handleImport(force = false) {
    setImporting(true);
    try {
      await api.srd.import(force);
      // Poll for completion
      setTimeout(() => { refetch(); setImporting(false); }, 4000);
    } catch {
      setImporting(false);
    }
  }

  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold text-stone-400 uppercase tracking-wider mb-4">
        SRD 5.2.1 — D&D 2024
      </h2>
      <div className="border border-stone-800 bg-stone-900 rounded-xl p-5 space-y-3">
        {!data && (
          <p className="text-xs text-stone-600">Loading SRD status...</p>
        )}
        {data && (
          <>
            {data.documents.length === 0 ? (
              <p className="text-xs text-stone-500">
                No hay reglas indexadas. Ve a Settings para importar el SRD.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-stone-300">
                      {data.fullyImported ? (
                        <span className="text-emerald-400">✓ SRD 5.2.1 importado ({data.totalDocuments} secciones)</span>
                      ) : (
                        <span className="text-amber-400">⚠ SRD no importado ({data.totalDocuments}/8 secciones)</span>
                      )}
                    </p>
                    <p className="text-xs text-stone-600 mt-0.5">
                      {data.embeddedChunks.toLocaleString()} / {data.totalChunks.toLocaleString()} chunks embedidos · {data.coverage}% cobertura
                    </p>
                    <p className="text-xs text-stone-700 mt-0.5">
                      CC-BY-4.0 · <a href="https://www.dndbeyond.com/srd" target="_blank" className="underline hover:text-stone-500">dndbeyond.com/srd</a>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {!data.fullyImported && (
                      <button
                        onClick={() => handleImport(false)}
                        disabled={importing}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-stone-950 font-semibold rounded-lg text-xs transition-colors"
                      >
                        {importing ? "Importando..." : "Importar SRD"}
                      </button>
                    )}
                    {data.fullyImported && (
                      <button
                        onClick={() => handleImport(true)}
                        disabled={importing}
                        className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 border border-stone-700 disabled:opacity-50 text-stone-400 rounded-lg text-xs transition-colors"
                      >
                        {importing ? "Reimportando..." : "Reimportar"}
                      </button>
                    )}
                  </div>
                </div>

                <div className="border-t border-stone-800 pt-3 space-y-1.5">
                  {data.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between text-xs">
                      <span className="text-stone-500 truncate">{doc.title}</span>
                      <span className="text-stone-600 shrink-0 ml-2">
                        {doc.isIndexed
                          ? `${doc.embeddedChunks} / ${doc.chunkCount} chunks`
                          : "pendiente"}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}

const AUTHORITY_LABELS: Record<string, { label: string; cls: string }> = {
  high: { label: "high", cls: "bg-emerald-900 text-emerald-400" },
  medium: { label: "medium", cls: "bg-amber-900 text-amber-400" },
  low: { label: "low", cls: "bg-stone-700 text-stone-400" },
};

function CustomRulesStatus() {
  const { data, mutate: refetch } = useSWR("/custom-rules-status", () => api.srd.customRules());
  const [reindexing, setReindexing] = useState<string | null>(null);

  if (!data || data.documents.length === 0) return null;

  async function handleReindex(id: string) {
    setReindexing(id);
    try {
      await api.documents.reindex(id);
      setTimeout(() => { refetch(); setReindexing(null); }, 2000);
    } catch {
      setReindexing(null);
    }
  }

  const { totalChunks, embeddedChunks, coverage } = data;

  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold text-stone-400 uppercase tracking-wider mb-4">
        Reglas adicionales
      </h2>
      <div className="border border-stone-800 bg-stone-900 rounded-xl p-5 space-y-3">
        <div>
          <p className="text-sm text-stone-300">
            {data.totalDocuments} documento{data.totalDocuments !== 1 ? "s" : ""} adicional{data.totalDocuments !== 1 ? "es" : ""}
          </p>
          <p className="text-xs text-stone-600 mt-0.5">
            {embeddedChunks.toLocaleString()} / {totalChunks.toLocaleString()} chunks embedidos · {coverage}% cobertura
          </p>
        </div>
        <div className="border-t border-stone-800 pt-3 space-y-2">
          {data.documents.map((doc) => {
            const auth = AUTHORITY_LABELS[doc.authorityLevel] ?? AUTHORITY_LABELS["low"]!;
            return (
              <div key={doc.id} className="flex items-center justify-between text-xs gap-2">
                <span className="text-stone-400 truncate flex-1">{doc.title}</span>
                <span className={clsx("shrink-0 px-1.5 py-0.5 rounded text-xs", auth.cls)}>
                  {auth.label}
                </span>
                {doc.isIndexed ? (
                  <span className="text-stone-600 shrink-0">
                    {doc.embeddedChunks} / {doc.chunkCount} chunks
                  </span>
                ) : (
                  <button
                    onClick={() => handleReindex(doc.id)}
                    disabled={reindexing === doc.id}
                    className="shrink-0 px-2 py-0.5 bg-stone-800 hover:bg-stone-700 border border-stone-700 disabled:opacity-50 text-stone-400 rounded text-xs transition-colors"
                  >
                    {reindexing === doc.id ? "Indexando..." : "Reindexar"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function EmbeddingStatus() {
  const [embedding, setEmbedding] = useState(false);
  const { data, mutate: refetch } = useSWR("/embedding-status", () => api.embeddings.status());

  async function handleEmbedAll() {
    setEmbedding(true);
    try {
      await api.embeddings.embedAll();
      refetch();
    } finally {
      setEmbedding(false);
    }
  }

  if (!data) return null;
  const pct = data.coverage;

  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold text-stone-400 uppercase tracking-wider mb-4">
        Semantic Search Index
      </h2>
      <div className="border border-stone-800 bg-stone-900 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-stone-400">Embedding coverage</span>
          <span className="font-mono text-amber-400">{pct}%</span>
        </div>
        <div className="w-full bg-stone-800 rounded-full h-2">
          <div
            className="bg-amber-600 h-2 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex gap-4 text-xs text-stone-500">
          <span>{data.embeddedChunks.toLocaleString()} embedded</span>
          <span>{data.pendingChunks.toLocaleString()} pending</span>
          <span>{data.totalChunks.toLocaleString()} total</span>
        </div>
        {data.pendingChunks > 0 && (
          <button
            onClick={handleEmbedAll}
            disabled={embedding}
            className="w-full px-4 py-2 bg-stone-800 hover:bg-stone-700 border border-stone-700 disabled:opacity-50 text-stone-300 rounded-lg text-sm transition-colors"
          >
            {embedding ? "Embedding... (may take a while)" : `Embed ${data.pendingChunks} pending chunks`}
          </button>
        )}
        {data.pendingChunks === 0 && data.totalChunks > 0 && (
          <p className="text-xs text-emerald-600">✓ All chunks embedded — semantic search is active</p>
        )}
        {data.totalChunks === 0 && (
          <p className="text-xs text-stone-600">Upload documents to enable semantic search</p>
        )}
      </div>
    </section>
  );
}


export default function SettingsPage() {
  const { data: configs, isLoading } = useSWR("/llm-config", () => api.llmConfig.list());

  return (
    <AppShell>
      <div className="p-8 max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-8">
          <Settings size={20} className="text-amber-400" />
          <h1 className="text-2xl font-bold text-stone-100">Settings</h1>
        </div>

        <section className="mb-8">
          <h2 className="text-sm font-semibold text-stone-400 uppercase tracking-wider mb-4">
            AI Provider
          </h2>

          {isLoading && (
            <div className="space-y-3 mb-4">
              <div className="h-16 bg-stone-900 rounded-lg animate-pulse border border-stone-800" />
            </div>
          )}

          {configs && configs.length > 0 && (
            <div className="space-y-3 mb-6">
              {configs.map((c) => <ProviderCard key={c.id} config={c} />)}
            </div>
          )}

          <AddProviderForm onSaved={() => mutate("/llm-config")} />
        </section>

        <ObsidianSync />
        <SrdStatus />
        <CustomRulesStatus />
        <EmbeddingStatus />
        <section>
          <h2 className="text-sm font-semibold text-stone-400 uppercase tracking-wider mb-4">
            About
          </h2>
          <div className="border border-stone-800 bg-stone-900 rounded-lg p-4 space-y-2 text-sm text-stone-400">
            <p>D&D Campaign Assistant — v0.1.0</p>
            <p>All data is stored locally. API keys are encrypted with AES-256-GCM.</p>
            <p>The AI is an assistant layer — not the source of truth.</p>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
