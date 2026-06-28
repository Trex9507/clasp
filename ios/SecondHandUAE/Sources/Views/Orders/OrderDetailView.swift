import SwiftUI

struct OrderDetailView: View {
    let orderId: String
    @AppStorage("userId") private var userId = ""
    @State private var order: Order?
    @State private var isLoading = true
    @State private var showDisputeSheet = false
    @State private var showReviewSheet = false
    @State private var showShipSheet = false
    @State private var errorMessage: String?

    private var isBuyer: Bool { order?.buyerId == userId }
    private var isSeller: Bool { order?.sellerId == userId }

    var body: some View {
        ScrollView {
            if isLoading {
                ProgressView().padding(.top, 100)
            } else if let order {
                VStack(alignment: .leading, spacing: 16) {
                    // Status banner
                    HStack {
                        Image(systemName: statusIcon)
                        Text(order.statusLabel)
                            .font(.headline)
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(statusBannerColor.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 12))

                    // Item info
                    if let listing = order.listing {
                        HStack(spacing: 12) {
                            RoundedRectangle(cornerRadius: 8)
                                .fill(Color(.systemGray5))
                                .frame(width: 70, height: 70)
                                .overlay {
                                    if let photo = listing.photos?.first {
                                        AsyncImage(url: URL(string: photo.url)) { image in
                                            image.resizable().scaledToFill()
                                        } placeholder: {
                                            Image(systemName: "photo").foregroundStyle(.secondary)
                                        }
                                        .clipShape(RoundedRectangle(cornerRadius: 8))
                                    }
                                }

                            VStack(alignment: .leading, spacing: 4) {
                                Text(listing.title).font(.headline)
                                if let brand = listing.brand {
                                    Text(brand.name).font(.subheadline).foregroundStyle(.secondary)
                                }
                                Text("AED \(Int(order.finalPrice))")
                                    .font(.title3.bold())
                            }
                        }
                    }

                    Divider()

                    // Parties
                    VStack(alignment: .leading, spacing: 8) {
                        if let buyer = order.buyer {
                            Label("\(buyer.name) (Buyer)", systemImage: "person.fill")
                                .font(.subheadline)
                        }
                        if let seller = order.seller {
                            Label("\(seller.name) (Seller)", systemImage: "person.fill")
                                .font(.subheadline)
                        }
                    }

                    // Delivery info
                    VStack(alignment: .leading, spacing: 4) {
                        Label(order.deliveryMethod == "hand_off" ? "Hand-off" : "Courier", systemImage: "shippingbox")
                            .font(.subheadline)
                        if let tracking = order.trackingNumber {
                            Label("Tracking: \(tracking)", systemImage: "number")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }

                    // Disputes
                    if let disputes = order.disputes, !disputes.isEmpty {
                        Divider()
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Disputes").font(.headline)
                            ForEach(disputes) { dispute in
                                VStack(alignment: .leading, spacing: 4) {
                                    HStack {
                                        Text(dispute.reasonLabel).font(.subheadline.bold())
                                        Spacer()
                                        Text(dispute.statusLabel)
                                            .font(.caption)
                                            .foregroundStyle(.orange)
                                    }
                                    if let desc = dispute.description {
                                        Text(desc).font(.caption).foregroundStyle(.secondary)
                                    }
                                }
                                .padding(10)
                                .background(Color(.systemGray6))
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                        }
                    }

                    if let errorMessage {
                        Text(errorMessage)
                            .font(.caption)
                            .foregroundStyle(.red)
                    }

                    // Actions
                    actionButtons
                }
                .padding()
            }
        }
        .navigationTitle("Order")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadOrder() }
        .sheet(isPresented: $showDisputeSheet) {
            DisputeFormView(orderId: orderId) { await loadOrder() }
        }
        .sheet(isPresented: $showReviewSheet) {
            ReviewFormView(orderId: orderId) { await loadOrder() }
        }
        .sheet(isPresented: $showShipSheet) {
            ShipFormView(orderId: orderId) { await loadOrder() }
        }
    }

    @ViewBuilder
    private var actionButtons: some View {
        VStack(spacing: 8) {
            if isBuyer && order?.status == "pending_payment" {
                Button("Pay Now — AED \(Int(order?.finalPrice ?? 0))") {
                    Task { await pay() }
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .frame(maxWidth: .infinity)
            }

            if isSeller && order?.status == "paid_escrow" {
                Button("Mark as Shipped") { showShipSheet = true }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .frame(maxWidth: .infinity)
            }

            if isBuyer && order?.status == "shipped" {
                Button("Confirm Delivery") {
                    Task { await confirmDelivery() }
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .frame(maxWidth: .infinity)
            }

            if isBuyer && order?.status == "dispute_window" {
                Button("Open Dispute") { showDisputeSheet = true }
                    .buttonStyle(.bordered)
                    .tint(.red)
                    .controlSize(.large)
                    .frame(maxWidth: .infinity)
            }

            if order?.status == "completed" {
                Button("Leave a Review") { showReviewSheet = true }
                    .buttonStyle(.bordered)
                    .controlSize(.large)
                    .frame(maxWidth: .infinity)
            }
        }
        .padding(.top)
    }

    private var statusIcon: String {
        switch order?.status {
        case "completed": return "checkmark.circle.fill"
        case "disputed", "refunded": return "exclamationmark.triangle.fill"
        case "shipped": return "shippingbox.fill"
        case "paid_escrow": return "creditcard.fill"
        default: return "clock.fill"
        }
    }

    private var statusBannerColor: Color {
        switch order?.status {
        case "completed": return .green
        case "disputed", "refunded", "cancelled": return .red
        default: return .blue
        }
    }

    private func loadOrder() async {
        do {
            order = try await APIClient.shared.getOrder(id: orderId)
        } catch {}
        isLoading = false
    }

    private func pay() async {
        do {
            order = try await APIClient.shared.payOrder(id: orderId)
        } catch { errorMessage = error.localizedDescription }
    }

    private func confirmDelivery() async {
        do {
            order = try await APIClient.shared.confirmDelivery(orderId: orderId)
        } catch { errorMessage = error.localizedDescription }
    }
}
