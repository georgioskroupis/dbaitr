#!/usr/bin/env bash
set -euo pipefail

# push-main.sh — Interactive workflow to commit local work and (optionally) push to remote main
#
# Rules it enforces:
# 1) You can work on any local branch.
# 2) Only remote branch used is `main`.
# 3) Single command to push to remote main with interactive flow.
# 4) Flow:
#    a) Show current branch.
#    b) Ask: merge everything to local main OR just commit to current branch.
#    c) If merged to local main, ask if you also want to push to remote main.
#    d) If there is nothing to commit, create an empty commit (to trigger App Hosting deploy).
# 5) Always target the same Firebase App Hosting backend for production (Studio) — optional verification step.

remote="origin"
main_branch="main"
project_id_default="db8app"

ts_utc() { date -u +%Y-%m-%dT%H:%M:%SZ; }
default_msg() { printf "chore: ci trigger %s" "$(ts_utc)"; }

confirm() {
  # Usage: confirm "Prompt? [y/N]" -> returns 0 for yes, 1 for no
  local prompt=${1:-"Proceed? [y/N] "}
  read -r -p "$prompt" reply || true
  case "$reply" in
    [yY][eE][sS]|[yY]) return 0;;
    *) return 1;;
  esac
}

prompt_input() {
  # Usage: prompt_input "Message" "default"
  local msg=${1:-"Enter value"}
  local def=${2:-""}
  if [[ -n "$def" ]]; then
    read -r -p "$msg [$def]: " val || true
    echo "${val:-$def}"
  else
    read -r -p "$msg: " val || true
    echo "${val}"
  fi
}

ensure_git_ready() {
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "Not a git repository" >&2; exit 1; }
  git remote get-url "$remote" >/dev/null 2>&1 || { echo "Remote '$remote' not found" >&2; exit 1; }
  if ! git config user.email >/dev/null 2>&1; then
    git config user.email "ci@example.com"
  fi
  if ! git config user.name >/dev/null 2>&1; then
    git config user.name "CI Trigger Bot"
  fi
}

commit_all_or_empty() {
  # Stage and commit all; if nothing staged, create empty commit
  local msg=${1:-"$(default_msg)"}
  git add -A
  if git diff --cached --quiet; then
    echo "No staged changes; creating empty commit..."
    git commit --allow-empty -m "$msg"
  else
    git commit -m "$msg"
  fi
}

merge_branch_into_main() {
  local source_branch=$1
  local msg=${2:-"$(default_msg)"}

  echo "Switching to '$main_branch' and updating from remote..."
  git checkout "$main_branch"
  git fetch "$remote" --prune || true
  git pull --rebase "$remote" "$main_branch" || true

  echo "Merging '$source_branch' into '$main_branch'..."
  # Try fast-forward first; if not possible, do a merge commit
  if git merge --ff-only "$source_branch" 2>/dev/null; then
    echo "Fast-forward merge applied."
  else
    git merge --no-ff -m "merge: $source_branch -> $main_branch" "$source_branch"
  fi

  # Ensure at least one commit exists (empty commit if needed)
  if git diff --quiet HEAD^ HEAD 2>/dev/null; then
    echo "No new diff detected after merge; creating empty commit on main to trigger deploy..."
    git commit --allow-empty -m "$msg"
  fi
}

maybe_push_main() {
  echo "Pushing '$main_branch' to '$remote'..."
  if git push "$remote" "$main_branch"; then
    echo "Pushed successfully to '$remote/$main_branch'."
  else
    echo "Push failed. If this is a protected branch (GH006), a PR may be required by repo settings." >&2
    exit 1
  fi
}

verify_apphosting_backend() {
  # Optional check to verify the presence of a backend that includes "Studio"
  local project_id="${PROJECT_ID:-$project_id_default}"
  if ! command -v firebase >/dev/null 2>&1; then
    echo "Firebase CLI not found; skipping App Hosting backend verification."; return 0
  fi
  echo "Verifying App Hosting backends for project '$project_id'..."
  if backends_json=$(firebase apphosting:backends:list --project "$project_id" --json 2>/dev/null); then
    if echo "$backends_json" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);const names=(j.backends||[]).map(b=>b.displayName||b.backendId||'');console.log(names.join('\n'))}catch(e){}})" | grep -qi "studio"; then
      echo "Studio backend detected."
    else
      echo "WARNING: Could not detect a backend named 'Studio'. Ensure production uses the 'Studio' backend in Firebase App Hosting." >&2
    fi
  else
    echo "Could not query App Hosting backends (not logged in or insufficient permissions). Skipping check." >&2
  fi
}

verify_apphosting_backend_studio() {
  # Verify a Firebase App Hosting backend with backendId exactly "studio"
  local project_id="${PROJECT_ID:-$project_id_default}"
  if ! command -v firebase >/dev/null 2>&1; then
    echo "Firebase CLI not found; skipping App Hosting backend verification."; return 0
  fi
  echo "Verifying App Hosting backend 'studio' in project '$project_id'..."
  if backends_json=$(firebase apphosting:backends:list --project "$project_id" --json 2>/dev/null); then
    local result
    result=$(echo "$backends_json" | node -e '
let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
  try{
    const j=JSON.parse(d);
    const b=(j.backends||[]).find(x=>String(x.backendId||"").toLowerCase()==="studio");
    if(b){
      const name=b.displayName||b.backendId||"studio";
      const id=b.backendId||"studio";
      console.log("FOUND:"+name+":"+id);
    } else {
      console.log("NOT_FOUND");
    }
  }catch(e){console.log("PARSE_ERROR")}
})'
    )
    if [[ "$result" == FOUND:* ]]; then
      local details=${result#FOUND:}
      echo "Studio backend detected: ${details%%:*} (id=${details##*:})"
      return 0
    else
      echo "WARNING: App Hosting backend with id 'studio' not found. Ensure production uses the 'studio' backend." >&2
      return 1
    fi
  else
    echo "Could not query App Hosting backends (not logged in or insufficient permissions). Skipping check." >&2
    return 0
  fi
}

main() {
  ensure_git_ready

  local current_branch
  current_branch=$(git rev-parse --abbrev-ref HEAD)
  echo "Current branch: $current_branch"

  # Prompt for action
  echo "Choose action:"
  echo "  1) Merge everything to local '$main_branch'"
  echo "  2) Just commit to current branch ('$current_branch')"
  read -r -p "Enter 1 or 2 [1]: " choice || true
  choice=${choice:-1}

  local msg
  msg=$(prompt_input "Commit message" "$(default_msg)")

  if [[ "$choice" == "2" ]]; then
    echo "Committing on '$current_branch'..."
    commit_all_or_empty "$msg"
    echo "Done committing to '$current_branch'. Not pushing (remote pushes only to '$main_branch')."
    exit 0
  fi

  # Merge to local main flow
  # Ensure any working changes on current branch are committed first (or empty commit)
  echo "Ensuring current branch has a commit for merge..."
  commit_all_or_empty "$msg"

  merge_branch_into_main "$current_branch" "$msg"

  if confirm "Push to '$remote/$main_branch' now? [y/N] "; then
    maybe_push_main
    verify_apphosting_backend_studio || true
  else
    echo "Skipped push to remote. Local '$main_branch' updated."
  fi
}

main "$@"
