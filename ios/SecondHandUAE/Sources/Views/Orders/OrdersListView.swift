import SwiftUI

struct OrdersListView: View {
    @AppStorage("userId") private var userId = ""
    @State private var orders: [Order] = []
    @State private var isLoading = true
    @State private var filter: OrderFilter = .all

    enum OrderFilter: String, CaseIterable {
        case all = "All"
        case buying = "Buying"
        case selling = "Selling"
    }

    private var filteredOrders: [Order] {
        switch filter {
        case .all: return orders
        case .buying: return orders.filter { $0.buyerId == userId }
        case .selling: return orders.filter { $0.sellerId == userId }
        }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if !orders.isEmpty {
                    Picker("Filter", selection: $filter) {
                        ForEach(OrderFilter.allCases, id: \.self) { f in
                            Text(f.rawValue).tag(f)
                        }
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                }

                if isLoading {
                    Spacer()
                    ProgressView()
                    Spacer()
                } else if orders.isEmpty {
                    Spacer()
                    VStack(spacing: 12) {
                        Image(systemName: "bag")
                            .font(.system(size: 44))
                            .foregroundStyle(.quaternary)
                        Text("No Orders Yet")
                            .font(.headline)
                        Text("Your purchases and sales will appear here")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                } else {
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            ForEach(filteredOrders) { order in
                                NavigationLink(destination: OrderDetailView(orderId: order.id)) {
                                    OrderCard(order: order, currentUserId: userId)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(16)
                    }
                }
            }
            .navigationTitle("Orders")
            .task { await loadOrders() }
            .refreshable { await loadOrders() }
        }
    }

    private func loadOrders() async {
        do { orders = try await APIClient.shared.getMyOrders() } catch {}
        isLoading = false
    }
}

struct OrderCard: View {
    let order: Order
    let currentUserId: String

    private var isBuyer: Bool { order.buyerId == currentUserId }

    var body: some View {
        HStack(spacing: 14) {
            RoundedRectangle(cornerRadius: 10)
                .fill(Color(.systemGray6))
                .frame(width: 60, height: 60)
                .overlay {
                    if let photo = order.listing?.photos?.first {
                        AsyncImage(url: URL(string: photo.url)) { image in
                            image.resizable().scaledToFill()
                        } placeholder: {
                            Image(systemName: "bag").foregroundStyle(.quaternary)
                        }
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                    } else {
                        Image(systemName: "bag").foregroundStyle(.quaternary)
                    }
                }

            VStack(alignment: .leading, spacing: 4) {
                Text(order.listing?.title ?? "Item")
                    .font(.subheadline.bold())
                    .lineLimit(1)

                HStack(spacing: 4) {
                    Image(systemName: isBuyer ? "arrow.down.circle.fill" : "arrow.up.circle.fill")
                        .font(.caption2)
                        .foregroundStyle(isBuyer ? .blue : .green)
                    Text(isBuyer ? "Bought from \(order.seller?.name ?? "Seller")" : "Sold to \(order.buyer?.name ?? "Buyer")")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                StatusPill(label: order.statusLabel, color: statusColor)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                Text("AED \(Int(order.finalPrice))")
                    .font(.subheadline.bold())
                Image(systemName: "chevron.right")
                    .font(.caption2)
                    .foregroundStyle(.quaternary)
            }
        }
        .padding(14)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 14))
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
