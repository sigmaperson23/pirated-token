#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // The same program doubles as the terminal keeper, so no second file has to be built or shipped.
    if std::env::args().nth(1).as_deref() == Some("--pty-host") {
        std::process::exit(switchyard_lib::host::run());
    }
    switchyard_lib::run();
}
