import { useMemo, forwardRef } from "react";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import python from "highlight.js/lib/languages/python";
import powershell from "highlight.js/lib/languages/powershell";
import "highlight.js/styles/github.css";

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("python", python);
hljs.registerLanguage("powershell", powershell);

type Props = {
  code: string;
  language: string;
};

export const CodeBlock = forwardRef<HTMLPreElement, Props>(function CodeBlock({ code, language }, ref) {
  const html = useMemo(() => {
    try {
      return hljs.highlight(code, { language }).value;
    } catch {
      return code;
    }
  }, [code, language]);

  return (
    <pre ref={ref} className="bg-surface-container-low border border-outline-variant p-4 text-[12px] font-mono overflow-x-auto whitespace-pre-wrap">
      <code dangerouslySetInnerHTML={{ __html: html }} />
    </pre>
  );
});
