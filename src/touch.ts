const STORAGE_KEY = "escapePatchNotesTouch";

export function initTouchControls(): void {
  const overlay = document.createElement("div");
  overlay.className = "tc-overlay";
  overlay.innerHTML = `
    <div class="tc-pad">
      <button class="tc-btn tc-left"  data-key="KeyA"   aria-label="Move left">&#9664;</button>
      <button class="tc-btn tc-right" data-key="KeyD"   aria-label="Move right">&#9654;</button>
      <button class="tc-btn tc-jump"  data-key="Space"  aria-label="Jump / Confirm">&#9650;</button>
      <button class="tc-btn tc-pause" data-key="Escape" aria-label="Pause / Back">&#9646;&#9646;</button>
      <button class="tc-toggle" aria-label="Toggle touch controls">TOUCH</button>
    </div>
  `;
  document.body.appendChild(overlay);

  if (localStorage.getItem(STORAGE_KEY) === "true") {
    overlay.classList.add("tc-on");
  }

  const toggle = (): void => {
    const next = !overlay.classList.contains("tc-on");
    overlay.classList.toggle("tc-on", next);
    try { localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* private mode */ }
  };

  overlay.querySelector(".tc-toggle")!.addEventListener("pointerup", (e) => {
    e.stopPropagation();
    toggle();
  });

  window.addEventListener("keydown", (e) => {
    if (e.code === "KeyT" && !e.repeat) toggle();
  });

  for (const btn of overlay.querySelectorAll<HTMLElement>("[data-key]")) {
    bindButton(btn, btn.dataset.key!);
  }
}

function bindButton(el: HTMLElement, code: string): void {
  const dispatch = (type: "keydown" | "keyup"): void => {
    window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
  };

  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    dispatch("keydown");
  });

  el.addEventListener("pointerup", (e) => {
    e.preventDefault();
    dispatch("keyup");
  });

  el.addEventListener("pointerleave", () => dispatch("keyup"));
  el.addEventListener("pointercancel", () => dispatch("keyup"));
}
