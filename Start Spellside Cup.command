#!/bin/zsh -l
set -eu

export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
project_dir=${0:A:h}
game_path=/html/soccer-rogue.html
game_url="http://localhost:8080${game_path}"
server_session=spellside-server

cd "$project_dir"
for dependency in codex npm tmux; do
  if ! command -v "$dependency" >/dev/null; then
    print -u2 "Spellside Cup needs $dependency on your PATH."
    exit 1
  fi
done

game_is_ready() {
  curl -fsS --max-time 1 "$game_url" 2>/dev/null | cmp -s "$project_dir$game_path" -
}

if ! game_is_ready && ! tmux has-session -t "=$server_session" 2>/dev/null; then
  npm_bin=$(whence -p npm)
  tmux new-session -d -s "$server_session" -c "$project_dir" \
    /usr/bin/env "PATH=$PATH" "$npm_bin" run dev -- -a 127.0.0.1
fi

window_state="${TMPDIR:-/tmp}/spellside-codex-window-ids-$UID"
previous_windows=()
if [[ -s $window_state ]]; then
  previous_windows=("${(@f)$(<"$window_state")}")
fi
current_windows=$(/usr/bin/osascript "$project_dir/scripts/spellside-terminals.applescript" \
  "$project_dir" "$(whence -p codex)" "${previous_windows[@]}")
print -r -- "$current_windows" > "$window_state"

for attempt in {1..30}; do
  if game_is_ready; then
    exec /usr/bin/osascript "$project_dir/scripts/spellside-playtest.applescript" "$game_url"
  fi
  sleep 1
done

print -u2 "Spellside Cup did not respond at $game_url."
exit 1
