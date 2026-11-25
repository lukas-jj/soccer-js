on run arguments
	set gameURL to item 1 of arguments
	tell application "Google Chrome"
		set gameWindow to missing value
		repeat with candidate in windows
			if (count of tabs of candidate) is 1 then
				if URL of active tab of candidate is gameURL then
					set gameWindow to contents of candidate
					exit repeat
				end if
			end if
		end repeat
		if gameWindow is missing value then
			set gameWindow to make new window
			set URL of active tab of gameWindow to gameURL
		end if
		set minimized of gameWindow to false
		set index of gameWindow to 1
		set gameWindowID to id of gameWindow
		activate
	end tell

	repeat 100 times
		tell application "Google Chrome" to set gameIsFrontmost to (id of window 1 is gameWindowID)
		if gameIsFrontmost then
			tell application "System Events" to tell process "Google Chrome"
				set frontmost to true
				set viewMenu to menu 1 of menu bar item "View" of menu bar 1
				if exists menu item "Exit Full Screen" of viewMenu then return
				if exists menu item "Enter Full Screen" of viewMenu then
					click menu item "Enter Full Screen" of viewMenu
					delay 1
					if exists menu item "Exit Full Screen" of viewMenu then return
				end if
			end tell
		end if
		delay 0.1
	end repeat
	error "Chrome did not confirm that the playtest window entered full screen."
end run
