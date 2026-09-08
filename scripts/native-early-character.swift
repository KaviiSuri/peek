import AppKit
import CoreGraphics
import Foundation
import Darwin

struct Step {
    let name: String, offsetMs: UInt64, keyCode: CGKeyCode, down: Bool
    var flags: CGEventFlags { name == "shortcut-down" ? [.maskControl] : [] }
    var json: [String: Any] { ["event": name, "offsetMs": offsetMs, "keyCode": keyCode, "flags": flags.isEmpty ? "none" : flags == .maskControl ? "control" : "unexpected-\(flags.rawValue)"] }
}
let character = "g"
let steps = [Step(name: "shortcut-down", offsetMs: 0, keyCode: 49, down: true),
    Step(name: "shortcut-up", offsetMs: 20, keyCode: 49, down: false),
    Step(name: "character-down", offsetMs: 50, keyCode: 5, down: true),
    Step(name: "character-up", offsetMs: 70, keyCode: 5, down: false)]
// The same monotonic scheduler runs in dry-run and post mode. No readiness gate.
func schedule(_ deliver: (Step, Double) -> Bool) {
    var timebase = mach_timebase_info_data_t()
    mach_timebase_info(&timebase)
    func ticks(_ ms: UInt64) -> UInt64 { ms * 1_000_000 * UInt64(timebase.denom) / UInt64(timebase.numer) }
    var start = mach_absolute_time()
    var lastDownDelivered = start
    for step in steps {
        let scheduled = start + ticks(step.offsetMs)
        let deadline = step.down ? scheduled : max(scheduled, lastDownDelivered + ticks(20))
        while mach_absolute_time() < deadline { _ = mach_wait_until(deadline) }
        let elapsedMs = Double(mach_absolute_time() - start) * Double(timebase.numer) / Double(timebase.denom) / 1_000_000
        if !deliver(step, elapsedMs) { return }
        // Anchor after shortcut delivery, not process startup or a readiness wait.
        // The post mode separately reports the actual call-to-call offset.
        if step.down { lastDownDelivered = mach_absolute_time() }
        if step.name == "shortcut-down" { start = lastDownDelivered }
    }
}
func emit(_ value: [String: Any]) {
    let data = try! JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
    print(String(data: data, encoding: .utf8)!)
}
// Dry-run exits before permissions, application inspection or event construction.
if CommandLine.arguments == [CommandLine.arguments[0], "--dry-run"] {
    var observed: [[String: Any]] = []
    schedule { step, offset in
        var event = step.json; event["observedOffsetMs"] = offset; observed.append(event); return true
    }
    emit(["mode": "dry-run", "posted": false, "plannedDelayMs": 50, "character": character, "plan": steps.map { $0.json }, "observed": observed])
    exit(0)
}
guard CommandLine.arguments.count == 5,
      ["--post", "--check"].contains(CommandLine.arguments[1]),
      let pid = Int32(CommandLine.arguments[2]), pid > 0 else { exit(2) }
let executable = CommandLine.arguments[3], profile = CommandLine.arguments[4]
let process = Process(), pipe = Pipe()
process.executableURL = URL(fileURLWithPath: "/bin/ps")
process.arguments = ["-p", String(pid), "-o", "command="]
process.standardOutput = pipe
try process.run()
let command = String(data: pipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8)!.trimmingCharacters(in: .whitespacesAndNewlines)
process.waitUntilExit()
let profileFlag = "--user-data-dir=\(profile)"
let identity = process.terminationStatus == 0 && executable.hasPrefix("/") && profile.hasPrefix("/") &&
    command.hasPrefix(executable + " ") && (command.hasSuffix(profileFlag) || command.contains(profileFlag + " "))
let application = NSRunningApplication(processIdentifier: pid)
func foregroundOwned() -> Bool {
    return identity && application?.isTerminated == false &&
        application?.executableURL?.path == executable && NSWorkspace.shared.frontmostApplication?.processIdentifier == pid
}
let permitted = CGPreflightPostEventAccess()
var result: [String: Any] = ["mode": CommandLine.arguments[1], "pid": pid, "profileVerified": identity,
    "existingPermission": permitted, "foregroundBeforeShortcut": foregroundOwned(), "plannedDelayMs": 50,
    "shortcutPosted": false, "characterPosted": false, "character": character, "plan": steps.map { $0.json }]
if CommandLine.arguments[1] == "--check" { emit(result); exit(0) }
guard permitted && foregroundOwned() else { result["abort"] = "preconditions failed"; emit(result); exit(0) }
let source = CGEventSource(stateID: .hidSystemState)
let events = steps.map { CGEvent(keyboardEventSource: source, virtualKey: $0.keyCode, keyDown: $0.down) }
guard events.allSatisfy({ $0 != nil }) else { result["abort"] = "event construction failed"; emit(result); exit(0) }
for (index, step) in steps.enumerated() { events[index]!.flags = step.flags }
Array(character.utf16).withUnsafeBufferPointer { buffer in
    events[2]!.keyboardSetUnicodeString(stringLength: buffer.count, unicodeString: buffer.baseAddress)
}
var shortcutNs: UInt64 = 0
var observed: [[String: Any]] = []
schedule { step, scheduledOffset in
    if step.down {
        let owned = foregroundOwned()
        result[step.name == "shortcut-down" ? "foregroundBeforeShortcut" : "foregroundBeforeCharacter"] = owned
        if !owned { result["abort"] = "foreground departed before \(step.name)"; return false }
    }
    let wall = Date().timeIntervalSince1970 * 1000
    let now = DispatchTime.now().uptimeNanoseconds
    if step.name == "shortcut-down" { shortcutNs = now }
    let index = steps.firstIndex { $0.name == step.name }!
    events[index]!.postToPid(pid)
    var event = step.json; event["postedAtMs"] = wall; event["observedOffsetMs"] = scheduledOffset; observed.append(event)
    if step.name == "shortcut-down" { result["shortcutPosted"] = true; result["shortcutPostedAtMs"] = wall }
    if step.name == "character-down" {
        result["characterPosted"] = true; result["characterPostedAtMs"] = wall
        result["actualDispatchOffsetMs"] = Double(now - shortcutNs) / 1_000_000
    }
    return true
}
result["events"] = observed
emit(result)
