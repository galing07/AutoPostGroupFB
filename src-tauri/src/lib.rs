use base64::{engine::general_purpose, Engine as _};
use std::fs;
use std::process::{Command as StdCommand, Stdio};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

// Rust command: run automation action via Node.js
#[tauri::command]
async fn run_automation(
    app: tauri::AppHandle,
    action: String,
    payload: String,
) -> Result<String, String> {
    if action == "open_chrome" {
        return open_chrome_native(payload);
    }
    // Try to find bundled automation script first.
    // On Windows NSIS builds, Tauri v2 places resources under `_up_` next to the exe:
    //   C:\Program Files\AutoPost FB AI Pro\_up_\automation\index.js
    // In dev, it may still be available from the project working directory.
    let script_path = find_automation_script(&app).ok_or_else(|| {
        let attempted = automation_script_candidates(&app)
            .iter()
            .map(|p| p.to_string_lossy().to_string())
            .collect::<Vec<_>>()
            .join(" | ");
        format!("Không tìm thấy automation/index.js. Đã thử: {}", attempted)
    })?;

    // Canonicalize to resolve any `..`, symlinks, or relative components.
    // This prevents Windows issues where a non-canonical path confuses Node.js.
    let script_path = script_path
        .canonicalize()
        .unwrap_or(script_path);

    let automation_dir = script_path
        .parent()
        .ok_or_else(|| "Không xác định được thư mục automation".to_string())?
        .to_path_buf();

    eprintln!("[automation] script_path = {}", script_path.display());
    eprintln!("[automation] automation_dir = {}", automation_dir.display());

    // Spawn node process from the automation directory so local dependencies resolve correctly.
    let node_modules_path = find_node_modules(&automation_dir);

    let mut cmd = StdCommand::new("node");
    cmd.arg(&script_path)
        .arg(&action)
        .arg(&payload)
        .current_dir(&automation_dir);

    // CRITICAL: Only set NODE_PATH when we have a valid, non-empty path.
    // Setting NODE_PATH="" on Windows Node.js v24 causes it to resolve to the
    // drive root (e.g. "C:"), triggering EISDIR errors during module resolution.
    if !node_modules_path.is_empty() {
        eprintln!("[automation] NODE_PATH = {}", node_modules_path);
        cmd.env("NODE_PATH", &node_modules_path);
    } else {
        eprintln!("[automation] NODE_PATH not set (no node_modules found)");
        // Remove NODE_PATH from environment to avoid inheriting a bad value
        cmd.env_remove("NODE_PATH");
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Không thể chạy node: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if !stderr.is_empty() {
        eprintln!("[automation stderr] {}", stderr);
    }

    if !output.status.success() {
        let detail = if !stderr.trim().is_empty() {
            stderr.trim().to_string()
        } else if !stdout.trim().is_empty() {
            stdout.trim().to_string()
        } else {
            format!("Node automation exited with status: {}", output.status)
        };

        return Ok(format!(
            "{{\"type\":\"IPC_RESPONSE\",\"success\":false,\"error\":\"{}\"}}\n",
            json_escape(&detail)
        ));
    }

    if stdout.trim().is_empty() {
        return Ok(
            "{\"type\":\"IPC_RESPONSE\",\"success\":false,\"error\":\"Automation không trả về dữ liệu. Có thể Node.js hoặc thư viện Playwright trên máy Windows đang lỗi.\"}\n"
                .to_string(),
        );
    }

    Ok(stdout)
}

fn automation_script_candidates(app: &tauri::AppHandle) -> Vec<std::path::PathBuf> {
    let resource_dir = app.path().resource_dir().unwrap_or_default();
    let cwd = std::env::current_dir().unwrap_or_default();
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|parent| parent.to_path_buf()))
        .unwrap_or_default();

    vec![
        resource_dir.join("automation").join("index.js"),
        resource_dir
            .join("_up_")
            .join("automation")
            .join("index.js"),
        resource_dir.join("index.js"),
        exe_dir.join("automation").join("index.js"),
        exe_dir.join("_up_").join("automation").join("index.js"),
        cwd.join("automation").join("index.js"),
        cwd.join("_up_").join("automation").join("index.js"),
        cwd.join("..").join("automation").join("index.js"),
    ]
}

fn find_automation_script(app: &tauri::AppHandle) -> Option<std::path::PathBuf> {
    automation_script_candidates(app)
        .into_iter()
        .find(|p| p.exists())
}

// Find node_modules path for automation dependencies
fn find_node_modules(automation_dir: &std::path::Path) -> String {
    let paths = [
        automation_dir.join("node_modules"),
        // Home directory fallback
        dirs::home_dir()
            .unwrap_or_default()
            .join(".autopost-automation")
            .join("node_modules"),
    ];

    for path in &paths {
        if path.exists() {
            return path.to_string_lossy().to_string();
        }
    }

    String::new()
}

fn open_chrome_native(payload: String) -> Result<String, String> {
    let payload_json: serde_json::Value = serde_json::from_str(&payload).unwrap_or_default();
    let custom_chrome_path = payload_json
        .get("chromePath")
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(std::path::PathBuf::from);

    let chrome_path = custom_chrome_path
        .or_else(find_chrome_binary)
        .ok_or_else(|| {
            "Không tìm thấy Google Chrome. Vui lòng cài Chrome hoặc nhập đúng Chrome Path trong Cài đặt."
                .to_string()
        })?;

    if !chrome_path.exists() {
        return Err(format!(
            "Chrome Path không tồn tại: {}",
            chrome_path.to_string_lossy()
        ));
    }

    let profile_dir = dirs::home_dir()
        .unwrap_or_default()
        .join(".autopost")
        .join("chrome-profile");
    fs::create_dir_all(&profile_dir).map_err(|e| format!("Không thể tạo Chrome profile: {}", e))?;

    StdCommand::new(&chrome_path)
        .arg(format!("--user-data-dir={}", profile_dir.to_string_lossy()))
        .arg("--no-first-run")
        .arg("--no-default-browser-check")
        .arg("https://www.facebook.com")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| {
            format!(
                "Không thể mở Chrome tại {}: {}",
                chrome_path.to_string_lossy(),
                e
            )
        })?;

    Ok(format!(
        "{{\"type\":\"IPC_RESPONSE\",\"success\":true,\"isLoggedIn\":false,\"profileDir\":\"{}\",\"message\":\"Chrome đã mở — Vui lòng đăng nhập Facebook trong cửa sổ vừa mở\"}}\n",
        json_escape(&profile_dir.to_string_lossy())
    ))
}

fn find_chrome_binary() -> Option<std::path::PathBuf> {
    let mut candidates = Vec::new();

    #[cfg(target_os = "windows")]
    {
        candidates.push(std::path::PathBuf::from(
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        ));
        candidates.push(std::path::PathBuf::from(
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        ));
        if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
            candidates.push(
                std::path::PathBuf::from(local_app_data)
                    .join("Google")
                    .join("Chrome")
                    .join("Application")
                    .join("chrome.exe"),
            );
        }
    }

    #[cfg(target_os = "macos")]
    {
        candidates.push(std::path::PathBuf::from(
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        ));
    }

    #[cfg(target_os = "linux")]
    {
        candidates.push(std::path::PathBuf::from("/usr/bin/google-chrome"));
        candidates.push(std::path::PathBuf::from("/usr/bin/google-chrome-stable"));
        candidates.push(std::path::PathBuf::from("/usr/bin/chromium"));
    }

    candidates.into_iter().find(|path| path.exists())
}

fn json_escape(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
}

// Command: check if node and playwright are available
#[tauri::command]
async fn check_dependencies() -> Result<String, String> {
    // Check node
    let node_check = StdCommand::new("node")
        .arg("--version")
        .output()
        .map_err(|_| {
            "Node.js không được cài đặt. Vui lòng cài Node.js từ https://nodejs.org".to_string()
        })?;

    let node_version = String::from_utf8_lossy(&node_check.stdout)
        .trim()
        .to_string();

    // Check if automation node_modules exist
    let automation_dir = std::env::current_dir()
        .unwrap_or_default()
        .join("automation")
        .join("node_modules");

    let has_deps = automation_dir.exists();

    Ok(format!(
        "{{\"node\":\"{}\",\"hasDeps\":{}}}",
        node_version, has_deps
    ))
}

// Command: install automation dependencies
#[tauri::command]
async fn install_automation_deps() -> Result<String, String> {
    let automation_dir = std::env::current_dir()
        .unwrap_or_default()
        .join("automation");

    if !automation_dir.exists() {
        return Err("Thư mục automation không tồn tại".to_string());
    }

    let output = StdCommand::new("npm")
        .arg("install")
        .current_dir(&automation_dir)
        .output()
        .map_err(|e| format!("Không thể chạy npm install: {}", e))?;

    if output.status.success() {
        Ok("Đã cài đặt dependencies thành công".to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(format!("Lỗi cài đặt: {}", stderr))
    }
}

// Command: save generated AI image to a real local file path for automation upload
#[tauri::command]
async fn save_generated_image(
    app: tauri::AppHandle,
    base64_data: String,
    ext: String,
) -> Result<String, String> {
    let cleaned_ext = match ext.trim_start_matches('.').to_lowercase().as_str() {
        "jpg" | "jpeg" => "jpg".to_string(),
        "webp" => "webp".to_string(),
        _ => "png".to_string(),
    };

    let image_bytes = general_purpose::STANDARD
        .decode(base64_data.trim())
        .map_err(|e| format!("Không thể đọc dữ liệu ảnh AI: {}", e))?;

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Không tìm thấy thư mục app data: {}", e))?;

    let image_dir = app_data_dir.join("generated-images");
    fs::create_dir_all(&image_dir).map_err(|e| format!("Không thể tạo thư mục ảnh AI: {}", e))?;

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("Lỗi thời gian hệ thống: {}", e))?
        .as_millis();
    let file_path = image_dir.join(format!("ai-image-{}.{}", timestamp, cleaned_ext));

    fs::write(&file_path, image_bytes).map_err(|e| format!("Không thể lưu ảnh AI: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            run_automation,
            check_dependencies,
            install_automation_deps,
            save_generated_image
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
