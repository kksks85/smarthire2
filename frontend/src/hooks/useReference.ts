import { useEffect, useState } from "react";
import api from "../api/client";
import type { ReferenceData } from "../types";

let cache: ReferenceData | null = null;

export function useReference() {
  const [ref, setRef] = useState<ReferenceData | null>(cache);
  useEffect(() => {
    if (cache) return;
    api.get<ReferenceData>("/reference").then((r) => {
      cache = r.data;
      setRef(r.data);
    });
  }, []);
  return ref;
}
