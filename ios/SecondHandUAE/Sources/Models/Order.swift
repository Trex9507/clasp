import Foundation

struct Order: Codable, Identifiable {
    let id: String
    let listingId: String
    let buyerId: String
    let sellerId: String
    let offerId: String?
    let finalPrice: Double
    let deliveryMethod: String
    let deliveryAddress: String?
    let trackingNumber: String?
    let status: String
    let escrowPaymentRefId: String?
    let deliveredAt: String?
    let disputeDeadlineAt: String?
    let createdAt: String
    let listing: OrderListing?
    let buyer: OrderParty?
    let seller: OrderParty?
    let disputes: [Dispute]?
}

struct OrderListing: Codable {
    let id: String
    let title: String
    let photos: [ListingPhoto]?
    let brand: Brand?
}

struct OrderParty: Codable {
    let id: String
    let name: String
    let city: String?
}

struct CreateOrderRequest: Codable {
    let listingId: String
    let offerId: String?
    let deliveryMethod: String
    let deliveryAddress: String?
}

extension Order {
    var statusLabel: String {
        switch status {
        case "pending_payment": return "Awaiting Payment"
        case "paid_escrow": return "Paid — Awaiting Shipment"
        case "shipped": return "Shipped"
        case "delivered": return "Delivered"
        case "dispute_window": return "Delivered — Review Period"
        case "completed": return "Completed"
        case "disputed": return "Disputed"
        case "refunded": return "Refunded"
        case "cancelled": return "Cancelled"
        default: return status
        }
    }

    var statusColor: String {
        switch status {
        case "completed": return "green"
        case "disputed", "refunded", "cancelled": return "red"
        case "paid_escrow", "shipped", "delivered", "dispute_window": return "blue"
        default: return "orange"
        }
    }
}
