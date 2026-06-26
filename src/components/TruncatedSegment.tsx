export default function TruncatedSegment({ text, maxLength = 16 }: { text: string; maxLength?: number }) {
  const isTruncated = text.length > maxLength;
  const displayText = isTruncated ? `${text.slice(0, maxLength - 3)}...` : text;

  return (
    <span className="relative group inline-flex items-center">
      <span>{displayText}</span>
      {isTruncated && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-50 pointer-events-none transition-all duration-200">
          <span className="bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md text-white font-medium text-[10px] font-mono px-2.5 py-1.5 rounded-lg shadow-2xl border border-slate-800/80 dark:border-slate-800/80 whitespace-nowrap ring-1 ring-black/5">
            {text}
          </span>
          <span className="w-2 h-2 bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md rotate-45 -mt-1 border-r border-b border-slate-800/80 dark:border-slate-800/80" />
        </span>
      )}
    </span>
  );
}
