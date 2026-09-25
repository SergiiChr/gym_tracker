import { formatWeight } from "../../model/units";
import { h, svg } from "../dom";
import { ICONS } from "../icons";

interface StepperOptions {
  value: number;
  step: number;
  /** Weights accept decimals and show the decimal keypad; reps are whole numbers. */
  decimal: boolean;
  label: string;
  onChange: (value: number) => void;
}

/** A number box with ▲ on the left and ▼ on the right, built into one control so it is easy to hit mid-set. */
export function stepper(options: StepperOptions): HTMLElement {
  const { step, decimal, label, onChange } = options;
  let current = options.value;
  const format = (v: number): string => (decimal ? formatWeight(v) : String(v));
  const set = (next: number): void => {
    current = Math.max(0, decimal ? Math.round(next * 100) / 100 : Math.round(next));
    input.value = format(current);
    onChange(current);
  };
  const input = h("input", {
    type: "text",
    inputMode: decimal ? "decimal" : "numeric",
    value: format(current),
    className: "stepper-value",
    ariaLabel: label,
    onfocus: () => input.select(),
    onchange: () => {
      const parsed = parseFloat(input.value.replace(",", "."));
      if (Number.isFinite(parsed)) set(parsed);
      else input.value = format(current);
    },
  });
  const button = (icon: string, delta: number): HTMLButtonElement =>
    h("button", { type: "button", className: "stepper-button", title: `${delta > 0 ? "+" : "−"}${format(step)}`, onclick: () => set(current + delta) }, svg(icon));
  return h("div", { className: `stepper ${decimal ? "stepper-weight" : "stepper-reps"}` }, button(ICONS.up, step), input, button(ICONS.down, -step));
}

/** Weight stepper followed by its unit. */
export function weightInput(value: number, step: number, unit: string, onChange: (value: number) => void): HTMLElement {
  return h(
    "div",
    { className: "weight-input" },
    stepper({ value, step, decimal: true, label: `Weight in ${unit}`, onChange }),
    h("span", { className: "weight-unit" }, unit),
  );
}
