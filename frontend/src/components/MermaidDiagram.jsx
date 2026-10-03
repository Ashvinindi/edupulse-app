import React, { useEffect, useRef } from "react";
import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: true,
  theme: "dark",
  securityLevel: "loose",
});

export default function MermaidDiagram({ code }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current && code) {
      containerRef.current.removeAttribute("data-processed");
      containerRef.current.innerHTML = code;
      mermaid.contentLoaded();
    }
  }, [code]);

  return (
    <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 overflow-x-auto my-4">
      <div ref={containerRef} className="mermaid flex justify-center" />
    </div>
  );
}