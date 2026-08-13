import type { DeclareConstraint } from "./declareConstraints";
import type { ComparisonOperator, DataPathSegment } from "./transitionConditions";
import FixedIndexTraversalEditor from "./FixedIndexTraversalEditor";
import TransitionDataFieldPicker from "./TransitionDataFieldPicker";
import { createDefaultArrayAccesses, formatConfiguredPath, materializeIndexedPath, normalizeIndexedPathForEditing } from "./transitionConditionEditorModel";
import type { CaptureDefinition, CorrelationCondition } from "./transitionCorrelation";
import type { TransitionDataCatalogue, TransitionDataField } from "./transitionDataCatalogue";

type Props = { constraint: DeclareConstraint; activationTransitionName: string; targetTransitionName: string; catalogue: TransitionDataCatalogue; disabled: boolean; onChange: (constraint: DeclareConstraint) => void };
const OPERATORS: readonly Exclude<ComparisonOperator, "exists" | "does-not-exist">[] = ["=", "!=", "<", "<=", ">", ">="];
const captures = (constraint: DeclareConstraint): CaptureDefinition[] => constraint.activation?.predicates[0]?.captures ?? [];
const stableKey = (capture: CaptureDefinition) => capture.id ?? capture.alias;
function nextAliasId(existing: readonly CaptureDefinition[]) { let n = existing.length + 1; while (existing.some((c) => stableKey(c) === `alias_${n}`)) n += 1; return `alias_${n}`; }
function updateCaptures(constraint: DeclareConstraint, next: CaptureDefinition[]): DeclareConstraint {
  const activation = constraint.activation;
  if (!activation || activation.predicates.length === 0) return constraint;
  const first = activation.predicates[0];
  return { ...constraint, activation: { ...activation, predicates: [{ ...first, ...(next.length ? { captures: next } : { captures: undefined }) }, ...activation.predicates.slice(1)] } };
}
function simpleCorrelation(condition: CorrelationCondition | undefined): Extract<CorrelationCondition, { type: "comparison" }> | null {
  return condition?.type === "comparison" && condition.left.kind === "target" && condition.right.kind === "activation" ? condition : null;
}
function fieldFor(catalogue: TransitionDataCatalogue, transitionName: string, source: "inputs" | "outputs", path: readonly DataPathSegment[]): TransitionDataField | null {
  const normalizedPath = normalizeIndexedPathForEditing(path).path;
  const fields = catalogue.fieldsByTransition[transitionName] ?? catalogue.allFields;
  return fields.find((field) => field.source === source && JSON.stringify(field.path) === JSON.stringify(normalizedPath)) ?? null;
}
function isScalarField(field: TransitionDataField) { return field.valueTypes.every((t) => ["string", "number", "boolean", "null"].includes(t)); }
function concretePath(field: TransitionDataField): DataPathSegment[] { return materializeIndexedPath(field.path, createDefaultArrayAccesses(field.path).map(() => ({ mode: "indexed-item" as const, index: 0 }))); }
function displayConcrete(source: "inputs" | "outputs", path: readonly DataPathSegment[]) { const normalized = normalizeIndexedPathForEditing(path); return formatConfiguredPath(source, normalized.path, normalized.arrayAccesses); }

export default function CorrelationAliasEditor({ constraint, activationTransitionName, targetTransitionName, catalogue, disabled, onChange }: Props) {
  const aliases = captures(constraint);
  const correlation = simpleCorrelation(constraint.correlation);
  const selectedTargetField = correlation?.left.kind === "target" ? fieldFor(catalogue, targetTransitionName, correlation.left.source, correlation.left.path) : null;
  const selectedAliasKey = correlation?.right.kind === "activation" ? correlation.right.aliasId ?? correlation.right.alias ?? "" : "";
  function changeAlias(index: number, change: Partial<CaptureDefinition>) { onChange(updateCaptures(constraint, aliases.map((c, i) => i === index ? { ...c, ...change } : c))); }
  function setSimpleCorrelation(field: TransitionDataField, aliasKey: string, operator: typeof OPERATORS[number] = "=", path = concretePath(field)) {
    onChange({ ...constraint, correlation: { type: "comparison", left: { kind: "target", source: field.source, path }, operator, right: { kind: "activation", aliasId: aliasKey } } });
  }
  return <section className="correlation-alias-editor">
    <div className="correlation-alias-heading"><div><strong>Correlation aliases</strong><span>Bind one scalar activation value at fixed array indexes and compare target data with it.</span></div><button type="button" disabled={disabled} onClick={() => { const id = nextAliasId(aliases); onChange(updateCaptures(constraint, [...aliases, { id, alias: id, source: "inputs", path: [] }])); }}>Add alias</button></div>
    {aliases.length === 0 ? <p className="correlation-alias-empty">No aliases. Add one to correlate a target with activation data.</p> : <div className="correlation-alias-list">{aliases.map((capture, index) => {
      const selected = fieldFor(catalogue, activationTransitionName, capture.source, capture.path);
      return <div className="correlation-alias-row" key={stableKey(capture)}>
        <label>Alias name<input value={capture.alias} disabled={disabled} onChange={(e) => changeAlias(index, { alias: e.target.value })} /></label>
        <TransitionDataFieldPicker catalogue={catalogue} transitionName={activationTransitionName} selectedField={selected} disabled={disabled} label="Activation source field" onSelect={(field) => { if (isScalarField(field)) changeAlias(index, { source: field.source, path: concretePath(field) }); }} />
        {selected && <FixedIndexTraversalEditor source={capture.source} cataloguePath={selected.path} executablePath={capture.path} disabled={disabled} onChange={(path) => changeAlias(index, { path })} />}
        {selected && <p className="correlation-summary">Selected scalar path: <code>{displayConcrete(capture.source, capture.path)}</code></p>}
        {selected && !isScalarField(selected) && <p className="correlation-alias-warning">Choose a field observed only as string, number, boolean, or null.</p>}
        <button type="button" className="correlation-alias-remove" disabled={disabled} onClick={() => { const removed = stableKey(capture); const next = updateCaptures(constraint, aliases.filter((_, i) => i !== index)); const referenced = selectedAliasKey === removed; onChange({ ...next, ...(referenced ? { correlation: undefined } : {}) }); }}>Remove alias</button>
      </div>;
    })}</div>}
    {aliases.length > 0 && <div className="correlation-target-editor"><strong>Target matching condition</strong>
      <TransitionDataFieldPicker catalogue={catalogue} transitionName={targetTransitionName} selectedField={selectedTargetField} disabled={disabled} label="Target field" onSelect={(field) => { if (isScalarField(field)) setSimpleCorrelation(field, selectedAliasKey || stableKey(aliases[0])); }} />
      {correlation && selectedTargetField && correlation.left.kind === "target" && <FixedIndexTraversalEditor source={correlation.left.source} cataloguePath={selectedTargetField.path} executablePath={correlation.left.path} disabled={disabled} onChange={(path) => setSimpleCorrelation(selectedTargetField, selectedAliasKey || stableKey(aliases[0]), correlation.operator, path)} />}
      <div className="correlation-target-controls"><label>Operator<select disabled={disabled || !correlation} value={correlation?.operator ?? "="} onChange={(e) => selectedTargetField && setSimpleCorrelation(selectedTargetField, selectedAliasKey || stableKey(aliases[0]), e.target.value as typeof OPERATORS[number], correlation?.left.kind === "target" ? correlation.left.path : undefined)}>{OPERATORS.map((op) => <option key={op} value={op}>{op}</option>)}</select></label>
      <label>Activation alias<select disabled={disabled || !selectedTargetField} value={selectedAliasKey || stableKey(aliases[0])} onChange={(e) => selectedTargetField && setSimpleCorrelation(selectedTargetField, e.target.value, correlation?.operator ?? "=", correlation?.left.kind === "target" ? correlation.left.path : undefined)}>{aliases.map((c) => <option key={stableKey(c)} value={stableKey(c)}>{c.alias}</option>)}</select></label>
      <button type="button" disabled={disabled || !constraint.correlation} onClick={() => onChange({ ...constraint, correlation: undefined })}>Clear match</button></div>
      {correlation && correlation.left.kind === "target" && <p className="correlation-summary"><code>{displayConcrete(correlation.left.source, correlation.left.path)}</code> {correlation.operator} activation alias <code>{aliases.find((c) => stableKey(c) === selectedAliasKey)?.alias ?? selectedAliasKey}</code></p>}
    </div>}
  </section>;
}
