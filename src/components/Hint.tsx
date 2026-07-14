import { X } from "lucide-react";

type ArrowSide = "top" | "bottom" | "left" | "right";

type HintProps = {
  text: string;
  arrow: ArrowSide;
  className?: string;
  arrowClassName?: string;
  onDismiss: () => void;
};

const ARROW_POSITION: Record<ArrowSide, string> = {
  top: "-top-1.5 left-6",
  bottom: "-bottom-1.5 right-6",
  left: "-left-1.5 top-5",
  right: "-right-1.5 top-5",
};

export function Hint({ text, arrow, className, arrowClassName, onDismiss }: HintProps) {
  return (
    <div className={["pointer-events-none absolute z-40", className].filter(Boolean).join(" ")}>
      <div className="pointer-events-auto relative max-w-60 animate-[hint-bob_2.4s_ease-in-out_infinite] rounded-xl border border-blue-300 bg-blue-50/95 px-3 py-2 pr-8 text-xs font-medium text-blue-900 shadow-lg backdrop-blur dark:border-blue-400/40 dark:bg-blue-500/15 dark:text-blue-100">
        <span
          className={[
            "absolute h-3 w-3 rotate-45 border border-blue-300 bg-blue-50 dark:border-blue-400/40 dark:bg-hint",
            arrow === "top" || arrow === "left" ? "border-b-0 border-r-0" : "border-l-0 border-t-0",
            arrowClassName ?? ARROW_POSITION[arrow],
          ].join(" ")}
          aria-hidden="true"
        />
        {text}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss hint"
          className="absolute right-1 top-1 rounded-full p-1 text-blue-500 transition hover:bg-blue-100 hover:text-blue-700 dark:text-blue-300 dark:hover:bg-blue-400/20 dark:hover:text-blue-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
