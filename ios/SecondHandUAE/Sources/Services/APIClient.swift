import Foundation

enum APIError: LocalizedError {
    case invalidURL
    case httpError(Int, String)
    case decodingError

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid URL"
        case .httpError(let code, let msg): return "Error \(code): \(msg)"
        case .decodingError: return "Failed to decode response"
        }
    }
}

struct AuthResponse: Codable {
    let accessToken: String
    let user: User
}

class APIClient {
    static let shared = APIClient()

    #if DEBUG
    let baseURL = URL(string: "http://localhost:3000")!
    #else
    let baseURL = URL(string: "https://api.example.com")!
    #endif

    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        return d
    }()

    var accessToken: String? {
        get { UserDefaults.standard.string(forKey: "accessToken") }
        set { UserDefaults.standard.set(newValue, forKey: "accessToken") }
    }

    private init() {}

    private func request<T: Decodable>(_ method: String, path: String, body: (any Encodable)? = nil, query: [String: String]? = nil, authenticated: Bool = false) async throws -> T {
        var components = URLComponents(url: baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
        if let query {
            components.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        guard let url = components.url else { throw APIError.invalidURL }

        var req = URLRequest(url: url)
        req.httpMethod = method
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONEncoder().encode(body)
        }
        if authenticated, let token = accessToken {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await URLSession.shared.data(for: req)
        let httpResponse = response as! HTTPURLResponse

        guard (200...299).contains(httpResponse.statusCode) else {
            let msg = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw APIError.httpError(httpResponse.statusCode, msg)
        }

        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decodingError
        }
    }

    // MARK: - Auth

    func register(_ req: CreateUserRequest) async throws -> AuthResponse {
        let response: AuthResponse = try await request("POST", path: "/auth/register", body: req)
        accessToken = response.accessToken
        return response
    }

    func login(email: String, password: String) async throws -> AuthResponse {
        let body = LoginRequest(email: email, password: password)
        let response: AuthResponse = try await request("POST", path: "/auth/login", body: body)
        accessToken = response.accessToken
        return response
    }

    func logout() {
        accessToken = nil
    }

    // MARK: - Users

    func getMyProfile() async throws -> User {
        try await request("GET", path: "/users/me", authenticated: true)
    }

    func getUser(id: String) async throws -> User {
        try await request("GET", path: "/users/\(id)")
    }

    // MARK: - Brands & Categories

    func getBrands() async throws -> [Brand] {
        try await request("GET", path: "/brands")
    }

    func getCategories() async throws -> [Category] {
        try await request("GET", path: "/categories")
    }

    // MARK: - Upload

    struct PresignedResponse: Codable {
        let uploadUrl: String
        let fileUrl: String
        let key: String
    }

    func getPresignedUrl(folder: String, contentType: String = "image/jpeg") async throws -> PresignedResponse {
        struct Body: Codable { let folder: String; let contentType: String }
        return try await request("POST", path: "/upload/presign", body: Body(folder: folder, contentType: contentType), authenticated: true)
    }

    func uploadImage(data: Data, to presignedUrl: String, contentType: String = "image/jpeg") async throws {
        guard let url = URL(string: presignedUrl) else { throw APIError.invalidURL }
        var req = URLRequest(url: url)
        req.httpMethod = "PUT"
        req.setValue(contentType, forHTTPHeaderField: "Content-Type")
        req.httpBody = data
        let (_, response) = try await URLSession.shared.data(for: req)
        let httpResponse = response as! HTTPURLResponse
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(httpResponse.statusCode, "Upload failed")
        }
    }

    func uploadPhoto(imageData: Data, folder: String) async throws -> String {
        let presigned = try await getPresignedUrl(folder: folder)
        try await uploadImage(data: imageData, to: presigned.uploadUrl)
        return presigned.fileUrl
    }

    // MARK: - Listings

    func createListing(_ req: CreateListingRequest) async throws -> Listing {
        try await request("POST", path: "/listings", body: req, authenticated: true)
    }

    func getListings(verifiedOnly: Bool = false, page: Int = 1, query: String? = nil, categoryId: String? = nil) async throws -> ListingFeedResponse {
        var params: [String: String] = ["page": "\(page)"]
        if verifiedOnly { params["verifiedOnly"] = "true" }
        if let query { params["q"] = query }
        if let categoryId { params["categoryId"] = categoryId }
        return try await request("GET", path: "/listings", query: params)
    }

    func getListing(id: String) async throws -> Listing {
        try await request("GET", path: "/listings/\(id)")
    }

    // MARK: - Offers

    func createOffer(_ req: CreateOfferRequest) async throws -> Offer {
        try await request("POST", path: "/offers", body: req, authenticated: true)
    }

    func respondToOffer(id: String, _ req: RespondOfferRequest) async throws -> Offer {
        try await request("PATCH", path: "/offers/\(id)/respond", body: req, authenticated: true)
    }

    func getMyOffers() async throws -> [Offer] {
        try await request("GET", path: "/offers/my", authenticated: true)
    }

    func getOffersForListing(id: String) async throws -> [Offer] {
        try await request("GET", path: "/offers/listing/\(id)", authenticated: true)
    }

    // MARK: - Orders

    func createOrder(_ req: CreateOrderRequest) async throws -> Order {
        try await request("POST", path: "/orders", body: req, authenticated: true)
    }

    func payOrder(id: String) async throws -> Order {
        try await request("POST", path: "/orders/\(id)/pay", authenticated: true)
    }

    func shipOrder(id: String, trackingNumber: String?) async throws -> Order {
        struct Body: Codable { let trackingNumber: String? }
        return try await request("PATCH", path: "/orders/\(id)/ship", body: Body(trackingNumber: trackingNumber), authenticated: true)
    }

    func confirmDelivery(orderId: String) async throws -> Order {
        try await request("PATCH", path: "/orders/\(orderId)/delivered", authenticated: true)
    }

    func getMyOrders() async throws -> [Order] {
        try await request("GET", path: "/orders/my", authenticated: true)
    }

    func getOrder(id: String) async throws -> Order {
        try await request("GET", path: "/orders/\(id)", authenticated: true)
    }

    // MARK: - Disputes

    func createDispute(_ req: CreateDisputeRequest) async throws -> Dispute {
        try await request("POST", path: "/disputes", body: req, authenticated: true)
    }

    func respondToDispute(id: String, response: String) async throws -> Dispute {
        struct Body: Codable { let response: String }
        return try await request("PATCH", path: "/disputes/\(id)/respond", body: Body(response: response), authenticated: true)
    }

    func getDisputesForOrder(orderId: String) async throws -> [Dispute] {
        try await request("GET", path: "/disputes/order/\(orderId)", authenticated: true)
    }

    // MARK: - Reviews

    func createReview(_ req: CreateReviewRequest) async throws -> Review {
        try await request("POST", path: "/reviews", body: req, authenticated: true)
    }

    func getReviewsForUser(userId: String) async throws -> [Review] {
        try await request("GET", path: "/reviews/user/\(userId)")
    }

    // MARK: - Payments

    func initiatePayment(orderId: String) async throws -> PaymentInitResponse {
        try await request("POST", path: "/payments/initiate/\(orderId)", authenticated: true)
    }

    func registerFCMToken(_ token: String) async throws {
        let _: [String: String] = try await request("POST", path: "/notifications/register-token", body: ["fcmToken": token], authenticated: true)
    }
}
