interface SwitchProps {
  checked: boolean;
  className?: string;
}

/** Visual-only pill switch — wrap in a clickable element to toggle. */
export function Switch({ checked, className = "" }: SwitchProps) {
  return (
    <span
      role="switch"
      aria-checked={checked}
      className={[
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200",
        checked ? "bg-primary-500" : "bg-stone-200 dark:bg-white/[0.12]",
        className,
      ].join(" ")}
    >
      <span
        className={[
          "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200",
          checked ? "translate-x-[18px]" : "translate-x-[3px]",
        ].join(" ")}
      />
    </span>
  );
}
