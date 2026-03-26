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
      <nav className="border-b border-zinc-800 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/dashboard" className="text-lg font-bold tracking-tight">
            layrr
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/new"
              className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-white"
            >
              New Project
            </Link>
            <div className="flex items-center gap-3">
              <span className="text-sm text-zinc-500">
                {session.githubUsername}
              </span>
              <a
                href="/api/auth/logout"
                className="text-xs text-zinc-600 hover:text-zinc-400"
              >
                Log out
              </a>
            </div>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
