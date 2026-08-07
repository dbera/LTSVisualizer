import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import {
  getTransitionDataFields,
  type TransitionDataCatalogue,
  type TransitionDataField,
} from "./transitionDataCatalogue";

type Props = {
  catalogue: TransitionDataCatalogue;
  transitionName: string;
  disabled?: boolean;
  label?: string;
  selectedField?: TransitionDataField | null;
  onSelect?: (field: TransitionDataField) => void;
};

const MAX_VISIBLE_OPTIONS = 100;

function searchText(field: TransitionDataField): string {
  return [
    field.displayPath,
    field.source,
    ...field.valueTypes,
  ]
    .join(" ")
    .toLocaleLowerCase();
}

export default function TransitionDataFieldPicker({
  catalogue,
  transitionName,
  disabled = false,
  label = "Available data fields",
  selectedField: controlledSelectedField,
  onSelect,
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [internalSelectedField, setInternalSelectedField] =
    useState<TransitionDataField | null>(null);
  const selectedField = controlledSelectedField === undefined
    ? internalSelectedField
    : controlledSelectedField;
  const containerRef = useRef<HTMLDivElement | null>(null);

  const availableFields = useMemo(
    () => getTransitionDataFields(catalogue, transitionName),
    [catalogue, transitionName],
  );

  const filteredFields = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const matches = normalizedQuery
      ? availableFields.filter((field) =>
          searchText(field).includes(normalizedQuery),
        )
      : [...availableFields];

    return matches.slice(0, MAX_VISIBLE_OPTIONS);
  }, [availableFields, query]);

  useEffect(() => {
    setQuery("");
    setOpen(false);
    setActiveIndex(0);
    setInternalSelectedField(null);
  }, [transitionName, catalogue]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function select(field: TransitionDataField) {
    setInternalSelectedField(field);
    onSelect?.(field);
    setQuery(field.displayPath);
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) =>
        Math.min(index + 1, Math.max(0, filteredFields.length - 1)),
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.max(0, index - 1));
      return;
    }

    if (event.key === "Enter" && open && filteredFields[activeIndex]) {
      event.preventDefault();
      select(filteredFields[activeIndex]);
    }
  }

  const usingGraphWideFallback =
    transitionName.length > 0 &&
    catalogue.fieldsByTransition[transitionName] === undefined;

  return (
    <div className="transition-data-browser">
      <label>
        {label}
        <div className="transition-data-picker" ref={containerRef}>
          <input
            type="text"
            value={query}
            placeholder={
              availableFields.length === 0
                ? "No structured data fields found"
                : "Search inputs and outputs"
            }
            disabled={disabled || availableFields.length === 0}
            autoComplete="off"
            aria-expanded={open}
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              setInternalSelectedField(null);
              setActiveIndex(0);
              setOpen(true);
            }}
            onKeyDown={handleKeyDown}
          />
          {open && !disabled && (
            <div className="transition-data-picker-list" role="listbox">
              {filteredFields.length === 0 ? (
                <div className="transition-picker-empty">
                  No data field matches this search.
                </div>
              ) : (
                filteredFields.map((field, index) => (
                  <button
                    key={`${field.source}-${JSON.stringify(field.path)}`}
                    type="button"
                    role="option"
                    aria-selected={selectedField?.displayPath === field.displayPath}
                    className={index === activeIndex ? "active" : ""}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => select(field)}
                  >
                    <span>{field.displayPath}</span>
                    <small>
                      {field.valueTypes.join(" | ")} · {field.occurrenceCount}
                      {" occurrence"}
                      {field.occurrenceCount === 1 ? "" : "s"}
                    </small>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </label>
      {usingGraphWideFallback && (
        <p className="transition-data-picker-note">
          This transition name is not in the loaded graph. Showing graph-wide
          data fields.
        </p>
      )}
      {selectedField && (
        <p className="transition-data-picker-selection">
          Selected field: <code>{selectedField.displayPath}</code>
        </p>
      )}
    </div>
  );
}
