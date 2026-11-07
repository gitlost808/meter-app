# Publishing a public snapshot

Run from the private repository with Git, Bash, Python 3 and tar installed:

```bash
bash bin/publish-branch.sh --prepare /tmp/meter-app-public-review main
```

This creates a standalone repository for inspection without accessing the network.
The output directory must not exist. To prepare and publish a fresh snapshot:

```bash
bash bin/publish-branch.sh main
```

The script replaces `origin-pub/main-pub` with one root commit using an explicit
`--force-with-lease`, verifies the resulting remote head and retains the temporary
repository for inspection. Check the remote's push URL before running.
An optional source ref replaces `main`; private history, other branches and tags
are never sent.

Only committed source files are exported. The current branch, index, local env
files and untracked files stay untouched. The reviewed publishing script and this
document are copied from the working tree so fixes can be used before merging
them onto `main`.

Both privacy patches are applied: `pub.patch` scrubs readings and notes;
`del.patch` deletes `pub.patch`. The entire patch directory is then removed,
because both patches contain deleted private rows. Remaining SQL seed records
and sequence state are removed too. Tables, constraints, report views and the
daily-reading index remain; public databases start empty. Env files are replaced
with documented development defaults. Docker passwords and Keycloak users are
development examples. Screenshots are intentionally included with owner approval.

Review the prepared files before publishing. Unexpected dump formats, data files,
unapproved binary files and common credential patterns stop preparation, but
automated pattern checks cannot identify every secret or personal record in
source text. Replacing a branch does not erase earlier downloads or caches.
