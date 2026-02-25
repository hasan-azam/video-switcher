import React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "secondary" | "destructive";
};

export function Button({ variant = "default", style, ...props }: Props) {
  const base: React.CSSProperties = {
    borderRadius: 10,
    padding: "8px 12px",
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.10)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 550,

    // ✅ important for layout
    whiteSpace: "nowrap",
    flex: "0 0 auto",
  };

  const variants: Record<string, React.CSSProperties> = {
    default: {},
    secondary: { background: "rgba(255,255,255,0.06)" },
    destructive: { borderColor: "rgba(255,90,90,0.45)" },
  };

  return <button {...props} style={{ ...base, ...variants[variant], ...style }} />;
}