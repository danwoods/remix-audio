import type { ReactNode } from "react";

/** Horizontal scrolling row of 5 items with title */
const HorizontalRowWithTitle = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => {
  return (
    <section className="py-4 pl-4">
      <p className="text-lg font-bold mb-2">{title}</p>
      <div
        className="grid gap-x-4 md:gap-x-6 overflow-x-auto"
        style={{
          gridTemplateColumns: `repeat(5, calc(40% - 40px))`,
        }}
      >
        {children}
      </div>
    </section>
  );
};

export default HorizontalRowWithTitle;
