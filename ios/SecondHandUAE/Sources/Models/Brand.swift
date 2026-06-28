import Foundation

struct Brand: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let verificationType: String
    let verificationInstructions: String?
}
