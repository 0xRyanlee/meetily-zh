use tauri::{AppHandle, Manager, Runtime, WebviewUrl};
use tauri::webview::WebviewWindowBuilder;

const OVERLAY_LABEL: &str = "subtitle-overlay";

#[tauri::command]
pub async fn show_subtitle_overlay<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    if let Some(win) = app.get_webview_window(OVERLAY_LABEL) {
        win.show().map_err(|e| e.to_string())?;
        win.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    WebviewWindowBuilder::new(
        &app,
        OVERLAY_LABEL,
        WebviewUrl::App("/subtitle-overlay".into()),
    )
    .title("Meetily 字幕")
    .inner_size(700.0, 160.0)
    .position(100.0, 80.0)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .resizable(true)
    .visible_on_all_workspaces(true)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn hide_subtitle_overlay<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    if let Some(win) = app.get_webview_window(OVERLAY_LABEL) {
        win.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn toggle_subtitle_overlay<R: Runtime>(app: AppHandle<R>) -> Result<bool, String> {
    if let Some(win) = app.get_webview_window(OVERLAY_LABEL) {
        if win.is_visible().map_err(|e| e.to_string())? {
            win.hide().map_err(|e| e.to_string())?;
            return Ok(false);
        } else {
            win.show().map_err(|e| e.to_string())?;
            win.set_focus().map_err(|e| e.to_string())?;
            return Ok(true);
        }
    }
    // Window doesn't exist yet — create it
    show_subtitle_overlay(app).await?;
    Ok(true)
}

#[tauri::command]
pub async fn is_subtitle_overlay_visible<R: Runtime>(app: AppHandle<R>) -> Result<bool, String> {
    if let Some(win) = app.get_webview_window(OVERLAY_LABEL) {
        win.is_visible().map_err(|e| e.to_string())
    } else {
        Ok(false)
    }
}
