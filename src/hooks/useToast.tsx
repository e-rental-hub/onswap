import { useCallback, useRef, useState } from "react";

export function useToast() {
  const [toast,    setToast]    = useState('');
  const [toastErr, setToastErr] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, isError = false) => {
    if (timer.current) clearTimeout(timer.current);
    setToast(msg);
    setToastErr(isError);
    timer.current = setTimeout(() => setToast(''), 3500);
  }, []);

  return { toast, toastErr, showToast };
}