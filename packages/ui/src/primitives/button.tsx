"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import {
  Button as DesignButton,
  buttonVariants as designButtonVariants,
} from "../ui/Button/Button";
import { cn } from "../lib/cn";

const primitiveButtonVariants = cva("", {
  variants: {
    variant: {
      default: "",
      primary: "",
      secondary: "",
      outline: "",
      ghost: "",
      destructive: "",
    },
    size: {
      default: "",
      sm: "",
      md: "",
      lg: "",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof primitiveButtonVariants>;

function mapVariant(
  variant: ButtonProps["variant"],
): "default" | "primary" | "secondary" | "ghost" | "destructive" {
  if (variant === "outline") return "default";
  if (variant === "secondary") return "secondary";
  if (variant === "ghost") return "ghost";
  if (variant === "destructive") return "destructive";
  if (variant === "primary") return "primary";
  return "primary";
}

function mapSize(size: ButtonProps["size"]): "sm" | "md" | "lg" {
  if (size === "sm") return "sm";
  if (size === "lg") return "lg";
  return "md";
}

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <DesignButton
      type={type}
      variant={mapVariant(variant)}
      size={mapSize(size)}
      className={cn(className)}
      {...props}
    />
  );
}

export { designButtonVariants as buttonVariants };
