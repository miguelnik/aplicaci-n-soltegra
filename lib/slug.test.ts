import { describe, it, expect } from "vitest";
import { nameToSlug } from "./slug";

describe("nameToSlug", () => {
  it("converts simple names to slugs", () => {
    expect(nameToSlug("Certificado energético")).toBe("certificado-energetico");
  });

  it("handles multiple spaces", () => {
    expect(nameToSlug("  Estudio   estructural  ")).toBe("estudio-estructural");
  });

  it("removes special characters", () => {
    expect(nameToSlug("¿Inspección técnica?")).toBe("inspeccion-tecnica");
  });

  it("removes accents and diacritics", () => {
    expect(nameToSlug("Diseño & análisis")).toBe("diseno-analisis");
  });

  it("collapses consecutive dashes", () => {
    expect(nameToSlug("Foo -- Bar")).toBe("foo-bar");
  });

  it("handles empty string", () => {
    expect(nameToSlug("")).toBe("");
  });

  it("handles only special characters", () => {
    expect(nameToSlug("!!!")).toBe("");
  });
});
