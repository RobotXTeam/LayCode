import Link from "next/link";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session.userId) redirect("/sign-in");

  return (
    <div className="min-h-screen">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 sm:px-6 h-14">
          <Link href="/dashboard" className="text-[13px] font-bold tracking-tight">
            layrr
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-muted-foreground">
                {session.githubUsername}
              </span>
              <a
                href="/api/auth/logout"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Log out
              </a>
            </div>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-3xl px-4 sm:px-6 pt-24 pb-16">{children}</main>
    </div>
  );
}
