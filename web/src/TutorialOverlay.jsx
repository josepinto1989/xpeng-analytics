import React, { useEffect, useMemo, useRef, useState } from "react";

const margin = 14;
const cardWidth = 350;
const cardHeight = 245;

function visibleTarget(selectors) {
  for (const selector of Array.isArray(selectors) ? selectors : [selectors]) {
    for (const element of document.querySelectorAll(selector || "")) {
      const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
      if (rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden") return element;
    }
  }
  return null;
}

function cardPosition(rect) {
  const viewportWidth = window.innerWidth, viewportHeight = window.innerHeight;
  if (!rect) return { left: Math.max(margin, (viewportWidth - cardWidth) / 2), top: Math.max(margin, (viewportHeight - cardHeight) / 2) };
  if (rect.right + cardWidth + margin * 2 <= viewportWidth) {
    return { left: rect.right + margin, top: Math.max(margin, Math.min(viewportHeight - cardHeight - margin, rect.top + Math.min(30, rect.height * .2))) };
  }
  const below = rect.bottom + cardHeight + margin <= viewportHeight;
  return {
    left: Math.max(margin, Math.min(viewportWidth - cardWidth - margin, rect.left)),
    top: below ? rect.bottom + margin : Math.max(margin, rect.top - cardHeight - margin),
  };
}

export default function TutorialOverlay({ steps, onComplete, onSkip, t }) {
  const [index, setIndex] = useState(0), [rect, setRect] = useState(null);
  const dialogRef = useRef(null);
  const step = steps[index];
  useEffect(() => { setIndex(0); }, [steps]);
  useEffect(() => {
    if (!step) return undefined;
    let frame;
    const update = () => {
      const target = visibleTarget(step.target);
      if (!target) { setRect(null); return; }
      const next = target.getBoundingClientRect();
      setRect({ top: next.top, left: next.left, width: next.width, height: next.height, right: next.right, bottom: next.bottom });
    };
    const target = visibleTarget(step.target);
    target?.scrollIntoView({ block: "center", inline: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    frame = requestAnimationFrame(update);
    const delayed = setTimeout(update, 280);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => { cancelAnimationFrame(frame); clearTimeout(delayed); window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [step]);
  useEffect(() => {
    dialogRef.current?.focus();
    const keys = (event) => {
      if (event.key === "Escape") onSkip();
      if (event.key === "ArrowLeft" && index > 0) setIndex((current) => current - 1);
      if (event.key === "ArrowRight") {
        if (index < steps.length - 1) setIndex((current) => current + 1);
        else onComplete();
      }
    };
    document.addEventListener("keydown", keys);
    return () => document.removeEventListener("keydown", keys);
  }, [index, steps.length, onComplete, onSkip]);
  const position = useMemo(() => cardPosition(rect), [rect]);
  if (!step) return null;
  return <div className={`tutorial-layer ${rect ? "has-target" : "no-target"}`}>
    <div className="tutorial-blocker" aria-hidden="true" />
    {rect ? <div className="tutorial-spotlight" style={{ top: Math.max(6, rect.top - 6), left: Math.max(6, rect.left - 6), width: Math.min(window.innerWidth - 12, rect.width + 12), height: Math.min(window.innerHeight - 12, rect.height + 12) }} aria-hidden="true" /> : null}
    <section ref={dialogRef} className="tutorial-card" style={position} role="dialog" aria-modal="true" aria-labelledby="tutorial-title" tabIndex="-1">
      <header><span>{t("tutorialLabel")}</span><button type="button" onClick={onSkip} aria-label={t("tutorialClose")}>×</button></header>
      <div className="tutorial-step-count"><span style={{ width: `${(index + 1) / steps.length * 100}%` }} /><small>{index + 1} / {steps.length}</small></div>
      <h2 id="tutorial-title">{step.title}</h2>
      <p>{step.body}</p>
      <footer><button className="tutorial-skip" type="button" onClick={onSkip}>{t("tutorialSkip")}</button><div>{index ? <button type="button" onClick={() => setIndex((current) => current - 1)}>{t("tutorialPrevious")}</button> : null}<button className="tutorial-next" type="button" onClick={() => index === steps.length - 1 ? onComplete() : setIndex((current) => current + 1)}>{index === steps.length - 1 ? t("tutorialFinish") : t("tutorialNext")}</button></div></footer>
    </section>
  </div>;
}
