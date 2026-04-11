"use client";

import MDEditor, { commands } from "@uiw/react-md-editor";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  createEditorialDraft,
  type EditorialIssueRecord,
  publishEditorialIssue,
  saveEditorialIssue,
  testSendIssueEmail,
} from "@/actions/editorial-actions";
import { Button } from "@/components/ui/button";
import {
  formatEditorialDate,
  toDateOnlyInputValue,
} from "@/lib/utils/publish-date";
import { editorialUrl, issueUrl } from "@/lib/utils/routes";

type EditorialWorkspaceProps = {
  username: string;
  initialIssues: EditorialIssueRecord[];
  initialActiveIssueId?: string | null;
};

function formatDateTimeStamp(value: Date | null): string {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatPublishedStamp(value: Date | null): string {
  if (!value) {
    return "Never";
  }

  return formatEditorialDate(value);
}

export function EditorialWorkspace({
  username,
  initialIssues,
  initialActiveIssueId,
}: EditorialWorkspaceProps) {
  const initialIssue = initialActiveIssueId
    ? (initialIssues.find((i) => i.id === initialActiveIssueId) ??
      initialIssues[0] ??
      null)
    : (initialIssues[0] ?? null);

  const [issues, setIssues] = useState(initialIssues);
  const [activeIssueId, setActiveIssueId] = useState<string | null>(
    initialIssue?.id ?? null,
  );
  const [title, setTitle] = useState(initialIssue?.title ?? "");
  const [content, setContent] = useState(initialIssue?.content ?? "");
  const [publishDateValue, setPublishDateValue] = useState(
    initialIssue?.status === "published" && initialIssue?.publishedAt
      ? toDateOnlyInputValue(initialIssue.publishedAt)
      : "",
  );
  const [notice, setNotice] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const router = useRouter();

  const activeIssue = useMemo(
    () => issues.find((issue) => issue.id === activeIssueId) ?? null,
    [issues, activeIssueId],
  );

  const draftIssues = useMemo(
    () => issues.filter((issue) => issue.status === "draft"),
    [issues],
  );
  const publishedIssues = useMemo(
    () => issues.filter((issue) => issue.status === "published"),
    [issues],
  );

  const toolbarCommands = useMemo(
    () => [
      commands.bold,
      commands.italic,
      commands.strikethrough,
      commands.hr,
      commands.divider,
      commands.title,
      commands.quote,
      commands.unorderedListCommand,
      commands.orderedListCommand,
      commands.link,
      commands.code,
      commands.codeBlock,
    ],
    [],
  );

  function selectIssue(issue: EditorialIssueRecord) {
    setActiveIssueId(issue.id);
    setTitle(issue.title);
    setContent(issue.content);
    setPublishDateValue(
      issue.status === "published" && issue.publishedAt
        ? toDateOnlyInputValue(issue.publishedAt)
        : "",
    );
    setNotice("");
  }

  function handleCreateDraft() {
    startTransition(async () => {
      try {
        const created = await createEditorialDraft();
        setIssues((prev) => [created, ...prev]);
        selectIssue(created);
        setNotice("New draft created.");
        router.push(editorialUrl(created.id));
      } catch {
        setNotice("Could not create draft.");
      }
    });
  }

  function handleSave() {
    if (!activeIssue) {
      return;
    }

    startTransition(async () => {
      try {
        const saved = await saveEditorialIssue({
          issueId: activeIssue.id,
          title: title.trim() || "Untitled Draft",
          content,
        });

        setIssues((prev) =>
          prev.map((issue) => (issue.id === saved.id ? saved : issue)),
        );
        selectIssue(saved);
        setNotice(
          saved.status === "published"
            ? "Published issue updated."
            : "Draft saved.",
        );
      } catch {
        setNotice("Could not save changes.");
      }
    });
  }

  async function handleCopyMarkdown() {
    try {
      if (!navigator?.clipboard?.writeText) {
        setNotice("Clipboard is not available in this browser context.");
        return;
      }

      await navigator.clipboard.writeText(content);
      setNotice("Markdown copied.");
    } catch {
      setNotice("Could not copy markdown.");
    }
  }

  function handlePublish() {
    if (!activeIssue) {
      return;
    }

    startTransition(async () => {
      try {
        const published = await publishEditorialIssue({
          issueId: activeIssue.id,
          title: title.trim() || "Untitled Issue",
          content,
          publishedOn: publishDateValue,
        });

        setIssues((prev) =>
          prev.map((issue) => (issue.id === published.id ? published : issue)),
        );
        selectIssue(published);
        setNotice("Issue published.");
      } catch {
        setNotice("Could not publish issue.");
      }
    });
  }

  function handleTestSend() {
    if (!activeIssue) {
      return;
    }

    startTransition(async () => {
      try {
        await testSendIssueEmail({
          issueId: activeIssue.id,
          title: title.trim() || "Untitled Issue",
          content,
        });
        setNotice("Test email sent to your inbox.");
      } catch {
        setNotice("Could not send test email.");
      }
    });
  }

  return (
    <section className="grid gap-8 lg:grid-cols-[18rem_1fr]">
      <aside className="space-y-6 border border-paper-border bg-white/60 p-5 lg:sticky lg:top-8 lg:h-fit">
        <div className="space-y-3">
          <p className="text-meta text-paper-muted">Issue Archive</p>
          <Button
            variant="primary"
            className="w-full text-sm"
            onClick={handleCreateDraft}
            disabled={isPending}
          >
            New draft
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-paper-muted">Drafts</p>
          {draftIssues.length === 0 ? (
            <p className="text-sm text-paper-muted">No drafts yet.</p>
          ) : (
            draftIssues.map((issue) => (
              <Link
                key={issue.id}
                href={editorialUrl(issue.id)}
                className={`block w-full border px-3 py-2 text-left transition ${
                  issue.id === activeIssueId
                    ? "border-paper-ink bg-paper-border/50"
                    : "border-paper-border hover:bg-paper-border/40"
                }`}
              >
                <p className="line-clamp-2 text-body-editorial text-paper-ink">
                  {issue.title || "Untitled Draft"}
                </p>
                <p className="mt-1 text-sm text-paper-muted">
                  Ed. #{issue.editionNumber}
                </p>
              </Link>
            ))
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm text-paper-muted">Published</p>
          {publishedIssues.length === 0 ? (
            <p className="text-sm text-paper-muted">Nothing published yet.</p>
          ) : (
            publishedIssues.map((issue) => (
              <Link
                key={issue.id}
                href={editorialUrl(issue.id)}
                className={`block w-full border px-3 py-2 text-left transition ${
                  issue.id === activeIssueId
                    ? "border-paper-ink bg-paper-border/50"
                    : "border-paper-border hover:bg-paper-border/40"
                }`}
              >
                <p className="line-clamp-2 text-body-editorial text-paper-ink">
                  {issue.title || "Untitled Issue"}
                </p>
                <p className="mt-1 text-sm text-paper-muted">
                  Published {formatPublishedStamp(issue.publishedAt)}
                </p>
              </Link>
            ))
          )}
        </div>
      </aside>

      <div className="space-y-5 border border-paper-border bg-white/60 p-6 lg:p-8">
        {activeIssue ? (
          <>
            <header className="space-y-3 border-b border-paper-border pb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-meta text-paper-muted">
                  Edition #{activeIssue.editionNumber}
                </p>
                <p className="text-sm text-paper-muted">
                  Last updated {formatDateTimeStamp(activeIssue.updatedAt)}
                </p>
              </div>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Issue title"
                className="w-full border border-paper-border bg-paper-base px-3 py-2 font-family-display text-[clamp(1.4rem,3vw,2rem)] text-paper-ink outline-none focus:border-paper-accent"
              />
            </header>

            <div data-color-mode="light">
              <MDEditor
                value={content}
                onChange={(nextValue: string | undefined) =>
                  setContent(nextValue ?? "")
                }
                preview="edit"
                visibleDragbar={false}
                height={480}
                textareaProps={{
                  placeholder: "Write your issue here...",
                  className: "select-text",
                }}
                commands={toolbarCommands}
                extraCommands={[]}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-paper-border pt-4">
              <Button
                variant="primary"
                className="text-sm"
                onClick={handleSave}
                disabled={isPending}
              >
                {activeIssue.status === "published"
                  ? "Save published changes"
                  : "Save draft"}
              </Button>

              <Button
                variant="secondary"
                className="text-sm"
                onClick={handleTestSend}
                disabled={isPending}
              >
                Test send to me
              </Button>

              <Button
                variant="secondary"
                className="text-sm"
                onClick={handleCopyMarkdown}
                disabled={isPending}
              >
                Copy markdown
              </Button>

              {activeIssue.status === "draft" ? (
                <>
                  <div className="flex min-w-64 flex-col gap-1">
                    <label
                      htmlFor="publish-date"
                      className="text-xs text-paper-muted"
                    >
                      Publish date (optional)
                    </label>
                    <input
                      id="publish-date"
                      type="date"
                      value={publishDateValue}
                      onChange={(event) =>
                        setPublishDateValue(event.target.value)
                      }
                      className="border border-paper-border bg-paper-base px-2 py-1 text-sm text-paper-ink outline-none focus:border-paper-accent"
                      disabled={isPending}
                    />
                    <p className="text-xs text-paper-muted">
                      Leave blank to publish with today&apos;s date. Future
                      dates are not allowed.
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    className="text-sm"
                    onClick={handlePublish}
                    disabled={isPending}
                  >
                    Publish issue
                  </Button>
                </>
              ) : (
                <span className="text-sm text-paper-muted">Published</span>
              )}

              {activeIssue.status === "published" ? (
                <Link
                  href={issueUrl(username, activeIssue.editionNumber)}
                  className="text-sm underline underline-offset-2"
                >
                  View published page
                </Link>
              ) : null}

              {notice ? (
                <p className="ml-auto text-sm text-paper-muted">{notice}</p>
              ) : null}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <h2 className="text-headline text-paper-ink">Start writing</h2>
            <p className="text-body-editorial text-paper-muted">
              Create your first draft from the left sidebar.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
