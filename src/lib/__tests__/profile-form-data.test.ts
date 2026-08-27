import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseProfileFormData } from "../profile-form-data";

function filledProfileForm(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  const fields = {
    displayName: "Alumni Office",
    headline: "SHKSC Alumni Network administrator",
    bio: "",
    graduationYear: "2013",
    hscPassingYear: "2015",
    degree: "",
    departmentId: "cms3bomqk0001hb88i0fatipb",
    company: "SELISE Digital Platforms",
    position: "Software Engineer",
    whatsappPhone: "+8801700000000",
    facebookUrl: "",
    linkedInUrl: "",
    websiteUrl: "",
    city: "Dhaka",
    countryCode: "BD",
    collegeName: "Govt Science College",
    collegeDepartment: "Science",
    collegeSession: "2013-2014",
    universityName: "",
    universityDepartment: "",
    universitySession: "",
    visibility: "PUBLIC",
    bloodGroup: "B_POSITIVE",
    ...overrides,
  };

  for (const [name, value] of Object.entries(fields)) {
    formData.set(name, value);
  }

  formData.set("avatar", new File([], "photo.png", { type: "image/png" }));
  return formData;
}

describe("parseProfileFormData", () => {
  it("keeps select values when an empty avatar File is in the same FormData", () => {
    const parsed = parseProfileFormData(filledProfileForm());
    assert.equal(parsed.success, true);
    if (!parsed.success) return;

    assert.equal(parsed.data.bloodGroup, "B_POSITIVE");
    assert.equal(parsed.data.departmentId, "cms3bomqk0001hb88i0fatipb");
    assert.equal(parsed.data.collegeDepartment, "Science");
    assert.equal(parsed.data.countryCode, "BD");
    assert.equal(parsed.data.visibility, "PUBLIC");
  });

  it("treats empty native selects as unset rather than failing the save", () => {
    const parsed = parseProfileFormData(
      filledProfileForm({
        bloodGroup: "",
        departmentId: "",
        collegeDepartment: "",
        countryCode: "",
      }),
    );
    assert.equal(parsed.success, true);
    if (!parsed.success) return;

    assert.equal(parsed.data.bloodGroup, null);
    assert.equal(parsed.data.departmentId, null);
    assert.equal(parsed.data.collegeDepartment, null);
    assert.equal(parsed.data.countryCode, null);
  });

  it("rejects a missing visibility value so Hidden cannot be saved by omission", () => {
    const formData = filledProfileForm();
    formData.delete("visibility");
    const parsed = parseProfileFormData(formData);
    assert.equal(parsed.success, false);
  });
});
