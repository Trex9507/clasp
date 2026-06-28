import Foundation

struct Listing: Codable, Identifiable {
    let id: String
    let sellerId: String
    let title: String
    let description: String?
    let categoryId: String
    let brandId: String?
    let size: String?
    let condition: String
    let price: Double
    let currency: String
    let status: String
    let verificationStatus: String
    let verificationCode: String?
    let verificationPhotoUrl: String?
    let deliveryOptions: String
    let createdAt: String
    let photos: [ListingPhoto]?
    let brand: Brand?
    let seller: ListingSeller?
}

struct ListingPhoto: Codable, Identifiable {
    let id: String
    let url: String
    let sortOrder: Int
}

struct ListingSeller: Codable {
    let id: String
    let name: String
    let profilePhotoUrl: String?
    let city: String
    let ratingAvg: Double
}

struct ListingFeedResponse: Codable {
    let items: [Listing]
    let total: Int
    let page: Int
    let limit: Int
    let pages: Int
}

struct CreateListingRequest: Codable {
    let sellerId: String
    let title: String
    let description: String?
    let categoryId: String
    let brandId: String?
    let size: String?
    let condition: String
    let price: Double
    let deliveryOptions: String
    let verificationCode: String?
    let verificationPhotoUrl: String?
    let photoUrls: [String]?
}
