import { afterEach, describe, expect, it } from "vitest";
import { startBadgeGuard } from "@/lib/badge-guard";

const tick = () => new Promise((r) => setTimeout(r, 60));

describe("badge guard", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("removes badges already on the page and leaves the app's own elements alone", () => {
    document.body.innerHTML = `
      <div id="app-root"><p class="keep-me">hello</p></div>
      <div id="lovable-badge">Edit with Lovable</div>
      <a class="Lovable-Link" href="https://lovable.dev/x">x</a>`;
    const stop = startBadgeGuard();
    expect(document.querySelector("#lovable-badge")).toBeNull();
    expect(document.querySelector(".Lovable-Link")).toBeNull();
    expect(document.querySelector(".keep-me")).not.toBeNull();
    stop();
  });

  it("removes badges injected after load", async () => {
    const stop = startBadgeGuard();
    const late = document.createElement("div");
    late.className = "some lovable-badge-wrapper";
    document.body.appendChild(late);
    await tick();
    expect(document.querySelector(".lovable-badge-wrapper")).toBeNull();
    stop();
  });

  it("never removes <body> even if it carries a matching class", () => {
    document.body.className = "lovable-theme";
    const stop = startBadgeGuard();
    expect(document.body).not.toBeNull();
    expect(document.documentElement.contains(document.body)).toBe(true);
    document.body.className = "";
    stop();
  });
});
