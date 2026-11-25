use framework "AppKit"
use scripting additions

on run arguments
	set projectPath to item 1 of arguments
	set codexPath to item 2 of arguments
	set startCodex to "cd " & quoted form of projectPath & " && " & quoted form of codexPath & " --cd " & quoted form of projectPath

	-- AppKit uses a bottom-left origin. Terminal bounds use the top-left.
	set primaryDisplay to (current application's NSScreen's screens()'s objectAtIndex:0)
	set {{displayX, displayY}, {displayWidth, displayHeight}} to (primaryDisplay's frame() as list)
	set {{screenX, screenY}, {screenWidth, screenHeight}} to (primaryDisplay's visibleFrame() as list)
	set firstRow to (displayY + displayHeight - screenY - screenHeight) as integer
	set lastRow to (displayY + displayHeight - screenY) as integer
	tell application "Terminal" to activate
	set terminalProcess to (current application's NSRunningApplication's runningApplicationsWithBundleIdentifier:"com.apple.Terminal")'s objectAtIndex:0
	set terminalPID to terminalProcess's processIdentifier() as text
	set windowRecords to terminalPID & linefeed
	set reuseWindows to false
	if (count arguments) > 2 then set reuseWindows to (item 3 of arguments is terminalPID)

	tell application "Terminal"
		repeat with columnNumber from 1 to 3
			set agentTitle to "Spellside Cup · Codex " & columnNumber
			set agentWindow to missing value
			if reuseWindows and (count arguments) is greater than or equal to columnNumber + 3 then
				set previousID to (item (columnNumber + 3) of arguments) as integer
				if exists window id previousID then set agentWindow to window id previousID
			end if

			if agentWindow is missing value then
				set existingIDs to id of every window
				do script startCodex
				repeat with candidate in windows
					set candidateID to id of candidate
					if candidateID is not in existingIDs then
						set agentWindow to window id candidateID
						exit repeat
					end if
				end repeat
				if agentWindow is missing value then error "Terminal did not open a separate Codex window."
				set custom title of selected tab of agentWindow to agentTitle
				set title displays custom title of selected tab of agentWindow to true
			else if not busy of selected tab of agentWindow then
				do script startCodex in selected tab of agentWindow
			end if

			set firstColumn to (screenX + screenWidth * (columnNumber - 1) / 3) as integer
			set lastColumn to (screenX + screenWidth * columnNumber / 3) as integer
			set miniaturized of agentWindow to false
			set bounds of agentWindow to {firstColumn, firstRow, lastColumn, lastRow}
			set windowRecords to windowRecords & (id of agentWindow) & linefeed
		end repeat
	end tell
	return windowRecords
end run
