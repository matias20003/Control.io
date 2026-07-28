import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("Mi Brief mantiene todas sus áreas y un final explícito sin overflow", async ({
  page,
}) => {
  await page.goto("/brief-mobile-fixture");
  await expect(
    page.getByRole("heading", { name: "Mi Brief", level: 1 })
  ).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);

  await expect(page.getByText("En 30 segundos")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Las claves de hoy" })
  ).toBeVisible();
  await page.getByRole("heading", { name: "Llegaste al final" }).scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("button", { name: "Terminé por hoy" })
  ).toBeVisible();
  await expect(page.getByText("No vamos a cargar más contenido")).toBeVisible();

  await page.getByRole("button", { name: "Fuentes" }).click();
  await expect(
    page.getByRole("heading", { name: "Fuentes", level: 2 })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Agregar una fuente" })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Editar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pausar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Eliminar" })).toBeVisible();

  await page.getByRole("button", { name: "Radar" }).click();
  await expect(
    page.getByRole("heading", { name: "Radar del día", level: 2 })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Agregar a mis fuentes" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "No me interesa" })
  ).toBeVisible();

  await page.getByRole("button", { name: "Ajustes" }).click();
  await expect(
    page.getByRole("heading", { name: "Ajustes", level: 2 })
  ).toBeVisible();
  await expect(page.getByText("Actualizaciones diarias")).toBeVisible();
  await expect(page.getByText("Nivel de descubrimiento")).toBeVisible();
  await expect(page.getByText("Longitud del Brief")).toBeVisible();
  await expect(page.getByText("Historial")).toBeVisible();

  const finalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(finalOverflow).toBeLessThanOrEqual(1);
});

test("los controles táctiles principales conservan al menos 44 px", async ({
  page,
}) => {
  await page.goto("/brief-mobile-fixture");
  const undersized = await page.locator("nav button, main button").evaluateAll(
    (elements) =>
      elements
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== "hidden" &&
            style.display !== "none"
          );
        })
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            label:
              element.getAttribute("aria-label") ||
              element.textContent?.trim().slice(0, 60),
            width: rect.width,
            height: rect.height,
          };
        })
        .filter(({ label, height }) => Boolean(label) && height < 43.5)
  );
  expect(undersized).toEqual([]);
});

test("la copia offline textual se prepara al abrir la edición", async ({
  page,
}) => {
  await page.goto("/brief-mobile-fixture");
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem("controlio:brief-offline:v1")
      )
    )
    .not.toBeNull();

  const cache = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("controlio:brief-offline:v1") || "null")
  );
  expect(cache.summary).toContain("inteligencia artificial");
  expect(cache.items.length).toBeGreaterThan(0);
  expect(cache.items.length).toBeLessThanOrEqual(15);
});
