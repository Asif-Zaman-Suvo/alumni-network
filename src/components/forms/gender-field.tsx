import { Field } from "@/components/forms/field";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { GENDER_OPTIONS, type GenderValue } from "@/lib/gender";

export function GenderField({
  error,
  defaultValue,
}: {
  error?: string | undefined;
  defaultValue?: GenderValue;
}) {
  return (
    <Field name="gender" label="Gender" error={error} required>
      <RadioGroup name="gender" defaultValue={defaultValue} className="flex flex-wrap gap-3">
        {GENDER_OPTIONS.map((option) => (
          <Label
            key={option.value}
            htmlFor={`gender-${option.value}`}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-normal transition-colors hover:bg-accent/40 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
          >
            <RadioGroupItem id={`gender-${option.value}`} value={option.value} />
            {option.label}
          </Label>
        ))}
      </RadioGroup>
    </Field>
  );
}
