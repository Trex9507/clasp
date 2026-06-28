import Foundation

struct Offer: Codable, Identifiable {
    let id: String
    let listingId: String
    let buyerId: String
    let amount: Double
    let status: String
    let expiresAt: String
    let createdAt: String
    let listing: OfferListing?
    let buyer: OfferUser?
}

struct OfferListing: Codable {
    let id: String
    let title: String
    let price: Double
}

struct OfferUser: Codable {
    let id: String
    let name: String
    let profilePhotoUrl: String?
}

struct CreateOfferRequest: Codable {
    let listingId: String
    let amount: Double
}

struct RespondOfferRequest: Codable {
    let action: String
    let counterAmount: Double?
}
