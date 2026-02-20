const XP_STYLES = `
/* ── Base ── */
.xp-theme {
    font-family: system-ui, Tahoma, "Segoe UI", sans-serif;
    color: #000;
    color-scheme: light;
    position: relative;
    min-height: 100vh;
    padding-bottom: 44px;
    background: #3a6ea5 center/cover fixed no-repeat;
    overflow-x: hidden;
}
.xp-theme h1,.xp-theme h2,.xp-theme h3 { font-family: "Pixelify Sans", system-ui, sans-serif; }
.xp-text { font-family: system-ui, Tahoma, "Segoe UI", sans-serif; font-size: 12px; color: #000; line-height: 1.4; }

/* ── Dino window ── */
.xp-dino-window {
    z-index: 10;
    width: min(900px, 92vw) !important;
}

/* ── Desktop Icons ── */
.xp-desktop-icons {
    position: absolute; top: 0; left: 0; right: 0; bottom: 44px;
    z-index: 1; pointer-events: none;
}
.xp-desktop-icon {
    display: flex; flex-direction: column; align-items: center; gap: 3px;
    padding: 4px 2px; border-radius: 3px; cursor: default;
    width: 88px;
    user-select: none;
    touch-action: none;
    pointer-events: auto;
}
.xp-desktop-icon:hover,
.xp-desktop-icon-selected { background: rgba(55,100,180,0.3); }
.xp-desktop-icon:hover .xp-desktop-icon-label,
.xp-desktop-icon-selected .xp-desktop-icon-label { background: #316ac5; color: #fff; }
.xp-desktop-icon-img-wrap {
    width: 64px; height: 64px;
    overflow: hidden;
    border: 2px outset #d4d0c8; background: #c0c0c0;
    box-shadow: 1px 1px 0 rgba(0,0,0,0.3);
    position: relative;
}
.xp-desktop-icon-img {
    /* Render at 3x3 then scale to fill = ultra chunky pixels */
    width: 3px; height: 3px; object-fit: cover;
    image-rendering: pixelated;
    transform: scale(22);
    transform-origin: top left;
    position: absolute; top: 0; left: 0;
    filter: contrast(1.4) saturate(0.65);
}
/* XP shortcut arrow overlay (bottom-left) */
.xp-shortcut-img {
    position: absolute; bottom: 0; left: 0;
    width: 22px; height: 22px;
    object-fit: contain;
    z-index: 2; pointer-events: none;
}
.xp-desktop-icon-label {
    font-family: "Pixelify Sans", system-ui, sans-serif;
    font-size: 11px; color: #fff;
    text-shadow: 1px 1px 2px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.7);
    text-align: center; line-height: 1.2;
    padding: 1px 3px; border-radius: 1px;
    max-width: 84px;
    overflow: hidden; text-overflow: ellipsis;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}

/* ── Window Chrome ── */
.xp-window {
    border-radius: 8px 8px 0 0;
    overflow: hidden;
    box-shadow: 2px 3px 12px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(166,202,240,0.4);
    border: 1px solid #0054e3;
}
.xp-title-bar {
    background: linear-gradient(180deg,
        #0997ff 0%, #0053ee 8%, #0050ee 20%,
        #1a6cff 50%, #0048dd 52%,
        #0054ee 85%, #0264ff 100%
    );
    padding: 3px 6px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 26px;
    user-select: none;
}
.xp-title-text {
    font-family: "Pixelify Sans", system-ui, sans-serif;
    color: #fff; font-weight: 700; font-size: 13px;
    text-shadow: 1px 1px 2px rgba(0,0,0,0.4);
}
.xp-title-btn {
    width: 21px; height: 21px; border-radius: 3px;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: bold; cursor: default; line-height: 1; color: #fff;
}
.xp-tbtn-min,.xp-tbtn-max {
    background: linear-gradient(180deg, #3c8eff 0%, #2663de 45%, #1a4cc0 50%, #2157d4 100%);
    border: 1px solid rgba(255,255,255,0.3);
}
.xp-tbtn-x {
    background: linear-gradient(180deg, #e88c6c 0%, #d05040 45%, #c13b2a 50%, #d4533f 100%);
    border: 1px solid rgba(255,255,255,0.3);
}
.xp-window-body { background: #ece9d8; padding: 4px; }

/* ── Draggable + Resizable Window ── */
.xp-window-draggable {
    position: absolute;
    width: min(800px, 92vw);
}
.xp-window-body-scroll {
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #a0a0a0 #ece9d8;
}
.xp-main-window { z-index: 20; }

/* ── Resize Handle ── */
.xp-resize-handle {
    position: absolute; right: 0; bottom: 0;
    width: 16px; height: 16px; cursor: nwse-resize;
    background:
        linear-gradient(135deg,
            transparent 0%, transparent 40%,
            #808080 40%, #808080 45%,
            transparent 45%, transparent 55%,
            #808080 55%, #808080 60%,
            transparent 60%, transparent 70%,
            #808080 70%, #808080 75%,
            transparent 75%
        );
    opacity: 0.6;
    z-index: 5;
}
.xp-resize-handle:hover { opacity: 1; }

/* ── Tabs ── */
.xp-tab-bar {
    display: flex; gap: 0;
    border-bottom: 1px solid #7f9db9;
    padding-left: 4px;
}
.xp-tab {
    font-family: system-ui, Tahoma, sans-serif;
    font-size: 11px; padding: 4px 14px;
    background: #d6d0c4; border: 1px solid #7f9db9;
    border-bottom: none; border-radius: 4px 4px 0 0;
    cursor: pointer; position: relative; top: 1px; color: #000; margin-right: -1px;
}
.xp-tab:hover { background: #e8e4d8; }
.xp-tab-active { background: #ece9d8; border-bottom: 1px solid #ece9d8; font-weight: bold; z-index: 1; }
.xp-tab-content { border: 1px solid #7f9db9; border-top: none; background: #ece9d8; padding: 6px; min-height: 120px; }

/* ── Buttons ── */
.xp-btn {
    font-family: system-ui, Tahoma, sans-serif; font-size: 11px;
    padding: 2px 10px; border-radius: 3px; cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center; gap: 3px;
    background: linear-gradient(180deg, #fff 0%, #ece9d8 80%, #d6d0c4 100%);
    border: 1px solid #003c74; color: #000;
    box-shadow: inset 0 1px 0 #fff, 0 1px 0 rgba(0,0,0,0.1);
}
.xp-btn:hover { background: linear-gradient(180deg, #fff8e8, #f0e8d8); }
.xp-btn:active { background: linear-gradient(180deg, #d6d0c4, #ccc6b8); box-shadow: inset 0 1px 2px rgba(0,0,0,0.2); }
.xp-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.xp-btn-primary {
    background: linear-gradient(180deg, #4fa0e8 0%, #2570c4 100%);
    border: 1px solid #003c9a; color: #fff; font-weight: bold;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.3);
    text-shadow: 0 1px 1px rgba(0,0,0,0.3);
}
.xp-btn-primary:hover { background: linear-gradient(180deg, #5cb0f0, #2d7ad4); }
.xp-btn-primary:active { background: linear-gradient(180deg, #2060b0, #1a50a0); }
.xp-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.xp-btn-danger {
    background: linear-gradient(180deg, #ff8080 0%, #cc3030 100%);
    border: 1px solid #800000; color: #fff; font-weight: bold; font-size: 11px;
    padding: 2px 10px; border-radius: 3px; cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center;
    text-shadow: 0 1px 1px rgba(0,0,0,0.3);
}
.xp-btn-danger:hover { background: linear-gradient(180deg, #ff9090, #dd4040); }
.xp-btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── Inputs ── */
.xp-input {
    font-family: system-ui, Tahoma, sans-serif; font-size: 12px;
    padding: 3px 5px; background: #fff;
    border: 2px solid; border-color: #7f9db9 #f0f0f0 #f0f0f0 #7f9db9;
    border-radius: 0; color: #000; outline: none;
}
.xp-input:focus { border-color: #0058e6 #c0c0c0 #c0c0c0 #0058e6; }
.xp-input::placeholder { color: #999; }
.xp-select {
    font-family: system-ui, Tahoma, sans-serif; font-size: 11px;
    padding: 2px 18px 2px 5px; background: #fff;
    border: 2px solid; border-color: #7f9db9 #f0f0f0 #f0f0f0 #7f9db9;
    color: #000; border-radius: 0; appearance: auto; cursor: pointer;
}
.xp-radio-label { display: flex; align-items: center; gap: 5px; cursor: pointer; padding: 1px 0; }
.xp-radio { accent-color: #0058e6; cursor: pointer; }

/* ── Fieldset ── */
.xp-fieldset {
    border: 2px groove #d4d0c8; border-radius: 0;
    padding: 6px 8px; margin-bottom: 6px;
}
.xp-fieldset-legend {
    font-family: system-ui, Tahoma, sans-serif;
    font-size: 11px; font-weight: bold; color: #000; padding: 0 3px;
}

/* ── Badges ── */
.xp-badge {
    display: inline-flex; align-items: center; gap: 2px;
    padding: 1px 5px; font-family: system-ui, Tahoma, sans-serif;
    font-size: 10px; font-weight: bold; border: 1px solid; border-radius: 2px; white-space: nowrap;
}
.xp-badge-blue { background: #c0d8ff; border-color: #5580c0; color: #003080; }
.xp-badge-red { background: #ffc8c8; border-color: #c05555; color: #800000; }
.xp-badge-orange { background: #ffe0b0; border-color: #c08030; color: #804000; }
.xp-badge-purple { background: #e0c8ff; border-color: #8055c0; color: #400080; }
.xp-badge-green { background: #c8ffc8; border-color: #55c055; color: #004000; }
.xp-badge-amber { background: #fff0c0; border-color: #c0a030; color: #604000; }
.xp-badge-gray { background: #e0e0e0; border-color: #808080; color: #404040; }

/* ── Scrim Card ── */
.xp-scrim-card {
    background: #fff; border: 1px solid #c0c0c0;
    padding: 8px 10px; position: relative;
}
.xp-scrim-card:hover { background: #eff4ff; }

/* Desktop: logo left, content fills, actions right */
.xp-scrim-layout {
    display: grid;
    grid-template-columns: auto 1fr auto;
    grid-template-rows: auto auto auto;
    gap: 0 12px;
}
.xp-scrim-header {
    grid-column: 1 / 3; grid-row: 1;
    display: flex; align-items: flex-start; gap: 8px; min-width: 0;
    margin-bottom: 2px;
}
.xp-scrim-meta-inline { margin-top: 1px; }
.xp-scrim-body {
    grid-column: 1 / 3; grid-row: 2;
    padding-left: 55px; /* logo 47px + gap */
    min-width: 0;
}
.xp-scrim-footer {
    grid-column: 1 / 3; grid-row: 3;
    padding-left: 55px;
}
.xp-scrim-actions {
    grid-column: 3; grid-row: 1 / 4;
    display: flex; flex-direction: column; gap: 4px; align-items: flex-end;
    align-self: start;
}

/* ── Team & League links ── */
.xp-team-link {
    font-weight: 700; font-size: 13px; color: #1563b8;
    text-decoration: none; line-height: 1.2;
}
.xp-team-link:hover { text-decoration: underline; color: #0d46a0; }
.xp-league-link {
    font-size: 10px; color: #1563b8; text-decoration: none; font-weight: 600;
}
.xp-league-link:hover { text-decoration: underline; color: #0d46a0; }

/* ── Tier badges — per-tier colors ── */
/* 1=Deity(gold) 2=Demigod(purple) 3=Master(teal) 4=Obsidian(navy) 5=Diamond(cyan) */
.xp-tier-badge-1 { background: #fff0c0; border-color: #c0a030; color: #6a4400; }
.xp-tier-badge-2 { background: #f0d8ff; border-color: #8030c0; color: #400070; }
.xp-tier-badge-3 { background: #c8ffe8; border-color: #2a9065; color: #004030; }
.xp-tier-badge-4 { background: #c8d8ff; border-color: #2060c0; color: #002060; }
.xp-tier-badge-5 { background: #c0f4ff; border-color: #0098b8; color: #004050; }

/* ── Export button ── */
.xp-export-btn {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 2px 9px; font-size: 10px; font-weight: 600; cursor: pointer;
    font-family: system-ui, Tahoma, sans-serif; border-radius: 2px;
    background: linear-gradient(180deg, #f0f0ea 0%, #dcdcd4 100%);
    border: 1px solid; border-color: #fff #a0a090 #a0a090 #fff;
    box-shadow: 1px 1px 0 rgba(0,0,0,0.15); color: #000; white-space: nowrap;
}
.xp-export-btn:hover {
    background: linear-gradient(180deg, #fafaf2 0%, #e8e8e0 100%);
    border-color: #c8c8c0 #808078 #808078 #c8c8c0;
}
.xp-export-btn:active {
    background: linear-gradient(180deg, #d0d0c8 0%, #e0e0d8 100%);
    border-color: #808078 #c8c8c0 #c8c8c0 #808078;
    box-shadow: inset 1px 1px 2px rgba(0,0,0,0.15);
}

/* ── Scrim footer ── */
.xp-scrim-footer {
    display: flex; align-items: center; justify-content: space-between;
    padding-top: 5px; margin-top: 5px;
    border-top: 1px solid #e0ddd8;
}

/* ── Listbox ── */
.xp-listbox { background: #fff; border: 2px solid; border-color: #7f9db9 #f0f0f0 #f0f0f0 #7f9db9; }
.xp-listbox-item {
    display: flex; align-items: center; gap: 5px; width: 100%;
    padding: 3px 6px; font-family: system-ui, Tahoma, sans-serif;
    font-size: 11px; color: #000; cursor: pointer; border: none; background: transparent; text-align: left;
}
.xp-listbox-item:hover { background: #316ac5; color: #fff; }

/* ── Progress Bar ── */
.xp-progress {
    width: 200px; height: 16px; background: #fff;
    border: 2px solid; border-color: #7f9db9 #f0f0f0 #f0f0f0 #7f9db9;
    overflow: hidden; position: relative;
}
.xp-progress-bar {
    position: absolute; height: 100%; width: 30%;
    background: repeating-linear-gradient(90deg, #3a8cf2 0px, #3a8cf2 8px, #5ba3e8 8px, #5ba3e8 10px);
    animation: xp-slide 1.5s ease-in-out infinite;
}
@keyframes xp-slide { 0% { left: -30%; } 100% { left: 100%; } }

/* ── Error Icon ── */
.xp-error-icon {
    width: 22px; height: 22px; border-radius: 50%; background: #cc0000;
    color: #fff; font-weight: bold; font-size: 13px;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}

/* ── Taskbar ── */
.xp-taskbar {
    position: fixed; bottom: 0; left: 0; right: 0; height: 38px;
    background: linear-gradient(180deg,
        #3168d5 0%, #2456c7 2%, #1d4aba 48%,
        #1941a5 50%, #1d4aba 98%, #3168d5 100%
    );
    border-top: 2px solid #0c3daa;
    display: flex; align-items: center; padding: 0 4px; gap: 2px;
    z-index: 50;
}
.xp-start-btn {
    background: linear-gradient(180deg,
        #4aad22 0%, #3c9a16 2%, #328e14 48%,
        #2d8212 50%, #3c9a16 98%, #4aad22 100%
    );
    border: 1px solid #2a7510; border-radius: 0 8px 8px 0;
    color: #fff; font-weight: bold; font-size: 15px;
    font-family: "Pixelify Sans", system-ui, sans-serif;
    padding: 2px 14px 2px 6px;
    display: flex; align-items: center; gap: 5px;
    text-shadow: 1px 1px 1px rgba(0,0,0,0.5);
    cursor: pointer; height: 32px;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.2);
}
.xp-start-btn:hover { filter: brightness(1.08); }
.xp-start-pressed {
    background: linear-gradient(180deg,
        #3c8a14 0%, #2d7510 2%, #256a0e 48%,
        #216310 50%, #2d7510 98%, #3c8a14 100%
    ) !important;
    box-shadow: inset 0 2px 3px rgba(0,0,0,0.3) !important;
}
.xp-start-flag {
    font-size: 16px; line-height: 1;
}

/* ── Start Menu ── */
.xp-start-menu {
    position: absolute; bottom: 100%; left: 0;
    margin-bottom: 2px; width: 240px;
    background: #fff; border: 2px solid #0054e3;
    border-radius: 8px 8px 0 0;
    box-shadow: 3px 3px 12px rgba(0,0,0,0.4);
    overflow: hidden;
    z-index: 100;
}
.xp-start-menu-banner {
    background: linear-gradient(180deg, #2062d0 0%, #1349a0 100%);
    padding: 8px 10px; display: flex; align-items: center;
}
.xp-start-menu-banner-text {
    font-family: "Pixelify Sans", system-ui, sans-serif;
    font-size: 16px; font-weight: 700; color: #fff;
    text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
}
.xp-start-menu-body { padding: 4px 0; }
.xp-start-menu-item {
    display: flex; align-items: center; gap: 10px;
    padding: 6px 12px; width: 100%;
    font-family: system-ui, Tahoma, sans-serif;
    font-size: 12px; color: #000;
    text-decoration: none; cursor: pointer;
    border: none; background: transparent;
}
.xp-start-menu-item:hover { background: #316ac5; color: #fff; }
.xp-start-menu-item-icon-wrap {
    width: 28px; height: 28px; overflow: hidden; position: relative;
    flex-shrink: 0;
}
.xp-start-menu-icon {
    width: 7px; height: 7px; object-fit: contain;
    image-rendering: pixelated;
    transform: scale(4);
    transform-origin: top left;
    position: absolute; top: 0; left: 0;
    filter: contrast(1.15) saturate(0.85);
}

.xp-taskbar-divider {
    width: 2px; height: 24px; margin: 0 4px;
    border-left: 1px solid rgba(0,0,0,0.2);
    border-right: 1px solid rgba(255,255,255,0.15);
}
.xp-taskbar-window-btn {
    font-family: system-ui, Tahoma, sans-serif;
    font-size: 11px; color: #fff;
    display: flex; align-items: center; gap: 4px;
    padding: 3px 12px; height: 26px;
    border-radius: 2px; cursor: default;
    background: rgba(0,0,0,0.15);
    border: 1px solid rgba(255,255,255,0.15);
    min-width: 140px;
    text-shadow: 0 1px 1px rgba(0,0,0,0.4);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
}
.xp-taskbar-window-active {
    background: rgba(255,255,255,0.12);
    border: 1px solid rgba(255,255,255,0.25);
    box-shadow: inset 0 0 4px rgba(255,255,255,0.1);
}
.xp-taskbar-window-minimized {
    background: rgba(0,0,0,0.25);
    border: 1px solid rgba(255,255,255,0.1);
    box-shadow: inset 1px 1px 3px rgba(0,0,0,0.5);
}
.xp-taskbar-window-minimized:hover {
    background: rgba(255,255,255,0.08);
    border-color: rgba(255,255,255,0.2);
}

.xp-tray {
    display: flex; align-items: center; gap: 6px;
    background: linear-gradient(180deg, #0f8bef 0%, #0670d4 50%, #0050b0 100%);
    border-left: 2px solid rgba(0,0,0,0.2);
    padding: 0 10px; height: 100%; margin-left: 4px;
}
.xp-tray-text { font-size: 10px; color: rgba(255,255,255,0.8); }
.xp-tray-divider {
    width: 1px; height: 18px;
    border-left: 1px solid rgba(0,0,0,0.2);
    border-right: 1px solid rgba(255,255,255,0.1);
}
.xp-tray-clock {
    font-family: system-ui, Tahoma, sans-serif;
    font-size: 11px; color: #fff; white-space: nowrap;
}

/* ── Coin Flip Window ── */
.xp-coinflip-window {
    z-index: 15;
    width: 240px !important;
}
.xp-coin-wrap {
    width: 80px; height: 80px;
    border: 2px outset #d4d0c8; background: #c0c0c0;
    box-shadow: 1px 1px 0 rgba(0,0,0,0.3);
    overflow: hidden; position: relative;
    transition: transform 0.1s linear;
}
.xp-coin-img {
    width: 6px; height: 6px; object-fit: contain;
    image-rendering: pixelated;
    transform: scale(14);
    transform-origin: top left;
    position: absolute; top: 0; left: 0;
    filter: contrast(1.15) saturate(0.85);
}

/* ── Scrollbar (XP style) ── */
.xp-window-body-scroll::-webkit-scrollbar { width: 17px; }
.xp-window-body-scroll::-webkit-scrollbar-track { background: #ece9d8; border-left: 1px solid #c0c0c0; }
.xp-window-body-scroll::-webkit-scrollbar-thumb {
    background: linear-gradient(90deg, #ece9d8 0%, #d6d0c4 40%, #c0bab0 100%);
    border: 1px solid #808080; border-radius: 0;
}
.xp-window-body-scroll::-webkit-scrollbar-thumb:hover { background: #d0ccc0; }
.xp-window-body-scroll::-webkit-scrollbar-button { background: #ece9d8; border: 1px solid #808080; height: 17px; }

/* ── Wizard (XP Installer) ── */
.xp-wizard { display: flex; flex-direction: column; }
.xp-wizard-body { display: flex; min-height: 260px; }
.xp-wizard-sidebar {
    width: 130px; flex-shrink: 0;
    background: linear-gradient(180deg, #5989c7 0%, #3a6ea5 100%);
    padding: 14px 6px; border-right: 1px solid #7f9db9;
}
.xp-wizard-step-item {
    font-family: system-ui, Tahoma, sans-serif; font-size: 10px;
    color: rgba(255,255,255,0.5); padding: 3px 5px; margin-bottom: 1px;
    border-radius: 2px; display: flex; align-items: center; gap: 5px;
}
.xp-wizard-step-item-active { color: #fff; font-weight: bold; background: rgba(255,255,255,0.15); }
.xp-wizard-step-item-done { color: rgba(255,255,255,0.75); }
.xp-wizard-step-num {
    width: 16px; height: 16px; border-radius: 50%; font-size: 9px;
    display: flex; align-items: center; justify-content: center;
    background: rgba(255,255,255,0.2); font-weight: bold; flex-shrink: 0;
}
.xp-wizard-step-item-active .xp-wizard-step-num { background: #fff; color: #0054e3; }
.xp-wizard-step-item-done .xp-wizard-step-num { background: rgba(255,255,255,0.35); }
.xp-wizard-content { flex: 1; padding: 10px 12px; overflow-y: auto; max-height: 360px; }
.xp-wizard-footer {
    display: flex; align-items: center; justify-content: space-between;
    padding: 5px 8px; border-top: 2px groove #d4d0c8; background: #ece9d8;
}
.xp-wizard-mobile-step { display: none; }

/* ── Calendar ── */
.xp-calendar { border: 2px solid; border-color: #7f9db9 #f0f0f0 #f0f0f0 #7f9db9; background: #fff; }
.xp-calendar-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 3px 6px; background: linear-gradient(180deg, #0997ff 0%, #0054ee 100%);
    color: #fff; font-weight: bold;
}
.xp-calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); }
.xp-calendar-day-header {
    text-align: center; font-size: 10px; font-weight: bold;
    padding: 3px; color: #555; background: #ece9d8;
    border-bottom: 1px solid #c0c0c0;
}
.xp-calendar-day {
    text-align: center; padding: 5px 2px; font-size: 11px;
    cursor: pointer; border: 1px solid transparent; position: relative;
    font-family: system-ui, Tahoma, sans-serif; color: #000;
}
.xp-calendar-day:hover { background: #eff4ff; border-color: #316ac5; }
.xp-calendar-day-selected { background: #316ac5 !important; color: #fff !important; font-weight: bold; }
.xp-calendar-day-today { border-color: #0054e3; font-weight: bold; }
.xp-calendar-day-past { color: #c0c0c0 !important; cursor: default; }
.xp-calendar-day-past:hover { background: transparent; border-color: transparent; }
.xp-calendar-day-scrim::after {
    content: ''; position: absolute; bottom: 1px; left: 50%; transform: translateX(-50%);
    width: 5px; height: 5px; border-radius: 50%; background: #ff6600;
}

/* ── Time Picker ── */
.xp-time-select {
    font-family: system-ui, Tahoma, sans-serif; font-size: 14px;
    padding: 4px 6px; background: #fff;
    border: 2px solid; border-color: #7f9db9 #f0f0f0 #f0f0f0 #7f9db9;
    color: #000; text-align: center; width: 52px; cursor: pointer;
}
.xp-time-colon { font-size: 18px; font-weight: bold; color: #000; }

/* ── Checkbox (XP style) ── */
.xp-checkbox-label {
    display: flex; align-items: center; gap: 5px; cursor: pointer;
    padding: 2px 0; font-family: system-ui, Tahoma, sans-serif; font-size: 11px;
}
.xp-checkbox { accent-color: #0058e6; cursor: pointer; }

/* ── Blacklist Window ── */
.xp-blacklist-window {
    z-index: 13;
    width: 280px !important;
    min-height: 200px;
}
.xp-blacklist-window .xp-window-body {
    padding: 0 !important;
}

/* ── Impersonation Window ── */
.xp-impersonate-window {
    z-index: 14;
    width: 260px !important;
}
.xp-impersonate-window .xp-window-body {
    padding: 0 !important;
}
.xp-taskbar-impersonating {
    background: linear-gradient(180deg, #ffc107, #e6a800) !important;
    color: #000 !important;
    font-weight: bold;
}

/* ── Help Window ── */
.xp-help-window {
    z-index: 16;
    width: 360px !important;
    max-height: 500px;
}
.xp-help-window .xp-window-body {
    padding: 0 !important;
}

/* ── Copy Button ── */
.xp-copy-btn {
    background: none; border: 1px solid transparent; color: #666; cursor: pointer;
    padding: 1px 3px; border-radius: 2px; display: inline-flex; align-items: center; gap: 2px;
    font-family: system-ui, Tahoma, sans-serif; line-height: 1;
}
.xp-copy-btn:hover {
    border-color: #999; background: #f0f0f0; color: #333;
}

/* ── Copied Toast ── */
.xp-copy-toast {
    position: fixed; bottom: 60px; left: 50%; transform: translateX(-50%);
    background: #333; color: #fff; padding: 6px 16px; border-radius: 4px;
    font-family: system-ui, Tahoma, sans-serif; font-size: 12px;
    opacity: 0; pointer-events: none; transition: opacity 0.25s ease;
    z-index: 9999;
}
.xp-copy-toast-visible { opacity: 1; }

/* ── Scrim Calendar Window ── */
.xp-scrim-cal-window {
    z-index: 12;
    width: 320px !important;
}
.xp-scrim-cal-window .xp-window-body {
    padding: 0 !important;
    display: flex; flex-direction: column;
}
.xp-cal-big-day {
    min-height: 32px; padding: 3px 2px !important;
    display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
    gap: 1px; position: relative;
}
.xp-cal-dots {
    display: flex; gap: 2px; position: absolute; bottom: 2px;
}
.xp-cal-dot {
    width: 6px; height: 6px; border-radius: 50%; display: inline-block;
}
.xp-cal-dot-confirmed { background: #2d8212; }
.xp-cal-dot-pending { background: #e89c0c; }
.xp-cal-scrim-item {
    background: #fff; border: 1px solid #d4d0c8; padding: 4px 6px;
    border-left: 3px solid #0054e3;
}
.xp-cal-scrim-item:hover { background: #f4f8ff; }
.xp-cal-detail {
    scrollbar-width: thin;
    scrollbar-color: #a0a0a0 #ece9d8;
}

/* ── Post Scrim Window ── */
.xp-post-window {
    z-index: 30;
    width: min(520px, 92vw) !important;
}

/* ── Dialog (XP warning popup) ── */
.xp-dialog-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.35);
    display: flex; align-items: center; justify-content: center;
    z-index: 200;
}
.xp-dialog { width: 340px; max-width: 92vw; }

/* ── Mobile adjustments ── */
@media (max-width: 768px) {
    /* Hide all XP chrome on mobile — only show scrim planner content */
    .xp-theme {
        background: none !important;
        background-color: var(--color-primary, #0f1923) !important;
        padding-bottom: 0 !important;
        color: var(--color-text, #e0e0e0) !important;
        font-family: "Montserrat", system-ui, sans-serif !important;
        color-scheme: dark !important;
        padding-top: 72px;
    }
    .xp-dino-window { display: none !important; }
    .xp-coinflip-window { display: none !important; }
    .xp-scrim-cal-window { display: none !important; }
    .xp-help-window { display: none !important; }
    .xp-post-window {
        position: relative !important;
        left: auto !important; top: auto !important;
        width: 100% !important; height: auto !important;
        border: none !important; border-radius: 0 !important;
        box-shadow: none !important; overflow: visible !important;
        margin-top: 8px;
    }
    .xp-post-window > .xp-title-bar { display: none !important; }
    .xp-post-window > .xp-window-body { background: transparent !important; padding: 0 !important; }
    .xp-desktop-icons { display: none !important; }
    .xp-taskbar { display: none !important; }
    .xp-resize-handle { display: none !important; }

    /* Strip XP window chrome from the main scrim planner window */
    .xp-main-window {
        position: relative !important;
        left: auto !important; top: auto !important;
        width: 100% !important; height: auto !important;
        border: none !important; border-radius: 0 !important;
        box-shadow: none !important;
        overflow: visible !important;
    }
    .xp-main-window > .xp-title-bar { display: none !important; }
    .xp-main-window > .xp-window-body {
        background: transparent !important;
        padding: 0 12px !important;
    }

    /* Restyle tabs for dark theme */
    .xp-tab-bar {
        border-bottom-color: rgba(255,255,255,0.1) !important;
        padding-left: 0 !important;
        gap: 4px !important;
    }
    .xp-tab {
        background: rgba(255,255,255,0.05) !important;
        border: 1px solid rgba(255,255,255,0.1) !important;
        border-bottom: none !important;
        color: var(--color-text, #e0e0e0) !important;
        font-family: "Montserrat", system-ui, sans-serif !important;
        font-size: 12px !important; font-weight: 600 !important;
        padding: 8px 16px !important;
    }
    .xp-tab:hover { background: rgba(255,255,255,0.1) !important; }
    .xp-tab-active {
        background: rgba(255,255,255,0.12) !important;
        border-bottom: 1px solid transparent !important;
        color: var(--color-accent, #4fa0e8) !important;
    }
    .xp-tab-content {
        background: transparent !important;
        border: none !important;
        padding: 12px 0 !important;
    }

    /* Restyle XP elements for dark mobile theme */
    .xp-text { color: var(--color-text, #e0e0e0) !important; font-family: "Montserrat", system-ui, sans-serif !important; }
    .xp-fieldset { border-color: rgba(255,255,255,0.15) !important; }
    .xp-fieldset-legend { color: var(--color-text, #e0e0e0) !important; font-family: "Montserrat", system-ui, sans-serif !important; }
    .xp-input, .xp-select {
        background: rgba(255,255,255,0.08) !important;
        border-color: rgba(255,255,255,0.2) !important;
        color: var(--color-text, #e0e0e0) !important;
        font-family: "Montserrat", system-ui, sans-serif !important;
    }
    .xp-scrim-card {
        background: rgba(255,255,255,0.05) !important;
        border-color: rgba(255,255,255,0.1) !important;
    }
    .xp-scrim-card:hover { background: rgba(255,255,255,0.08) !important; }
    .xp-listbox {
        background: var(--color-secondary, #1a2733) !important;
        border-color: rgba(255,255,255,0.2) !important;
    }
    .xp-listbox-item { color: var(--color-text, #e0e0e0) !important; }
    .xp-listbox-item:hover { background: var(--color-accent, #4fa0e8) !important; }
    .xp-radio-label { color: var(--color-text, #e0e0e0) !important; }
    .xp-progress { border-color: rgba(255,255,255,0.2) !important; background: rgba(255,255,255,0.05) !important; }

    /* Wizard mobile overrides */
    .xp-wizard-sidebar { display: none !important; }
    .xp-wizard-mobile-step {
        display: block !important;
        font-family: "Montserrat", system-ui, sans-serif;
        font-size: 11px; color: var(--color-accent, #4fa0e8);
        font-weight: 600; margin-bottom: 6px;
    }
    .xp-wizard-content {
        padding: 8px 2px !important; max-height: none !important;
    }
    .xp-wizard-footer {
        border-color: rgba(255,255,255,0.1) !important;
        background: transparent !important;
    }
    .xp-wizard-footer .xp-btn { font-family: "Montserrat", system-ui, sans-serif !important; }
    .xp-calendar { border-color: rgba(255,255,255,0.2) !important; background: rgba(255,255,255,0.05) !important; }
    .xp-calendar-header { background: var(--color-accent, #4fa0e8) !important; }
    .xp-calendar-day-header { background: rgba(255,255,255,0.05) !important; color: var(--color-text, #e0e0e0) !important; border-color: rgba(255,255,255,0.1) !important; }
    .xp-calendar-day { color: var(--color-text, #e0e0e0) !important; }
    .xp-calendar-day:hover { background: rgba(255,255,255,0.1) !important; }
    .xp-calendar-day-selected { background: var(--color-accent, #4fa0e8) !important; color: #fff !important; }
    .xp-calendar-day-past { color: rgba(255,255,255,0.2) !important; }
    .xp-calendar-day-today { border-color: var(--color-accent, #4fa0e8) !important; }
    .xp-time-select {
        background: rgba(255,255,255,0.08) !important;
        border-color: rgba(255,255,255,0.2) !important;
        color: var(--color-text, #e0e0e0) !important;
        font-family: "Montserrat", system-ui, sans-serif !important;
    }
    .xp-time-colon { color: var(--color-text, #e0e0e0) !important; }
    .xp-checkbox-label { color: var(--color-text, #e0e0e0) !important; font-family: "Montserrat", system-ui, sans-serif !important; }
    .xp-dialog-overlay { z-index: 200; }
    .xp-dialog .xp-window-body { background: var(--color-secondary, #1a2733) !important; }
    .xp-dialog .xp-text { color: var(--color-text, #e0e0e0) !important; }

    /* Scrim card new elements */
    .xp-team-link { color: var(--color-accent, #4fa0e8) !important; }
    .xp-team-link:hover { color: #7dc0f0 !important; }
    .xp-league-link { color: var(--color-accent, #4fa0e8) !important; }
    .xp-league-link:hover { color: #7dc0f0 !important; }
    .xp-export-btn {
        background: rgba(255,255,255,0.1) !important;
        border-color: rgba(255,255,255,0.25) !important;
        color: var(--color-text, #e0e0e0) !important;
        box-shadow: none !important;
    }
    .xp-export-btn:hover { background: rgba(255,255,255,0.18) !important; }
    .xp-scrim-footer { border-top-color: rgba(255,255,255,0.1) !important; }
    .xp-tier-badge-1 { background: rgba(200,160,0,0.2) !important; border-color: #c0a030 !important; color: #f0c840 !important; }
    .xp-tier-badge-2 { background: rgba(128,48,192,0.2) !important; border-color: #8030c0 !important; color: #d090ff !important; }
    .xp-tier-badge-3 { background: rgba(42,144,101,0.2) !important; border-color: #2a9065 !important; color: #50d090 !important; }
    .xp-tier-badge-4 { background: rgba(32,96,192,0.2) !important; border-color: #2060c0 !important; color: #70a8f0 !important; }
    .xp-tier-badge-5 { background: rgba(0,152,184,0.2) !important; border-color: #0098b8 !important; color: #40d8f8 !important; }
}

/* ═══════════════════════════════════════════════════════════════════
   MOBILE LAYOUT — sm-* classes (dark modern theme, no XP chrome)
   ═══════════════════════════════════════════════════════════════════ */

.sm-mobile-view {
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
    background: #0f1923;
    color: #e0e6ed;
    font-family: 'Lato', system-ui, sans-serif;
    padding-top: 72px; /* space below fixed navbar */
    padding-bottom: 72px; /* space for bottom nav + safe area */
    overflow-x: hidden;
}

/* ─── Hero banner ───────────────────────────────────── */
.sm-hero {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 18px 20px;
    background: linear-gradient(135deg, #1a3a5c 0%, #0d2240 40%, #162040 70%, #1a1040 100%);
    border-bottom: 1px solid rgba(79, 160, 232, 0.2);
    position: relative;
    overflow: hidden;
}

.sm-hero::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at 20% 50%, rgba(79, 160, 232, 0.12) 0%, transparent 70%),
                radial-gradient(ellipse at 80% 50%, rgba(128, 48, 192, 0.08) 0%, transparent 70%);
    pointer-events: none;
}

.sm-hero-icon {
    color: #4fa0e8;
    flex-shrink: 0;
    filter: drop-shadow(0 0 8px rgba(79, 160, 232, 0.4));
    position: relative;
}

.sm-hero-title {
    font-family: 'Montserrat', 'Lato', system-ui, sans-serif;
    font-size: 18px;
    font-weight: 800;
    letter-spacing: -0.3px;
    color: #fff;
    margin: 0 0 2px;
    position: relative;
}

.sm-hero-sub {
    font-size: 12px;
    color: #8ca8c4;
    margin: 0;
    line-height: 1.3;
    position: relative;
}

.sm-content {
    flex: 1;
    padding: 12px 14px 8px;
    max-width: 600px;
    width: 100%;
    margin: 0 auto;
}

/* ─── Bottom navigation ─────────────────────────────── */
.sm-bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    background: rgba(15, 25, 35, 0.97);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-top: 1px solid rgba(255,255,255,0.1);
    z-index: 1000;
    padding-bottom: env(safe-area-inset-bottom, 0);
    box-sizing: border-box;
    max-height: 70px;
}

.sm-nav-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 6px 4px 4px;
    background: none;
    border: none;
    color: #8899aa;
    font-size: 10px;
    font-family: 'Lato', system-ui, sans-serif;
    font-weight: 600;
    letter-spacing: 0.3px;
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
    min-height: 48px;
    box-sizing: border-box;
}

.sm-nav-btn.active {
    color: #4fa0e8;
    background: rgba(79, 160, 232, 0.08);
}

.sm-nav-btn:not(.active):hover {
    color: #c0ccd8;
    background: rgba(255,255,255,0.04);
}

/* ─── Loading / error states ────────────────────────── */
.sm-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 48px 0;
    color: #8899aa;
    font-size: 13px;
}

.sm-spinner {
    width: 28px;
    height: 28px;
    border: 3px solid rgba(79,160,232,0.2);
    border-top-color: #4fa0e8;
    border-radius: 50%;
    animation: sm-spin 0.8s linear infinite;
}

@keyframes sm-spin {
    to { transform: rotate(360deg); }
}

.sm-error-box {
    background: rgba(220, 60, 60, 0.15);
    border: 1px solid rgba(220, 60, 60, 0.4);
    color: #f08080;
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 13px;
    margin-bottom: 12px;
}

/* ─── Section headers ───────────────────────────────── */
.sm-section-header {
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
}

.sm-section-title {
    font-size: 16px;
    font-weight: 700;
    color: #e0e6ed;
    margin: 0 0 2px;
}

.sm-section-sub {
    font-size: 11px;
    color: #8899aa;
    margin: 0;
}

/* ─── Login CTA ─────────────────────────────────────── */
.sm-login-cta {
    text-align: center;
    padding: 20px 0 8px;
}

.sm-login-btn {
    display: inline-block;
    background: linear-gradient(135deg, #4fa0e8, #2060c0);
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 10px 22px;
    font-size: 13px;
    font-weight: 700;
    font-family: 'Lato', system-ui, sans-serif;
    cursor: pointer;
    transition: opacity 0.15s;
}

.sm-login-btn:hover { opacity: 0.85; }

/* ─── Override XP component styles inside mobile view ── */

/* Reset XP base element styles */
.sm-mobile-view .xp-text {
    font-family: 'Lato', system-ui, sans-serif !important;
    color: #c8d4e0 !important;
}

.sm-mobile-view .xp-window,
.sm-mobile-view .xp-titlebar,
.sm-mobile-view .xp-window-body {
    all: unset !important;
    display: block !important;
}

/* ─── ScrimCard inside mobile view ──────────────────── */
.sm-mobile-view .xp-scrim-card {
    background: rgba(255,255,255,0.04) !important;
    border: 1px solid rgba(255,255,255,0.1) !important;
    border-radius: 10px !important;
    box-shadow: none !important;
    margin-bottom: 10px !important;
    padding: 12px !important;
}

.sm-mobile-view .xp-scrim-layout {
    display: flex !important;
    flex-direction: column !important;
    gap: 0 !important;
}

.sm-mobile-view .xp-scrim-header {
    display: flex !important;
    align-items: center !important;
    gap: 10px !important;
    margin-bottom: 8px !important;
    padding-bottom: 8px !important;
    border-bottom: 1px solid rgba(255,255,255,0.08) !important;
}

/* Smaller logo on mobile */
.sm-mobile-view .xp-scrim-header img[class*="team-logo"],
.sm-mobile-view .xp-scrim-header > div:first-child img {
    width: 36px !important;
    height: 36px !important;
}

.sm-mobile-view .xp-scrim-meta-inline {
    margin-top: 2px !important;
}

.sm-mobile-view .xp-scrim-body {
    padding-left: 0 !important;
    margin-bottom: 4px !important;
}

.sm-mobile-view .xp-scrim-footer {
    background: transparent !important;
    border-top: 1px solid rgba(255,255,255,0.08) !important;
    padding: 6px 0 0 !important;
    margin-top: 4px !important;
    grid-column: auto !important;
    padding-left: 0 !important;
}

.sm-mobile-view .xp-scrim-actions {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: wrap !important;
    gap: 6px !important;
    align-items: center !important;
    border-top: 1px solid rgba(255,255,255,0.08) !important;
    padding-top: 8px !important;
    margin-top: 6px !important;
    grid-column: auto !important;
    grid-row: auto !important;
}

.sm-mobile-view .xp-scrim-actions .xp-btn {
    flex: 1 !important;
    min-width: 0 !important;
    text-align: center !important;
}

.sm-mobile-view .xp-scrim-actions .xp-listbox {
    flex-basis: 100% !important;
}

/* ─── Badges ─────────────────────────────────────────── */
.sm-mobile-view .xp-badge {
    font-family: 'Lato', system-ui, sans-serif !important;
    font-size: 10px !important;
    border-radius: 4px !important;
    padding: 1px 6px !important;
    font-weight: 700 !important;
}

.sm-mobile-view .xp-badge-green  { background: rgba(42,144,101,0.2) !important; border-color: #2a9065 !important; color: #50d090 !important; }
.sm-mobile-view .xp-badge-amber  { background: rgba(200,140,0,0.2) !important;  border-color: #b88a00 !important; color: #f0c040 !important; }
.sm-mobile-view .xp-badge-red    { background: rgba(200,60,60,0.2) !important;   border-color: #c03030 !important; color: #f08080 !important; }
.sm-mobile-view .xp-badge-blue   { background: rgba(32,96,192,0.2) !important;   border-color: #2060c0 !important; color: #70a8f0 !important; }
.sm-mobile-view .xp-badge-purple { background: rgba(128,48,192,0.2) !important;  border-color: #8030c0 !important; color: #d090ff !important; }

/* ─── Buttons ────────────────────────────────────────── */
.sm-mobile-view .xp-btn {
    font-family: 'Lato', system-ui, sans-serif !important;
    background: rgba(255,255,255,0.08) !important;
    border: 1px solid rgba(255,255,255,0.15) !important;
    color: #c8d4e0 !important;
    border-radius: 6px !important;
    box-shadow: none !important;
    padding: 6px 12px !important;
    font-size: 12px !important;
    font-weight: 600 !important;
    cursor: pointer !important;
    transition: background 0.15s !important;
}

.sm-mobile-view .xp-btn:hover {
    background: rgba(255,255,255,0.14) !important;
}

.sm-mobile-view .xp-btn-primary {
    background: linear-gradient(135deg, #4fa0e8, #2060c0) !important;
    border-color: #2060c0 !important;
    color: #fff !important;
}

.sm-mobile-view .xp-btn-primary:hover {
    opacity: 0.85 !important;
    background: linear-gradient(135deg, #4fa0e8, #2060c0) !important;
}

.sm-mobile-view .xp-btn-danger {
    background: rgba(200,60,60,0.15) !important;
    border-color: rgba(200,60,60,0.4) !important;
    color: #f08080 !important;
}

.sm-mobile-view .xp-btn-danger:hover {
    background: rgba(200,60,60,0.25) !important;
}

.sm-mobile-view .xp-btn:disabled,
.sm-mobile-view .xp-btn[disabled] {
    opacity: 0.4 !important;
    cursor: not-allowed !important;
}

/* ─── Inputs & selects ───────────────────────────────── */
.sm-mobile-view .xp-input,
.sm-mobile-view .xp-select,
.sm-mobile-view .xp-textarea {
    font-family: 'Lato', system-ui, sans-serif !important;
    background: rgba(255,255,255,0.05) !important;
    border: 1px solid rgba(255,255,255,0.15) !important;
    border-radius: 6px !important;
    color: #e0e6ed !important;
    box-shadow: none !important;
    padding: 8px 10px !important;
    font-size: 13px !important;
    outline: none !important;
}

.sm-mobile-view .xp-input:focus,
.sm-mobile-view .xp-select:focus,
.sm-mobile-view .xp-textarea:focus {
    border-color: #4fa0e8 !important;
    box-shadow: 0 0 0 2px rgba(79,160,232,0.2) !important;
}

/* ─── Listbox dropdown ───────────────────────────────── */
.sm-mobile-view .xp-listbox {
    background: #1a2634 !important;
    border: 1px solid rgba(255,255,255,0.15) !important;
    border-radius: 6px !important;
    box-shadow: 0 4px 16px rgba(0,0,0,0.5) !important;
}

.sm-mobile-view .xp-listbox-item {
    background: none !important;
    color: #c8d4e0 !important;
    border-bottom: 1px solid rgba(255,255,255,0.06) !important;
    font-family: 'Lato', system-ui, sans-serif !important;
    padding: 8px 10px !important;
    font-size: 12px !important;
    text-align: left !important;
    cursor: pointer !important;
    display: flex !important;
    align-items: center !important;
    gap: 6px !important;
    width: 100% !important;
    border-radius: 0 !important;
    box-shadow: none !important;
}

.sm-mobile-view .xp-listbox-item:hover {
    background: rgba(79,160,232,0.1) !important;
    color: #fff !important;
}

/* ─── Filter row (OpenScrimsTab) ─────────────────────── */
.sm-mobile-view .xp-filter-row {
    background: transparent !important;
    border: none !important;
    padding: 0 !important;
    margin-bottom: 10px !important;
    gap: 6px !important;
    display: flex !important;
    flex-wrap: wrap !important;
}

/* ─── Reliability bar ────────────────────────────────── */
.sm-mobile-view .xp-reliability-bar-bg {
    background: rgba(255,255,255,0.1) !important;
    border-radius: 4px !important;
}

/* ─── Team/player links ──────────────────────────────── */
.sm-mobile-view .xp-team-link,
.sm-mobile-view .xp-league-link {
    color: #4fa0e8 !important;
}

.sm-mobile-view .xp-team-link:hover,
.sm-mobile-view .xp-league-link:hover {
    color: #7dc0f0 !important;
}

/* ─── Wizard (PostScrimWizard) ───────────────────────── */
.sm-mobile-view .xp-wizard {
    background: transparent !important;
    border: none !important;
    padding: 0 !important;
    box-shadow: none !important;
    max-width: none !important;
    width: 100% !important;
}

.sm-mobile-view .xp-wizard-header {
    background: transparent !important;
    border-bottom: 1px solid rgba(255,255,255,0.1) !important;
    padding: 0 0 10px !important;
    margin-bottom: 12px !important;
}

.sm-mobile-view .xp-wizard-title {
    color: #e0e6ed !important;
    font-family: 'Lato', system-ui, sans-serif !important;
}

.sm-mobile-view .xp-wizard-body {
    background: transparent !important;
    padding: 0 !important;
}

.sm-mobile-view .xp-wizard-step {
    background: rgba(255,255,255,0.04) !important;
    border: 1px solid rgba(255,255,255,0.1) !important;
    border-radius: 10px !important;
    padding: 14px !important;
}

.sm-mobile-view .xp-wizard-footer {
    background: transparent !important;
    border-top: 1px solid rgba(255,255,255,0.1) !important;
    padding: 10px 0 0 !important;
    margin-top: 10px !important;
    display: flex !important;
    justify-content: flex-end !important;
    gap: 8px !important;
}

.sm-mobile-view .xp-step-label {
    color: #8899aa !important;
    font-family: 'Lato', system-ui, sans-serif !important;
}

.sm-mobile-view .xp-step-label.active {
    color: #4fa0e8 !important;
}

.sm-mobile-view .xp-progress-bar-bg {
    background: rgba(255,255,255,0.1) !important;
    border-radius: 4px !important;
    border: none !important;
    box-shadow: none !important;
}

.sm-mobile-view .xp-progress-bar-fill {
    background: linear-gradient(90deg, #2060c0, #4fa0e8) !important;
    border-radius: 4px !important;
}

/* ─── Tier badges ────────────────────────────────────── */
.sm-mobile-view .xp-tier-badge-1 { background: rgba(200,160,0,0.2) !important; border-color: #c0a030 !important; color: #f0c840 !important; }
.sm-mobile-view .xp-tier-badge-2 { background: rgba(128,48,192,0.2) !important; border-color: #8030c0 !important; color: #d090ff !important; }
.sm-mobile-view .xp-tier-badge-3 { background: rgba(42,144,101,0.2) !important; border-color: #2a9065 !important; color: #50d090 !important; }
.sm-mobile-view .xp-tier-badge-4 { background: rgba(32,96,192,0.2) !important; border-color: #2060c0 !important; color: #70a8f0 !important; }
.sm-mobile-view .xp-tier-badge-5 { background: rgba(0,152,184,0.2) !important; border-color: #0098b8 !important; color: #40d8f8 !important; }

/* ─── Calendar (mobile My Scrims fallback) ───────────── */
.sm-mobile-view .xp-calendar {
    background: rgba(255,255,255,0.04) !important;
    border: 1px solid rgba(255,255,255,0.1) !important;
    border-radius: 10px !important;
}

.sm-mobile-view .xp-calendar-header {
    background: rgba(255,255,255,0.06) !important;
    border-bottom: 1px solid rgba(255,255,255,0.1) !important;
    color: #e0e6ed !important;
}

.sm-mobile-view .xp-calendar-day {
    color: #c8d4e0 !important;
    background: transparent !important;
}

.sm-mobile-view .xp-calendar-day:hover {
    background: rgba(79,160,232,0.12) !important;
}

.sm-mobile-view .xp-calendar-day-today {
    background: rgba(79,160,232,0.18) !important;
    color: #4fa0e8 !important;
    font-weight: 700 !important;
}

.sm-mobile-view .xp-calendar-day-selected {
    background: rgba(79,160,232,0.3) !important;
    color: #fff !important;
}

.sm-mobile-view .xp-calendar-day-header {
    color: #8899aa !important;
    background: transparent !important;
}

.sm-mobile-view .xp-calendar-day-past {
    color: #556677 !important;
    opacity: 0.5 !important;
}

.sm-mobile-view .xp-calendar-day-scrim::after {
    background: #f0a020 !important;
}

/* ─── Muted text (secondary/helper text) ─────────────── */
.sm-mobile-view .xp-text-muted {
    color: #8899aa !important;
}

/* ─── Fieldsets ──────────────────────────────────────── */
.sm-mobile-view .xp-fieldset {
    border: 1px solid rgba(255,255,255,0.1) !important;
    border-radius: 8px !important;
    background: rgba(255,255,255,0.03) !important;
    padding: 10px 12px !important;
    margin-bottom: 10px !important;
}

.sm-mobile-view .xp-fieldset-legend {
    color: #e0e6ed !important;
    font-family: 'Lato', system-ui, sans-serif !important;
    font-weight: 700 !important;
    font-size: 12px !important;
    background: transparent !important;
    padding: 0 4px !important;
}

/* ─── Radio & checkbox labels ────────────────────────── */
.sm-mobile-view .xp-radio-label,
.sm-mobile-view .xp-checkbox-label {
    color: #c8d4e0 !important;
    font-family: 'Lato', system-ui, sans-serif !important;
    cursor: pointer !important;
    display: flex !important;
    align-items: center !important;
    gap: 6px !important;
    padding: 4px 0 !important;
}

.sm-mobile-view .xp-radio,
.sm-mobile-view .xp-checkbox {
    accent-color: #4fa0e8 !important;
}

/* ─── Time selects ───────────────────────────────────── */
.sm-mobile-view .xp-time-select {
    font-family: 'Lato', system-ui, sans-serif !important;
    background: rgba(255,255,255,0.05) !important;
    border: 1px solid rgba(255,255,255,0.15) !important;
    border-radius: 6px !important;
    color: #e0e6ed !important;
    box-shadow: none !important;
    padding: 6px 8px !important;
    font-size: 14px !important;
}

.sm-mobile-view .xp-time-select:focus {
    border-color: #4fa0e8 !important;
    box-shadow: 0 0 0 2px rgba(79,160,232,0.2) !important;
}

.sm-mobile-view .xp-time-colon {
    color: #8899aa !important;
    font-size: 18px !important;
    font-weight: 700 !important;
}

/* ─── Select option elements (dropdown internals) ────── */
.sm-mobile-view .xp-select option,
.sm-mobile-view .xp-time-select option {
    background: #1a2634 !important;
    color: #e0e6ed !important;
}

/* ─── Wizard: team card (step 0 single team) ─────────── */
.sm-mobile-view .xp-team-card {
    background: rgba(255,255,255,0.06) !important;
    border: 1px solid rgba(255,255,255,0.12) !important;
    border-radius: 8px !important;
}

/* ─── Wizard: division preview box ───────────────────── */
.sm-mobile-view .xp-division-preview {
    background: rgba(79,160,232,0.1) !important;
    border: 1px solid rgba(79,160,232,0.3) !important;
    border-radius: 8px !important;
}

.sm-mobile-view .xp-division-preview-title {
    color: #4fa0e8 !important;
}

/* ─── Wizard: info/warning boxes ─────────────────────── */
.sm-mobile-view .xp-info-box-warn {
    background: rgba(200,160,0,0.12) !important;
    border: 1px solid rgba(200,160,0,0.35) !important;
    border-radius: 8px !important;
}

.sm-mobile-view .xp-info-box-warn .xp-info-box-text {
    color: #f0c040 !important;
}

.sm-mobile-view .xp-info-box-warn svg {
    color: #f0a020 !important;
}

.sm-mobile-view .xp-info-box-error {
    background: rgba(220,60,60,0.12) !important;
    border: 1px solid rgba(220,60,60,0.35) !important;
    border-radius: 8px !important;
}

.sm-mobile-view .xp-info-box-error .xp-info-box-text {
    color: #f08080 !important;
}

/* ─── Wizard: challenged team display ────────────────── */
.sm-mobile-view .xp-challenged-team {
    background: rgba(128,48,192,0.12) !important;
    border: 1px solid rgba(128,48,192,0.3) !important;
    border-radius: 8px !important;
}

.sm-mobile-view .xp-challenged-team-name {
    color: #d090ff !important;
}

/* ─── Wizard: selected date text ─────────────────────── */
.sm-mobile-view .xp-selected-date {
    color: #4fa0e8 !important;
}

/* ─── Wizard: step divider line ──────────────────────── */
.sm-mobile-view .xp-step-divider {
    background: rgba(255,255,255,0.1) !important;
}

/* ─── Wizard: mobile step indicator ──────────────────── */
.sm-mobile-view .xp-wizard-mobile-step {
    color: #8899aa !important;
    font-family: 'Lato', system-ui, sans-serif !important;
    font-size: 11px !important;
    border-bottom: 1px solid rgba(255,255,255,0.08) !important;
    padding-bottom: 6px !important;
    margin-bottom: 8px !important;
    background: transparent !important;
}

/* ─── Wizard: sidebar hidden on mobile ───────────────── */
.sm-mobile-view .xp-wizard-sidebar {
    display: none !important;
}

/* ─── Wizard: content area ───────────────────────────── */
.sm-mobile-view .xp-wizard-content {
    background: transparent !important;
    padding: 0 !important;
    max-width: none !important;
    width: 100% !important;
}

/* ─── Wizard: inline spans (tier division names etc) ──── */
.sm-mobile-view .xp-checkbox-label span[style],
.sm-mobile-view .xp-wizard-content span[style] {
    color: inherit !important;
}

/* ─── Blacklist item dividers ────────────────────────── */
.sm-mobile-view .xp-blacklist-item {
    border-bottom-color: rgba(255,255,255,0.08) !important;
}

/* ─── Dialog overlay (conflict/cancel) ───────────────── */
.sm-mobile-view .xp-dialog-overlay {
    background: rgba(0,0,0,0.6) !important;
}

.sm-mobile-view .xp-dialog {
    background: #1a2634 !important;
    border: 1px solid rgba(255,255,255,0.15) !important;
    border-radius: 10px !important;
    box-shadow: 0 8px 32px rgba(0,0,0,0.6) !important;
}

.sm-mobile-view .xp-title-bar {
    background: rgba(255,255,255,0.06) !important;
    border-bottom: 1px solid rgba(255,255,255,0.1) !important;
    border-radius: 10px 10px 0 0 !important;
    padding: 8px 12px !important;
}

.sm-mobile-view .xp-title-text {
    color: #e0e6ed !important;
    font-family: 'Lato', system-ui, sans-serif !important;
}

.sm-mobile-view .xp-title-btn {
    background: rgba(255,255,255,0.08) !important;
    border: 1px solid rgba(255,255,255,0.15) !important;
    color: #c8d4e0 !important;
    border-radius: 4px !important;
    box-shadow: none !important;
}

.sm-mobile-view .xp-title-btn:hover {
    background: rgba(255,255,255,0.15) !important;
}

/* ─── Error icon (small X badge) ─────────────────────── */
.sm-mobile-view .xp-error-icon {
    background: rgba(220,60,60,0.3) !important;
    border-color: rgba(220,60,60,0.5) !important;
    color: #f08080 !important;
}

/* ─── Calendar legend footer ─────────────────────────── */
.sm-mobile-view .xp-calendar > div:last-child {
    background: rgba(255,255,255,0.04) !important;
    border-top-color: rgba(255,255,255,0.1) !important;
}

.sm-mobile-view .xp-copy-btn {
    background: rgba(255,255,255,0.08) !important;
    border: 1px solid rgba(255,255,255,0.15) !important;
    color: #c8d4e0 !important;
    border-radius: 4px !important;
    box-shadow: none !important;
}

.sm-mobile-view .xp-copy-btn:hover {
    background: rgba(255,255,255,0.15) !important;
}

/* ─── Calendar detail panel ──────────────────────────── */
.sm-mobile-view .xp-cal-detail {
    background: transparent !important;
}

.sm-mobile-view .xp-cal-scrim-item {
    background: rgba(255,255,255,0.04) !important;
    border: 1px solid rgba(255,255,255,0.08) !important;
    border-radius: 6px !important;
    padding: 6px 8px !important;
}
`

export default XP_STYLES
