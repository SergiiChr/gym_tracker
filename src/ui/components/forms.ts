import { h } from "../dom";

function field(label: string, control: HTMLElement, tip: string): HTMLLIElement {
  return h("li", { className: "row", title: tip }, h("label", { className: "row-content field" }, h("span", { className: "row-title" }, label), control));
}

export function textRow(label: string, value: string, onChange: (value: string) => void, tip = ""): HTMLLIElement {
  const input = h("input", { type: "text", value, className: "field-input", onchange: () => onChange(input.value.trim() || value) });
  return field(label, input, tip);
}

/** Non-negative integer input; shows the numeric keypad on phones and reverts invalid input. */
export function integerInput(value: number, onChange: (value: number) => void, className = "field-input number"): HTMLInputElement {
  const input = h("input", {
    type: "text",
    inputMode: "numeric",
    pattern: "[0-9]*",
    value: String(value),
    className,
    onfocus: () => input.select(),
    onchange: () => {
      const parsed = parseInt(input.value, 10);
      if (Number.isFinite(parsed) && parsed >= 0) onChange((value = parsed));
      else input.value = String(value);
    },
  });
  return input;
}

export function numberRow(label: string, value: number, onChange: (value: number) => void, tip = ""): HTMLLIElement {
  return field(label, integerInput(value, onChange), tip);
}

/** Checkbox styled as an iOS switch. */
export function toggleRow(label: string, checked: boolean, onChange: (checked: boolean) => void, tip = ""): HTMLLIElement {
  const input = h("input", { type: "checkbox", className: "switch", checked, onchange: () => onChange(input.checked) });
  return field(label, input, tip);
}

export function selectRow<T extends string | number>(
  label: string,
  options: { value: T; label: string }[],
  value: T,
  onChange: (value: T) => void,
  tip = "",
): HTMLLIElement {
  const select = h(
    "select",
    { className: "field-input", onchange: () => onChange(options[select.selectedIndex]!.value) },
    ...options.map((o) => h("option", { value: String(o.value), selected: o.value === value }, o.label)),
  );
  return field(label, select, tip);
}

/** iOS segmented control built from plain buttons. */
export function segmented<T extends string>(options: { value: T; label: string }[], value: T, onChange: (value: T) => void): HTMLElement {
  return h(
    "div",
    { className: "segmented", role: "radiogroup" },
    ...options.map((o) =>
      h("button", { type: "button", className: o.value === value ? "selected" : "", role: "radio", ariaChecked: String(o.value === value), onclick: () => onChange(o.value) }, o.label),
    ),
  );
}

export function segmentedRow<T extends string>(options: { value: T; label: string }[], value: T, onChange: (value: T) => void, tip = ""): HTMLLIElement {
  return h("li", { className: "row", title: tip }, h("div", { className: "row-content" }, segmented(options, value, onChange)));
}
