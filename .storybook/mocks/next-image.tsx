import React, { type ComponentPropsWithoutRef } from "react";

type ImageProps = ComponentPropsWithoutRef<"img"> & {
  fill?: boolean;
  priority?: boolean;
  unoptimized?: boolean;
};

export default function Image({ fill, alt, className, ...rest }: ImageProps) {
  return (
    // Storybook has no Next image optimizer; a plain img is enough.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt ?? ""}
      className={fill ? `absolute inset-0 h-full w-full object-contain ${className ?? ""}` : className}
      {...rest}
    />
  );
}
