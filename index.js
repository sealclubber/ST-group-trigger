import { extension_settings, getContext } from "../../extensions.js";
import { eventSource, event_types, saveSettingsDebounced } from "../../../script.js";

const EXTENSION_NAME = "ST-group-trigger";
const SETTINGS = {
  enabled: true,
};

const SELECTOR_CANDIDATES = [
  "#chat_header .fa-bookmark",
  "#chat_header .fa-users",
  "#chat_header .fa-user",
  "#chat_header .menu_button",
  "#chat_header",
  "#chat",
];

let cachedAutoReplyState = null;

function loadSettings() {
  extension_settings[EXTENSION_NAME] = extension_settings[EXTENSION_NAME] || {};
  Object.assign(SETTINGS, extension_settings[EXTENSION_NAME]);
  extension_settings[EXTENSION_NAME] = SETTINGS;
}

function saveSettings() {
  extension_settings[EXTENSION_NAME] = SETTINGS;
  saveSettingsDebounced();
}

function ensureContainers() {
  let row = document.querySelector("#st-group-trigger-row");
  if (row) return row;

  const anchor = SELECTOR_CANDIDATES
    .map((selector) => document.querySelector(selector))
    .find(Boolean);

  if (!anchor) return null;

  row = document.createElement("div");
  row.id = "st-group-trigger-row";

  const toggle = document.createElement("button");
  toggle.id = "st-group-trigger-toggle";
  toggle.className = "menu_button";
  toggle.type = "button";
  toggle.title = "Enable/disable Group Trigger Icons extension";
  toggle.addEventListener("click", () => {
    SETTINGS.enabled = !SETTINGS.enabled;
    onEnabledStateChanged();
    saveSettings();
  });

  const icons = document.createElement("div");
  icons.id = "st-group-trigger-icons";

  row.append(toggle, icons);

  const parent = anchor.parentElement || anchor;
  parent.appendChild(row);

  return row;
}

function getCurrentGroup(context) {
  const groupId = context.groupId ?? context.group_id ?? context.chatId ?? null;
  if (!groupId) return null;

  if (Array.isArray(context.groups)) {
    return context.groups.find((group) => `${group.id}` === `${groupId}`) || null;
  }

  return null;
}

function getAvatarUrl(character) {
  if (!character?.avatar) return "";
  if (/^https?:\/\//.test(character.avatar) || character.avatar.startsWith("data:")) {
    return character.avatar;
  }

  return `/characters/${character.avatar}`;
}

function createIconButton({ title, label, avatarUrl, clickHandler, className = "" }) {
  const button = document.createElement("button");
  button.className = `st-group-trigger-icon ${className}`.trim();
  button.type = "button";
  button.title = title;
  button.setAttribute("aria-label", title);

  if (avatarUrl) {
    const image = document.createElement("img");
    image.src = avatarUrl;
    image.alt = label;
    image.loading = "lazy";
    button.appendChild(image);
  } else {
    const fallback = document.createElement("span");
    fallback.textContent = label;
    button.appendChild(fallback);
  }

  button.addEventListener("click", clickHandler);
  return button;
}

async function triggerCharacter(characterName = "") {
  const context = getContext();
  const suffix = characterName ? ` ${characterName}` : "";
  const command = `/trigger${suffix}`;

  if (typeof context.executeSlashCommands === "function") {
    await context.executeSlashCommands(command);
    return;
  }

  const textarea = document.querySelector("#send_textarea");
  const sendButton = document.querySelector("#send_but");

  if (!textarea || !sendButton) return;

  textarea.value = command;
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  sendButton.click();
}

function findAutoReplyToggle() {
  const selectors = [
    "#rm_group_chat_auto_mode",
    "#group_chat_auto_mode",
    "#groupchat-auto-mode",
    "input[name='group_auto_mode']",
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) return element;
  }

  return null;
}

function setGroupAutoReply(enabled) {
  const context = getContext();
  if (!getCurrentGroup(context)) return;

  const toggle = findAutoReplyToggle();
  if (!toggle) return;

  if (toggle.checked === enabled) return;
  toggle.checked = enabled;
  toggle.dispatchEvent(new Event("input", { bubbles: true }));
  toggle.dispatchEvent(new Event("change", { bubbles: true }));
}

function onEnabledStateChanged() {
  const row = ensureContainers();
  const toggle = row?.querySelector("#st-group-trigger-toggle");
  const icons = row?.querySelector("#st-group-trigger-icons");
  const isOn = SETTINGS.enabled;

  if (toggle) {
    toggle.textContent = isOn ? "Trigger Icons: ON" : "Trigger Icons: OFF";
    toggle.classList.toggle("st-group-trigger-toggle-off", !isOn);
  }

  if (icons) {
    icons.style.display = isOn ? "flex" : "none";
  }

  if (isOn) {
    const autoToggle = findAutoReplyToggle();
    if (autoToggle && cachedAutoReplyState === null) {
      cachedAutoReplyState = autoToggle.checked;
    }
    setGroupAutoReply(false);
  } else {
    if (cachedAutoReplyState !== null) {
      setGroupAutoReply(cachedAutoReplyState);
    } else {
      setGroupAutoReply(true);
    }
  }
}

function getMemberCharacter(member, allCharacters) {
  if (!Array.isArray(allCharacters)) return null;

  return allCharacters.find((character) => {
    const options = [character.avatar, character.name, character.id].filter(Boolean).map(String);
    return options.includes(String(member));
  }) || null;
}

function render() {
  const row = ensureContainers();
  if (!row) return;

  const icons = row.querySelector("#st-group-trigger-icons");
  if (!icons) return;

  const context = getContext();
  const group = getCurrentGroup(context);

  row.style.display = group ? "inline-flex" : "none";
  if (!group) return;

  icons.replaceChildren();

  icons.appendChild(
    createIconButton({
      title: "Trigger all characters",
      label: "All",
      clickHandler: () => triggerCharacter(),
      className: "st-group-trigger-all",
    }),
  );

  const members = Array.isArray(group.members) ? group.members : [];

  for (const member of members) {
    const character = getMemberCharacter(member, context.characters);
    const characterName = character?.name || String(member);
    const avatarUrl = getAvatarUrl(character);

    icons.appendChild(
      createIconButton({
        title: `Trigger ${characterName}`,
        label: characterName.slice(0, 2).toUpperCase(),
        avatarUrl,
        clickHandler: () => triggerCharacter(characterName),
      }),
    );
  }

  onEnabledStateChanged();
}

function registerEvents() {
  const rerender = () => render();
  const eventCandidates = [
    event_types.CHAT_CHANGED,
    event_types.GROUP_UPDATED,
    event_types.GROUP_CHAT_CREATED,
    event_types.GROUP_CHAT_DELETED,
    event_types.CHARACTER_PAGE_LOADED,
    event_types.MESSAGE_RECEIVED,
    event_types.MESSAGE_SENT,
  ].filter(Boolean);

  for (const eventName of eventCandidates) {
    eventSource.on(eventName, rerender);
  }
}

(function init() {
  loadSettings();
  registerEvents();
  render();
})();
