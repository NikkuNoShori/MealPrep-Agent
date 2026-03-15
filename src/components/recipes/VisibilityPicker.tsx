import React, { useState, useRef, useEffect } from "react";
import { Lock, Home, Globe } from "lucide-react";

export type RecipeVisibility = "private" | "household" | "public";

interface VisibilityPickerProps {
  value: RecipeVisibility;
  onChange: (visibility: RecipeVisibility) => void;
  disabled?: boolean;
  size?: "sm" | "default";
}

const options: { value: RecipeVisibility; label: string; icon: React.ElementType; description: string }[] = [
  { value: "private", label: "Only Me", icon: Lock, description: "Only you can see this recipe" },
  { value: "household", label: "Household", icon: Home, description: "Visible to your household members" },
  { value: "public", label: "Public", icon: Globe, description: "Visible to everyone" },
];

export function VisibilityPicker({ value, onChange, disabled = false, size = "default" }: VisibilityPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isSmall = size === "sm";

  const selected = options.find((o) => o.value === value) || options[0];
  const SelectedIcon = selected.icon;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`
          inline-flex items-center gap-1.5 rounded-lg border border-border/60
          bg-background/80 backdrop-blur-sm shadow-sm
          ${isSmall ? 'h-8 px-2.5 text-xs' : 'h-9 px-3 text-sm'}
          transition-all duration-200 ease-out
          hover:border-[#1D9E75]/40 hover:text-[#1D9E75] dark:hover:text-[#34d399]
          active:scale-[0.97]
          ${isOpen ? 'border-[#1D9E75]/50 shadow-md ring-1 ring-[#1D9E75]/20' : ''}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <SelectedIcon className={`${isSmall ? 'h-3 w-3' : 'h-3.5 w-3.5'} text-muted-foreground transition-colors duration-200`} />
        <span className="font-medium">{selected.label}</span>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={`
            absolute right-0 z-50 mt-1.5 w-52
            rounded-lg border border-stone-200/50 dark:border-white/[0.08] bg-white/95 dark:bg-[#1e1f26]/95 backdrop-blur-xl
            shadow-lg shadow-black/10 dark:shadow-black/30
            animate-in fade-in-0 zoom-in-95 slide-in-from-top-2
            duration-150
          `}
        >
          <div className="p-1">
            {options.map((option) => {
              const Icon = option.icon;
              const isActive = value === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`
                    w-full flex items-start gap-2.5 rounded-lg px-2.5 py-2
                    transition-all duration-150 ease-out
                    ${isActive
                      ? 'text-[#1D9E75] dark:text-[#34d399]'
                      : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
                    }
                  `}
                >
                  <div className={`
                    mt-0.5 rounded-md p-1
                    transition-colors duration-150
                    ${isActive ? 'bg-[#1D9E75]/15' : 'bg-muted/60'}
                  `}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="text-left">
                    <div className={`text-sm font-medium leading-tight ${isActive ? 'text-[#1D9E75] dark:text-[#34d399]' : ''}`}>
                      {option.label}
                    </div>
                    <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                      {option.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
