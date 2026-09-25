import { formatWeight } from "../../model/units";
import { h } from "../dom";

function field(label: string, control: HTMLElement, tip: string): HTMLLIElement {
  return h("li", { className: "row", title: tip }, h("label", { className: "row-content field" }, h("span", { className: "row-title" }, label), control));
}

export function textRow(label: string, value: string, onChange: (value: string) => void, tip = ""): HTMLLIElement {
  const input = h("input", { type: "text", value, className: "field-input", onchange: () => onChange(input.value.trim() || value) });
  return field(label, input, tip);
}

interface NumberInputOptions {
  value: number;
  /** Decimals and the decimal keypad for weights; whole numbers otherwise. */
  decimal?: boolean;
  label?: string;
  className?: string;
  onChange: (value: number) => void;
}

/** Non-negative number input; shows the matching keypad on phones and reverts invalid input. */
export function numberInput(options: NumberInputOptions): HTMLInputElement {
  const { decimal = false, onChange } = options;
  let current = options.value;
  const format = (v: number): string => (decimal ? formatWeight(v) : String(v));
  const input = h("input", {
    type: "text",
    inputMode: decimal ? "decimal" : "numeric",
    value: format(current),
    className: options.className ?? "field-input number",
    ariaLabel: options.label ?? "",
    onfocus: () => input.select(),
    onchange: () => {
      const parsed = decimal ? parseFloat(input.value.replace(",", ".")) : parseInt(input.value, 10);
      if (Number.isFinite(parsed) && parsed >= 0) {
        current = decimal ? Math.round(parsed * 100) / 100 : parsed;
        onChange(current);
      }
      input.value = format(current);
    },
  });
  return input;
}

export function integerInput(value: number, onChange: (value: number) => void, className?: string): HTMLInputElement {
  return numberInput({ value, onChange, className });
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
