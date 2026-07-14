import type { CommentLength } from "../../lib/types"

interface LengthSelectorProps {
  value: CommentLength
  onChange: (length: CommentLength) => void
}

const options: Array<{ value: CommentLength; label: string; detail: string }> = [
  { value: "short", label: "Short", detail: "≤20 words" },
  { value: "medium", label: "Medium", detail: "25–45 words" },
  { value: "long", label: "Long", detail: "45–75 words" },
]

export default function LengthSelector({ value, onChange }: LengthSelectorProps) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-foreground">Comment length</legend>
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={`cursor-pointer rounded-lg border px-2 py-2 text-center transition-[border-color,background-color,color] active:scale-[0.96] ${
              value === option.value
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background text-muted-foreground hover:border-foreground/20"
            }`}
          >
            <input
              type="radio"
              name="length"
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <span className="block text-xs font-bold">{option.label}</span>
            <span className="mt-0.5 block text-[10px]">{option.detail}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
