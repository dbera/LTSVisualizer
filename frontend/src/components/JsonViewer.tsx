import { useEffect, useState } from "react";
import "./JsonViewer.css";

type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

type ExpansionMode = "all" | "none" | "manual";

interface JsonViewerProps {
  value: JsonValue;
  label?: string;
}

interface JsonNodeProps {
  value: JsonValue;
  name?: string;
  depth: number;
  expansionMode: ExpansionMode;
  expansionRevision: number;
  isLast?: boolean;
}

function valueType(value: JsonValue): string {
  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return "array";
  }

  return typeof value;
}

function collectionSummary(value: JsonValue): string | null {
  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }

  if (value !== null && typeof value === "object") {
    const count = Object.keys(value).length;
    return `${count} ${count === 1 ? "key" : "keys"}`;
  }

  return null;
}

function JsonScalar({ value }: { value: JsonPrimitive }) {
  if (value === null) {
    return <span className="json-null">null</span>;
  }

  if (typeof value === "string") {
    return <span className="json-string">{JSON.stringify(value)}</span>;
  }

  if (typeof value === "number") {
    return <span className="json-number">{String(value)}</span>;
  }

  return <span className="json-boolean">{String(value)}</span>;
}

function JsonNode({
  value,
  name,
  depth,
  expansionMode,
  expansionRevision,
  isLast = true,
}: JsonNodeProps) {
  const isCollection = value !== null && typeof value === "object";
  const [expanded, setExpanded] = useState(depth < 2);

  useEffect(() => {
    if (expansionMode === "all") {
      setExpanded(true);
    } else if (expansionMode === "none") {
      setExpanded(false);
    }
  }, [expansionMode, expansionRevision]);

  const key = name !== undefined ? (
    <>
      <span className="json-key">{JSON.stringify(name)}</span>
      <span className="json-punctuation">: </span>
    </>
  ) : null;

  if (!isCollection) {
    return (
      <div className="json-row" style={{ paddingLeft: `${depth * 18}px` }}>
        <span className="json-toggle-spacer" aria-hidden="true" />
        {key}
        <JsonScalar value={value as JsonPrimitive} />
        {!isLast && <span className="json-punctuation">,</span>}
      </div>
    );
  }

  const entries: [string, JsonValue][] = Array.isArray(value)
    ? value.map((item, index) => [String(index), item])
    : Object.entries(value);
  const opening = Array.isArray(value) ? "[" : "{";
  const closing = Array.isArray(value) ? "]" : "}";
  const summary = collectionSummary(value);
  const empty = entries.length === 0;

  return (
    <div className="json-node">
      <div className="json-row" style={{ paddingLeft: `${depth * 18}px` }}>
        <button
          type="button"
          className="json-toggle"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Collapse" : "Expand"} ${name ?? valueType(value)}`}
          disabled={empty}
        >
          {empty ? "·" : expanded ? "▾" : "▸"}
        </button>
        {key}
        <span className="json-punctuation">{opening}</span>
        {!expanded && !empty && (
          <>
            <span className="json-collapsed"> … </span>
            <span className="json-punctuation">{closing}</span>
          </>
        )}
        {empty && <span className="json-punctuation">{closing}</span>}
        {!expanded && summary && (
          <span className="json-summary"> {summary}</span>
        )}
        {empty && <span className="json-empty"> empty</span>}
        {((!expanded && !empty) || empty) && !isLast && (
          <span className="json-punctuation">,</span>
        )}
      </div>

      {expanded && !empty && (
        <>
          {entries.map(([entryName, entryValue], index) => (
            <JsonNode
              key={`${entryName}-${index}`}
              name={Array.isArray(value) ? undefined : entryName}
              value={entryValue}
              depth={depth + 1}
              expansionMode={expansionMode}
              expansionRevision={expansionRevision}
              isLast={index === entries.length - 1}
            />
          ))}
          <div className="json-row" style={{ paddingLeft: `${depth * 18}px` }}>
            <span className="json-toggle-spacer" aria-hidden="true" />
            <span className="json-punctuation">{closing}</span>
            {!isLast && <span className="json-punctuation">,</span>}
          </div>
        </>
      )}
    </div>
  );
}

export default function JsonViewer({ value, label = "JSON data" }: JsonViewerProps) {
  const [expansionMode, setExpansionMode] = useState<ExpansionMode>("manual");
  const [expansionRevision, setExpansionRevision] = useState(0);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle"
  );

  function applyExpansion(mode: Exclude<ExpansionMode, "manual">) {
    setExpansionMode(mode);
    setExpansionRevision((revision) => revision + 1);
  }

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }

    window.setTimeout(() => setCopyStatus("idle"), 1800);
  }

  return (
    <section className="json-viewer" aria-label={label}>
      <div className="json-toolbar">
        <div className="json-toolbar-group">
          <button type="button" onClick={() => applyExpansion("all")}>
            Expand all
          </button>
          <button type="button" onClick={() => applyExpansion("none")}>
            Collapse all
          </button>
        </div>

        <button type="button" onClick={copyJson}>
          {copyStatus === "copied"
            ? "Copied"
            : copyStatus === "failed"
              ? "Copy failed"
              : "Copy JSON"}
        </button>
      </div>

      <div className="json-content">
        <JsonNode
          value={value}
          depth={0}
          expansionMode={expansionMode}
          expansionRevision={expansionRevision}
        />
      </div>
    </section>
  );
}
