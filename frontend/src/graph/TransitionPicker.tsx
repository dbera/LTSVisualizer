import {
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  filterTransitionOptions,
  type TransitionOption,
} from "./transitionCatalog";

type Props = {
  label: string;
  value: string;
  options: readonly TransitionOption[];
  disabled: boolean;
  onChange: (value: string) => void;
};

export default function TransitionPicker({
  label,
  value,
  options,
  disabled,
  onChange,
}: Props) {
  const inputId = useId();
  const listboxId = useId();
  const closeTimer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const matches = useMemo(
    () => filterTransitionOptions(options, value),
    [options, value],
  );

  function openList() {
    if (disabled) return;
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    setOpen(true);
    setActiveIndex(0);
  }

  function select(name: string) {
    onChange(name);
    setOpen(false);
    setActiveIndex(0);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) openList();
      else setActiveIndex((index) => Math.min(matches.length - 1, index + 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) openList();
      else setActiveIndex((index) => Math.max(0, index - 1));
      return;
    }
    if (event.key === "Enter" && open && matches[activeIndex]) {
      event.preventDefault();
      select(matches[activeIndex].name);
    }
  }

  return (
    <label className="transition-picker-label" htmlFor={inputId}>
      {label}
      <span className="transition-picker">
        <input
          id={inputId}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={
            open && matches[activeIndex]
              ? `${listboxId}-option-${activeIndex}`
              : undefined
          }
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            openList();
          }}
          onFocus={openList}
          onClick={openList}
          onBlur={() => {
            closeTimer.current = window.setTimeout(() => setOpen(false), 120);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type to search graph transitions"
          disabled={disabled}
        />
        {open && (
          <span id={listboxId} className="transition-picker-list" role="listbox">
            {matches.length === 0 ? (
              <span className="transition-picker-empty">No graph transition matches. Manual entry is allowed.</span>
            ) : (
              matches.map((option, index) => (
                <button
                  id={`${listboxId}-option-${index}`}
                  key={option.name}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  className={index === activeIndex ? "active" : ""}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => select(option.name)}
                >
                  <span>{option.name}</span>
                  <small>{option.occurrenceCount} occurrence{option.occurrenceCount === 1 ? "" : "s"}</small>
                </button>
              ))
            )}
          </span>
        )}
      </span>
    </label>
  );
}
