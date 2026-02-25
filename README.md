# ST-group-trigger

SillyTavern extension that adds clickable group-member icons as shortcuts for `/trigger` in group chats.

## Features
- Adds a compact icon row in the top-left area of the main message bar, to the right of existing message-bar icons.
- Includes an `All` icon that runs `/trigger` for all members.
- Adds one circular icon per group member that runs `/trigger <character>`.
- Disables group auto-replies while the extension is active in a group chat.
- Restores the previous auto-reply state when the extension unloads.

## Installation
1. In SillyTavern, open **Extensions**.
2. Install this repository as a third-party extension.
3. Reload SillyTavern.

## Usage
- Open a group chat.
- Click **All** to trigger all characters.
- Click a character icon to trigger only that character.
- Enable or disable the extension from SillyTavern's Extensions UI.
