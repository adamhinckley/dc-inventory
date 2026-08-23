export function usePathname(): string {
  return "/catalog";
}

export function useSearchParams(): URLSearchParams {
  return new URLSearchParams();
}

export function useRouter() {
  return {
    push: () => undefined,
    replace: () => undefined,
    prefetch: () => undefined,
    back: () => undefined,
    forward: () => undefined,
    refresh: () => undefined,
  };
}
