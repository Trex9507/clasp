import SwiftUI

struct OrdersListView: View {
    @AppStorage("userId") private var userId = ""
    @State private var orders: [Order] = []
    @State private var isLoading = true

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView()
                } else if orders.isEmpty {
                    ContentUnavailableView("No Orders", systemImage: "bag", description: Text("Your purchases and sales will appear here."))
                } else {
                    List(orders) { order in
                        NavigationLink(destination: OrderDetailView(orderId: order.id)) {
                            OrderRowView(order: order, currentUserId: userId)
                        }
                    }
                }
            }
            .navigationTitle("Orders")
            .task { await loadOrders() }
            .refreshable { await loadOrders() }
        }
    }

    private func loadOrders() async {
        do {
            orders = try await APIClient.shared.getMyOrders()
        } catch {}
        isLoading = false
    }
}

struct OrderRowView: View {
    let order: Order
    let currentUserId: String

    private var isBuyer: Bool { order.buyerId == currentUserId }
    private var role: String { isBuyer ? "Bought" : "Sold" }
    private var counterparty: String { isBuyer ? (order.seller?.name ?? "Seller") : (order.buyer?.name ?? "Buyer") }

    var body: some View {
        HStack(spacing: 12) {
            // Thumbnail
            RoundedRectangle(cornerRadius: 6)
                .fill(Color(.systemGray5))
                .frame(width: 50, height: 50)
                .overlay {
                    if let photo = order.listing?.photos?.first {
                        AsyncImage(url: URL(string: photo.url)) { image in
                            image.resizable().scaledToFill()
                        } placeholder: {
                            Image(systemName: "photo").foregroundStyle(.secondary)
                        }
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                    } else {
                        Image(systemName: "bag").foregroundStyle(.secondary)
                    }
                }

            VStack(alignment: .leading, spacing: 4) {
                Text(order.listing?.title ?? "Item")
                    .font(.subheadline.bold())
                    .lineLimit(1)

                Text("\(role) · \(counterparty)")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Text(order.statusLabel)
                    .font(.caption2.bold())
                    .foregroundStyle(statusColor)
            }

            Spacer()

            Text("AED \(Int(order.finalPrice))")
                .font(.subheadline.bold())
        }
        .padding(.vertical, 4)
    }

    private var statusColor: Color {
        switch order.status {
        case "completed": return .green
        case "disputed", "refunded", "cancelled": return .red
        case "paid_escrow", "shipped", "delivered", "dispute_window": return .blue
        default: return .orange
        }
    }
}
