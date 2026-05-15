import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function SecuritySettingsRedirect({ params }: Props) {
  const { locale } = await params;
  redirect(`/${locale}/settings#security`);
}
