// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "SystemAudioDump",
    platforms: [.macOS(.v11)],
    products: [
        .executable(name: "SystemAudioDump", targets: ["SystemAudioDump"])
    ],
    targets: [
        .executableTarget(
            name: "SystemAudioDump",
            path: "Sources"
        )
    ]
)
