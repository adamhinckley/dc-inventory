import React, { type ComponentPropsWithoutRef, type ReactNode } from "react";

type LinkProps = Omit<ComponentPropsWithoutRef<"a">, "href"> & {
  href: string | { pathname?: string };
  children?: ReactNode;
};

export default function Link({ href, children, ...rest }: LinkProps) {
  const url = typeof href === "string" ? href : (href.pathname ?? "#");
  return (
    <a href={url} {...rest}>
      {children}
    </a>
  );
}
