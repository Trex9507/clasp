import Foundation

struct User: Codable, Identifiable {
    let id: String
    let email: String
    let phone: String?
    let name: String
    let profilePhotoUrl: String?
    let city: String
    let kycStatus: String?
    let ratingAvg: Double?
    let ratingCount: Int?
    let createdAt: String?
}

struct CreateUserRequest: Codable {
    let email: String
    let password: String
    let name: String
    let city: String
}

struct LoginRequest: Codable {
    let email: String
    let password: String
}
