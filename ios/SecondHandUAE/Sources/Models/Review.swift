import Foundation

struct Review: Codable, Identifiable {
    let id: String
    let orderId: String
    let reviewerId: String
    let revieweeId: String
    let rating: Int
    let comment: String?
    let createdAt: String
    let reviewer: ReviewUser?
}

struct ReviewUser: Codable {
    let id: String
    let name: String
}

struct CreateReviewRequest: Codable {
    let orderId: String
    let rating: Int
    let comment: String?
}
