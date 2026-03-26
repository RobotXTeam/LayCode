export interface GitHubRepo {
  id: number;
  full_name: string;
  name: string;
  private: boolean;
  default_branch: string;
  language: string | null;
  updated_at: string;
}

export async function listRepos(githubToken: string): Promise<GitHubRepo[]> {
  const res = await fetch("https://api.github.com/user/repos?sort=updated&per_page=50", {
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github+json",
    },
  });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  return res.json();
}

export async function getRepo(githubToken: string, fullName: string): Promise<GitHubRepo> {
  const res = await fetch(`https://api.github.com/repos/${fullName}`, {
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github+json",
    },
  });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  return res.json();
}
