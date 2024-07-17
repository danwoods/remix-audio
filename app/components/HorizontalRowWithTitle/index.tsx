import type { ReactNode } from "react";

/** Horizontal scrolling row with title */
const HorizontalRowWithTitle = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => {
  return (
    <section className="py-4">
      <p className="text-lg font-bold mb-2">{title}</p>
      <div
        style={{
          display: "grid",
          gridGap: "10px",
          gridTemplateColumns: "repeat(5, calc(38% - 40px))",
          overflowX: "auto",
        }}
      >
        {children}
      </div>
    </section>
  );
};

export default HorizontalRowWithTitle;
