"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { signOutAndClearPreferences } from "@/lib/auth/sign-out-client";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function SignOutButton({ label }: { label: string }) {
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        const supabase = createSupabaseBrowserClient();
        await signOutAndClearPreferences(supabase);
        router.replace("/login");
        router.refresh();
      }}>
      {label}
    </Button>
  );
}
