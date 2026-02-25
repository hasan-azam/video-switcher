import React from "react";

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          tableLayout: "fixed", // ✅ key
        }}
      >
        {children}
      </table>
    </div>
  );
}

export function Th({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <th
      style={{
        textAlign: "left",
        fontSize: 12,
        color: "rgba(255,255,255,0.72)",
        fontWeight: 650,
        padding: "10px 10px",
        borderBottom: "1px solid rgba(255,255,255,0.12)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <td
      style={{
        padding: "10px 10px",
        borderBottom: "1px solid rgba(255,255,255,0.10)",
        verticalAlign: "middle",
        overflow: "hidden", // ✅ prevents “running into” look
        ...style,
      }}
    >
      {children}
    </td>
  );
}