use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use std::net::TcpListener;
use std::sync::Mutex;

struct SidecarState {
    backend_child: Mutex<Option<tauri_plugin_shell::process::CommandChild>>,
    backend_port: Mutex<u16>,
}

fn find_free_port(start: u16) -> u16 {
    for port in start..start + 100 {
        if TcpListener::bind(("127.0.0.1", port)).is_ok() {
            return port;
        }
    }
    panic!("No free port found in range {}..{}", start, start + 100);
}

#[tauri::command]
fn get_data_dir(app: tauri::AppHandle) -> String {
    let path = app.path().app_data_dir().expect("Failed to get app data dir");
    std::fs::create_dir_all(&path).expect("Failed to create data dir");
    path.to_string_lossy().to_string()
}

#[tauri::command]
fn get_backend_port(state: tauri::State<SidecarState>) -> u16 {
    *state.backend_port.lock().unwrap()
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .manage(SidecarState {
            backend_child: Mutex::new(None),
            backend_port: Mutex::new(0),
        })
        .invoke_handler(tauri::generate_handler![get_data_dir, get_backend_port])
        .setup(|app| {
            let app_handle = app.handle().clone();

            let data_dir = app_handle
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");
            std::fs::create_dir_all(&data_dir).expect("Failed to create data dir");
            let data_dir_str = data_dir.to_string_lossy().to_string();

            let resource_dir = app_handle
                .path()
                .resource_dir()
                .expect("Failed to get resource dir");
            let server_js = resource_dir
                .join("resources")
                .join("backend")
                .join("server.js");
            let server_js_str = server_js.to_string_lossy().to_string();

            let seed_dir = resource_dir
                .join("resources")
                .join("seed");
            let seed_dir_str = seed_dir.to_string_lossy().to_string();

            let port = find_free_port(3001);
            let port_str = port.to_string();
            log::info!("Backend will use port {}", port);

            let shell = app_handle.shell();
            let backend_cmd = shell
                .sidecar("node")
                .expect("Failed to create backend sidecar command")
                .args([
                    &server_js_str,
                    "--data-dir",
                    &data_dir_str,
                    "--port",
                    &port_str,
                    "--seed-dir",
                    &seed_dir_str,
                ])
                .envs([("NODE_ENV", "production")]);

            let (mut rx, backend_child) = backend_cmd
                .spawn()
                .expect("Failed to spawn backend sidecar");

            tauri::async_runtime::spawn(async move {
                use tauri_plugin_shell::process::CommandEvent;
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            log::info!("[backend] {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Stderr(line) => {
                            log::error!("[backend] {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Terminated(status) => {
                            log::warn!("[backend] terminated: {:?}", status);
                        }
                        _ => {}
                    }
                }
            });

            let state = app_handle.state::<SidecarState>();
            *state.backend_child.lock().unwrap() = Some(backend_child);
            *state.backend_port.lock().unwrap() = port;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let state = window.state::<SidecarState>();
                let mut guard = state.backend_child.lock().unwrap();
                if let Some(child) = guard.take() {
                    let _ = child.kill();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
