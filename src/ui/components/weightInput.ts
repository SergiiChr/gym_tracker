import { formatWeight } from "../../model/units";
import { h, svg } from "../dom";
import { ICONS } from "../icons";

/** Decimal keypad input with ▼/▲ buttons that move by one plate step. */
export function weightInput(value: number, step: number, unit: string, onChange: (value: number) => void): HTMLElement {
  let current = value;
  const set = (next: number): void => {
    current = Math.max(0, Math.round(next * 100) / 100);
    input.value = formatWeight(current);
    onChange(current);
  };
  const input = h("input", {
    type: "text",
    inputMode: "decimal",
    value: formatWeight(value),
    className: "weight-value",
    ariaLabel: `Weight in ${unit}`,
    onfocus: () => input.select(),
    onchange: () => {
      const parsed = parseFloat(input.value.replace(",", "."));
      if (Number.isFinite(parsed)) set(parsed);
      else input.value = formatWeight(current);
    },
  });
  const stepButton = (icon: string, delta: number, tip: string): HTMLButtonElement =>
    h("button", { type: "button", className: "step-button", title: tip, onclick: () => set(current + delta) }, svg(icon));
  return h(
    "div",
    { className: "weight-input" },
    stepButton(ICONS.down, -step, `−${formatWeight(step)} ${unit}`),
    input,
    stepButton(ICONS.up, step, `+${formatWeight(step)} ${unit}`),
    h("span", { className: "weight-unit" }, unit),
  );
}
