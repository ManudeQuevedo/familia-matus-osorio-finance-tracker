"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { signOutAndClearPreferences } from "@/lib/auth/sign-out-client";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { notify } from "@/lib/toast";

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
        notify.auth.logoutSuccess();
        router.replace("/login");
        router.refresh();
      }}>
      {label}
    </Button>
  );
}
