import { formDataToObject } from "@/lib/action-result";
import { profileSchema } from "@/lib/validation";

function isFormToggleOn(formData: FormData, name: string): boolean {
  const value = formData.get(name);
  return value === "on" || value === "true";
}

/** Map a native form submit onto `profileSchema`. File inputs are ignored here. */
export function parseProfileFormData(formData: FormData) {
  return profileSchema.safeParse({
    ...formDataToObject(formData),
    showEmail: isFormToggleOn(formData, "showEmail"),
    showEmployer: isFormToggleOn(formData, "showEmployer"),
    showGender: isFormToggleOn(formData, "showGender"),
  });
}
