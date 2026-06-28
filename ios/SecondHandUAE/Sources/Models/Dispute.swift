import Foundation

struct Dispute: Codable, Identifiable {
    let id: String
    let orderId: String
    let openedBy: String
    let reason: String
    let description: String?
    let status: String
    let sellerResponseDeadlineAt: String?
    let resolutionNotes: String?
    let createdAt: String
    let opener: DisputeOpener?
}

struct DisputeOpener: Codable {
    let id: String
    let name: String
}

struct CreateDisputeRequest: Codable {
    let orderId: String
    let reason: String
    let description: String?
}

extension Dispute {
    var reasonLabel: String {
        switch reason {
        case "not_authentic": return "Not Authentic"
        case "not_as_described": return "Not as Described"
        case "damaged": return "Damaged"
        case "not_received": return "Not Received"
        case "other": return "Other"
        default: return reason
        }
    }

    var statusLabel: String {
        switch status {
        case "open": return "Open"
        case "awaiting_seller": return "Awaiting Seller Response"
        case "under_review": return "Under Review"
        case "resolved_refund": return "Resolved — Refunded"
        case "resolved_release": return "Resolved — Released"
        default: return status
        }
    }
}
