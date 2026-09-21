type N34rLogoProps = {
  size?: "sm" | "md";
  wordmark?: boolean;
  className?: string;
};

const sizes = {
  sm: {
    stamp: "h-9 w-9 rounded-[10px] text-[13px]",
    tools: "text-lg",
  },
  md: {
    stamp: "h-12 w-12 rounded-[14px] text-[16px]",
    tools: "text-2xl",
  },
};

export function N34rLogo({
  size = "sm",
  wordmark = true,
  className = "",
}: N34rLogoProps) {
  const s = sizes[size];

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span
        className={`flex items-center justify-center bg-black font-mono font-medium tracking-tight text-white ring-1 ring-white/12 ${s.stamp}`}
        aria-hidden="true"
      >
        n<span className="text-[#00EC97]">34</span>r
      </span>
      {wordmark ? (
        <span className={`font-sans font-medium tracking-tight text-foreground ${s.tools}`}>
          .tools
        </span>
      ) : null}
      <span className="sr-only">n34r.tools</span>
    </span>
  );
}
