/**
 * Canonical route helpers for Kraken.
 *
 * Use these functions everywhere a route string is built so that
 * all link construction is consistent and easy to update in one place.
 *
 * Public URL scheme:
 *   /@username              – compact profile redirect (→ /~username)
 *   /~username              – publication home (canonical)
 *   /~username/[edition]    – individual issue (canonical)
 *   /editorial              – writer workspace (no active issue)
 *   /editorial/[id]         – writer workspace focused on a specific issue
 */

/**
 * Canonical URL for a publication home page.
 * e.g. publicationUrl("alice") → "/~alice"
 */
export function publicationUrl(username: string): string {
  return `/~${username}`;
}

/**
 * Canonical URL for a single published issue.
 * e.g. issueUrl("alice", 3) → "/~alice/3"
 */
export function issueUrl(username: string, editionNumber: number): string {
  return `/~${username}/${editionNumber}`;
}

/**
 * Compact profile redirect URL (/@username → /~username).
 * Only use this when you specifically need the @-style URL, e.g.
 * in the avatar menu label. Prefer publicationUrl for links.
 */
export function profileUrl(username: string): string {
  return `/@${username}`;
}

/**
 * Canonical URL for the editorial workspace, optionally focused
 * on a specific issue by database id.
 */
export function editorialUrl(issueId?: string): string {
  return issueId ? `/editorial/${issueId}` : "/editorial";
}
