// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "SecondHandUAE",
    platforms: [.iOS(.v17)],
    targets: [
        .executableTarget(
            name: "SecondHandUAE",
            path: "Sources"
        ),
    ]
)
